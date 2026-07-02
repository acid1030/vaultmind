const crypto = require('crypto');
const {
  generateGroupKey,
  wrapGroupKey,
  unwrapGroupKey,
  encryptWithGroupKey,
  decryptWithGroupKey,
} = require('./group-crypto');
const inviteCrypto = require('./invite-crypto');

function slugify(name) {
  const base = String(name || 'group')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'group';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

function getUserGroups(db, queryAll, userId) {
  return queryAll(
    `SELECT g.*, m.role, m.status
     FROM groups g
     INNER JOIN group_memberships m ON m.group_id = g.id
     WHERE m.user_id = ? AND m.status = 'active'
     ORDER BY g.created_at DESC`,
    [userId],
  );
}

function normalizeGroup(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerUserId: row.owner_user_id,
    feishuFolderToken: row.feishu_folder_token || '',
    keyVersion: Number(row.key_version || 1),
    role: row.role || 'member',
    createdAt: row.created_at,
  };
}

function requireGroupAccess(db, queryOne, groupId, userId, minRoles = ['owner', 'admin', 'member', 'viewer']) {
  const row = queryOne(
    `SELECT m.*, g.name FROM group_memberships m
     INNER JOIN groups g ON g.id = m.group_id
     WHERE m.group_id = ? AND m.user_id = ? AND m.status = 'active'`,
    [groupId, userId],
  );
  if (!row || !minRoles.includes(row.role)) {
    throw new Error('无权访问该用户组');
  }
  return row;
}

function getGroupKeyForUser(db, queryOne, groupId, userId, user, password) {
  const group = queryOne('SELECT * FROM groups WHERE id = ?', [groupId]);
  if (!group) throw new Error('用户组不存在');
  const wrapped = queryOne(
    'SELECT * FROM group_member_keys WHERE group_id = ? AND user_id = ? AND key_version = ?',
    [groupId, userId, group.key_version],
  );
  if (!wrapped) throw new Error('你没有该组的解密密钥，请联系管理员重新邀请');
  return unwrapGroupKey({
    ciphertext: wrapped.wrapped_key_ciphertext,
    iv: wrapped.wrapped_key_iv,
    tag: wrapped.wrapped_key_tag,
  }, user, password);
}

function createGroup(db, saveDatabase, queryOne, user, password, input) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('请输入用户组名称');
  const groupId = crypto.randomUUID();
  const slug = slugify(name);
  const now = new Date().toISOString();
  const groupKey = generateGroupKey();
  const wrapped = wrapGroupKey(groupKey, user, password);

  db.run(
    `INSERT INTO groups (id, name, slug, owner_user_id, feishu_folder_token, key_version, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [groupId, name, slug, user.id, String(input.feishuFolderToken || '').trim() || null, now],
  );
  db.run(
    `INSERT INTO group_memberships (group_id, user_id, role, status, joined_at)
     VALUES (?, ?, 'owner', 'active', ?)`,
    [groupId, user.id, now],
  );
  db.run(
    `INSERT INTO group_member_keys (group_id, user_id, key_version, wrapped_key_ciphertext, wrapped_key_iv, wrapped_key_tag)
     VALUES (?, ?, 1, ?, ?, ?)`,
    [groupId, user.id, wrapped.ciphertext, wrapped.iv, wrapped.tag],
  );
  saveDatabase();
  return queryOne('SELECT * FROM groups WHERE id = ?', [groupId]);
}

function inviteToGroup(db, saveDatabase, queryOne, queryAll, inviter, password, input) {
  const groupId = String(input.groupId || '');
  const email = String(input.email || '').trim().toLowerCase();
  const role = ['admin', 'member', 'viewer'].includes(input.role) ? input.role : 'member';
  requireGroupAccess(db, queryOne, groupId, inviter.id, ['owner', 'admin']);

  const invitee = queryOne('SELECT * FROM users WHERE email = ?', [email]);
  if (invitee) {
    const active = queryOne(
      'SELECT * FROM group_memberships WHERE group_id = ? AND user_id = ? AND status = ?',
      [groupId, invitee.id, 'active'],
    );
    if (active) throw new Error('该用户已在组内');
  }

  const groupKey = getGroupKeyForUser(db, queryOne, groupId, inviter.id, inviter, password);
  const sealed = inviteCrypto.sealGroupKeyForInvite(groupKey, email, groupId);
  db.run('DELETE FROM group_invites WHERE group_id = ? AND invitee_email = ? AND status = ?', [groupId, email, 'pending']);
  const inviteId = crypto.randomUUID();
  db.run(
    `INSERT INTO group_invites (id, group_id, invitee_email, role, status, created_at, sealed_ciphertext, sealed_iv, sealed_tag)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    [inviteId, groupId, email, role, new Date().toISOString(), sealed.ciphertext, sealed.iv, sealed.tag],
  );
  saveDatabase();
  return { inviteCode: inviteId, pending: true, email, userExists: Boolean(invitee) };
}

function processPendingInvitesForUser(db, saveDatabase, queryOne, queryAll, user, password) {
  const invites = queryAll(
    'SELECT * FROM group_invites WHERE invitee_email = ? AND status = ?',
    [user.email, 'pending'],
  );
  const accepted = [];
  for (const invite of invites) {
    if (!invite.sealed_ciphertext) continue;
    try {
      const groupKey = inviteCrypto.openGroupKeyFromInvite({
        ciphertext: invite.sealed_ciphertext,
        iv: invite.sealed_iv,
        tag: invite.sealed_tag,
      }, user.email, invite.group_id);
      const wrapped = wrapGroupKey(groupKey, user, password);
      const group = queryOne('SELECT * FROM groups WHERE id = ?', [invite.group_id]);
      if (!group) continue;
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO group_memberships (group_id, user_id, role, status, joined_at)
         VALUES (?, ?, ?, 'active', ?)`,
        [invite.group_id, user.id, invite.role, now],
      );
      db.run('DELETE FROM group_member_keys WHERE group_id = ? AND user_id = ?', [invite.group_id, user.id]);
      db.run(
        `INSERT INTO group_member_keys (group_id, user_id, key_version, wrapped_key_ciphertext, wrapped_key_iv, wrapped_key_tag)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invite.group_id, user.id, group.key_version, wrapped.ciphertext, wrapped.iv, wrapped.tag],
      );
      db.run('UPDATE group_invites SET status = ? WHERE id = ?', ['accepted', invite.id]);
      accepted.push({ groupId: invite.group_id, role: invite.role });
    } catch {
      // skip invalid invite
    }
  }
  if (accepted.length) saveDatabase();
  return accepted;
}

function listPendingInvites(db, queryAll, user) {
  return queryAll(
    `SELECT i.*, g.name AS group_name FROM group_invites i
     INNER JOIN groups g ON g.id = i.group_id
     WHERE i.invitee_email = ? AND i.status = ?`,
    [user.email, 'pending'],
  ).map((row) => ({
    id: row.id,
    groupId: row.group_id,
    groupName: row.group_name,
    role: row.role,
    createdAt: row.created_at,
  }));
}

function removeGroupMember(db, saveDatabase, queryOne, queryAll, actor, password, input) {
  const groupId = String(input.groupId || '');
  const targetUserId = String(input.userId || '');
  requireGroupAccess(db, queryOne, groupId, actor.id, ['owner', 'admin']);
  const target = queryOne(
    'SELECT * FROM group_memberships WHERE group_id = ? AND user_id = ? AND status = ?',
    [groupId, targetUserId, 'active'],
  );
  if (!target) throw new Error('成员不存在');
  if (target.role === 'owner') throw new Error('不能移除所有者');
  if (targetUserId === actor.id) throw new Error('请使用离开用户组');
  const actorMembership = requireGroupAccess(db, queryOne, groupId, actor.id, ['owner', 'admin']);
  if (actorMembership.role === 'admin' && target.role === 'admin') {
    throw new Error('管理员不能移除其他管理员');
  }
  db.run('DELETE FROM group_memberships WHERE group_id = ? AND user_id = ?', [groupId, targetUserId]);
  db.run('DELETE FROM group_member_keys WHERE group_id = ? AND user_id = ?', [groupId, targetUserId]);
  saveDatabase();
  return { removed: targetUserId };
}

function rotateGroupKey(db, saveDatabase, queryOne, queryAll, actor, password, groupId) {
  requireGroupAccess(db, queryOne, groupId, actor.id, ['owner', 'admin']);
  const group = queryOne('SELECT * FROM groups WHERE id = ?', [groupId]);
  const oldKey = getGroupKeyForUser(db, queryOne, groupId, actor.id, actor, password);
  const newKey = generateGroupKey();
  const newVersion = Number(group.key_version || 1) + 1;

  const members = queryAll(
    'SELECT user_id FROM group_memberships WHERE group_id = ? AND status = ?',
    [groupId, 'active'],
  );
  for (const member of members) {
    db.run('DELETE FROM group_member_keys WHERE group_id = ? AND user_id = ?', [groupId, member.user_id]);
  }
  const wrapped = wrapGroupKey(newKey, actor, password);
  db.run(
    `INSERT INTO group_member_keys (group_id, user_id, key_version, wrapped_key_ciphertext, wrapped_key_iv, wrapped_key_tag)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [groupId, actor.id, newVersion, wrapped.ciphertext, wrapped.iv, wrapped.tag],
  );

  db.run('UPDATE groups SET key_version = ? WHERE id = ?', [newVersion, groupId]);

  const groupItems = queryAll('SELECT * FROM library_items WHERE scope = ? AND group_id = ?', ['group', groupId]);
  for (const item of groupItems) {
    try {
      const plain = decryptWithGroupKey(item, oldKey);
      const next = encryptWithGroupKey(plain, newKey);
      db.run(
        'UPDATE library_items SET content_ciphertext = ?, content_iv = ?, content_tag = ? WHERE id = ?',
        [next.ciphertext, next.iv, next.tag, item.id],
      );
    } catch {
      // skip broken rows
    }
  }

  const accounts = queryAll('SELECT * FROM project_accounts WHERE scope = ? AND group_id = ?', ['group', groupId]);
  for (const row of accounts) {
    try {
      const plain = decryptWithGroupKey({
        content_ciphertext: row.secret_ciphertext,
        content_iv: row.secret_iv,
        content_tag: row.secret_tag,
      }, oldKey);
      const next = encryptWithGroupKey(plain, newKey);
      db.run(
        'UPDATE project_accounts SET secret_ciphertext = ?, secret_iv = ?, secret_tag = ? WHERE id = ?',
        [next.ciphertext, next.iv, next.tag, row.id],
      );
    } catch {
      // skip
    }
  }

  saveDatabase();
  const needsReinvite = members.filter((m) => m.user_id !== actor.id).map((m) => m.user_id);
  return { newVersion, keyVersion: newVersion, reencrypted: groupItems.length, needsReinvite };
}

function updateMemberRole(db, saveDatabase, queryOne, actor, input) {
  const groupId = String(input.groupId || '');
  const targetUserId = String(input.userId || '');
  const role = ['admin', 'member', 'viewer'].includes(input.role) ? input.role : 'member';
  requireGroupAccess(db, queryOne, groupId, actor.id, ['owner', 'admin']);
  const target = queryOne(
    'SELECT * FROM group_memberships WHERE group_id = ? AND user_id = ? AND status = ?',
    [groupId, targetUserId, 'active'],
  );
  if (!target) throw new Error('成员不存在');
  if (target.role === 'owner') throw new Error('不能修改所有者角色');
  db.run('UPDATE group_memberships SET role = ? WHERE group_id = ? AND user_id = ?', [role, groupId, targetUserId]);
  saveDatabase();
}

function transferOwnership(db, saveDatabase, queryOne, actor, input) {
  const groupId = String(input.groupId || '');
  const newOwnerId = String(input.userId || '');
  const membership = requireGroupAccess(db, queryOne, groupId, actor.id, ['owner']);
  const target = queryOne(
    'SELECT * FROM group_memberships WHERE group_id = ? AND user_id = ? AND status = ?',
    [groupId, newOwnerId, 'active'],
  );
  if (!target) throw new Error('目标用户不是组成员');
  db.run('UPDATE group_memberships SET role = ? WHERE group_id = ? AND user_id = ?', ['admin', groupId, actor.id]);
  db.run('UPDATE group_memberships SET role = ? WHERE group_id = ? AND user_id = ?', ['owner', groupId, newOwnerId]);
  db.run('UPDATE groups SET owner_user_id = ? WHERE id = ?', [newOwnerId, groupId]);
  saveDatabase();
}

function leaveGroup(db, saveDatabase, queryOne, queryAll, user, groupId) {
  const membership = requireGroupAccess(db, queryOne, groupId, user.id);
  if (membership.role === 'owner') {
    const others = queryOne(
      'SELECT COUNT(*) AS c FROM group_memberships WHERE group_id = ? AND user_id != ? AND status = ?',
      [groupId, user.id, 'active'],
    );
    if (Number(others?.c || 0) > 0) {
      throw new Error('所有者离开前请转让所有权或解散用户组');
    }
    db.run('DELETE FROM group_invites WHERE group_id = ?', [groupId]);
    db.run('DELETE FROM groups WHERE id = ?', [groupId]);
  }
  db.run('DELETE FROM group_memberships WHERE group_id = ? AND user_id = ?', [groupId, user.id]);
  db.run('DELETE FROM group_member_keys WHERE group_id = ? AND user_id = ?', [groupId, user.id]);
  saveDatabase();
}

function listGroupMembers(db, queryAll, queryOne, groupId, userId) {
  requireGroupAccess(db, queryOne, groupId, userId);
  return queryAll(
    `SELECT u.id, u.email, u.username, m.role, m.joined_at
     FROM group_memberships m
     INNER JOIN users u ON u.id = m.user_id
     WHERE m.group_id = ? AND m.status = 'active'
     ORDER BY m.joined_at ASC`,
    [groupId],
  ).map((row) => ({
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role,
    joinedAt: row.joined_at,
  }));
}

module.exports = {
  slugify,
  getUserGroups,
  normalizeGroup,
  requireGroupAccess,
  getGroupKeyForUser,
  createGroup,
  inviteToGroup,
  processPendingInvitesForUser,
  listPendingInvites,
  removeGroupMember,
  rotateGroupKey,
  updateMemberRole,
  transferOwnership,
  leaveGroup,
  listGroupMembers,
};
