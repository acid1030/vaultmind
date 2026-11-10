const crypto = require('crypto');
const localCrypto = require('../services/crypto');
const groupCrypto = require('./group-crypto');
const groups = require('./groups');
const chatFiles = require('./chat-attachments');

const MAX_TEXT_LENGTH = 20000;
const BATCH_SIZE = 100;
const MAX_BATCH_BYTES = 12 * 1024 * 1024;
const INVITE_PREFIX = 'axonchat1';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function rebindPersonalMessages(db, userId, previousVaultId, nextVaultId) {
  if (previousVaultId === nextVaultId) return;
  db.run("UPDATE chat_messages SET sender_id = ?, synced_at = NULL WHERE owner_user_id = ? AND scope = 'personal' AND outgoing = 1 AND sender_id = ?",
    [nextVaultId, userId, previousVaultId]);
  db.run("DELETE FROM chat_downloads WHERE owner_user_id = ? AND room_id = 'personal'", [userId]);
  db.run('DELETE FROM app_state WHERE key = ?', [`chatSync:${userId}:personal`]);
}

function createChatService({ db, queryOne, queryAll, save, getSession, getSettings, resolvePersonalFolder, transport }) {
  const running = new Map();
  function session() {
    const value = getSession();
    if (!value?.user || !value.password) throw new Error('请先登录本地账号');
    return value;
  }
  function fence(captured) {
    const current = session();
    if (current.user.id !== captured.user.id || current.password !== captured.password || current.vaultId !== captured.vaultId || current.epoch !== captured.epoch || current.cloudIdentity !== captured.cloudIdentity) {
      throw new Error('登录状态已变化，请重新同步聊天');
    }
  }
  function room(input, s, writable = false) {
    if (input?.scope === 'personal') return { scope: 'personal', groupId: '', localId: 'personal', cloudId: s.vaultId, writable: true };
    if (input?.scope !== 'group' || !input.groupId) throw new Error('请选择有效的聊天空间');
    const membership = groups.requireGroupAccess(db, queryOne, String(input.groupId), s.user.id,
      writable ? ['owner', 'admin', 'member'] : ['owner', 'admin', 'member', 'viewer']);
    return { scope: 'group', groupId: String(input.groupId), localId: `group:${input.groupId}`, cloudId: String(input.groupId), writable: membership.role !== 'viewer' };
  }
  function stateKey(s, r) { return `chatSync:${s.user.id}:${r.localId}`; }
  function syncState(s, r, patch) {
    const key = stateKey(s, r);
    let value = {};
    try { value = JSON.parse(queryOne('SELECT value FROM app_state WHERE key = ?', [key])?.value || '{}'); } catch { /* old state */ }
    if (patch) {
      value = { ...value, ...patch };
      db.run('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
      save();
    }
    return value;
  }
  function contentKey(s) {
    // Derive once per operation, rather than twice per message in a long history.
    if (!s.contentKey) s.contentKey = localCrypto.deriveContentKey(s.password, s.user.password_salt);
    return s.contentKey;
  }
  function bodyBytes(message) {
    return Buffer.from(message.attachments?.length ? JSON.stringify({ text: message.text, attachments: message.attachments }) : message.text, 'utf8');
  }
  function persistBody(message, s, r) {
    const encrypted = groupCrypto.encryptWithGroupKey(bodyBytes(message), contentKey(s));
    db.run('UPDATE chat_messages SET content_ciphertext = ?, content_iv = ?, content_tag = ?, content_format = ? WHERE owner_user_id = ? AND room_id = ? AND id = ?',
      [encrypted.ciphertext, encrypted.iv, encrypted.tag, message.attachments?.length ? 2 : 1, s.user.id, r.localId, message.id]);
  }
  function decode(row, s) {
    const plain = groupCrypto.decryptWithGroupKey(row, contentKey(s)).toString('utf8');
    const body = row.content_format === 2 ? JSON.parse(plain) : { text: plain };
    return { id: row.id, senderId: row.sender_id, senderName: row.sender_name, senderEmail: row.sender_email,
      deviceId: row.device_id, createdAt: row.created_at,
      text: body.text, ...(body.attachments?.length ? { attachments: body.attachments } : {}),
      synced: Boolean(row.synced_at), mine: row.sender_id === s.vaultId || row.sender_email === s.user.email };
  }
  function list(input) {
    const s = session();
    const r = room(input, s);
    const cursor = input.before;
    const args = [s.user.id, r.localId];
    let clause = '';
    if (cursor) {
      if (typeof cursor.createdAt !== 'string' || typeof cursor.id !== 'string') throw new Error('聊天分页参数无效');
      clause = ' AND (created_at < ? OR (created_at = ? AND id < ?))';
      args.push(cursor.createdAt, cursor.createdAt, cursor.id);
    }
    const rows = queryAll(`SELECT * FROM chat_messages WHERE owner_user_id = ? AND room_id = ?${clause} ORDER BY created_at DESC, id DESC LIMIT 101`, args);
    const hasMore = rows.length > 100;
    const messages = rows.slice(0, 100).reverse().map(row => decode(row, s));
    return { messages, hasMore, writable: r.writable,
      pending: Number(queryOne('SELECT COUNT(*) AS count FROM chat_messages WHERE owner_user_id = ? AND room_id = ? AND outgoing = 1 AND synced_at IS NULL', [s.user.id, r.localId]).count),
      ...syncState(s, r) };
  }
  function insertMessage(message, s, r, outgoing, syncedAt = null) {
    const encrypted = groupCrypto.encryptWithGroupKey(bodyBytes(message), contentKey(s));
    db.run(`INSERT OR IGNORE INTO chat_messages
      (owner_user_id, room_id, id, scope, group_id, sender_id, sender_name, sender_email, device_id, created_at,
       content_ciphertext, content_iv, content_tag, outgoing, synced_at, content_format) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [s.user.id, r.localId, message.id, r.scope, r.groupId || null, message.senderId, message.senderName, message.senderEmail,
      message.deviceId, message.createdAt, encrypted.ciphertext, encrypted.iv, encrypted.tag, outgoing ? 1 : 0, syncedAt, message.attachments?.length ? 2 : 1]);
  }
  function send(input) {
    const s = session();
    const r = room(input, s, true);
    const text = typeof input.text === 'string' ? input.text : '';
    const files = attachmentStore.take(input.attachmentIds || [], s, r);
    if (!text.trim() && !files.length) throw new Error('请输入消息内容或添加附件');
    if (text.length > MAX_TEXT_LENGTH) throw new Error('每条消息最多 20000 个字符');
    const message = { id: crypto.randomUUID(), senderId: s.vaultId, senderName: (s.user.username || s.user.email).slice(0, 200),
      senderEmail: s.user.email, deviceId: s.deviceId, createdAt: new Date().toISOString(), text,
      ...(files.length ? { attachments: files.map(file => chatFiles.metadata(file)) } : {}) };
    db.run('BEGIN');
    try { insertMessage(message, s, r, true); attachmentStore.attachDrafts(message, files, s, r); db.run('COMMIT'); }
    catch (error) { db.run('ROLLBACK'); throw error; }
    save();
    attachmentStore.commitDrafts(files);
    return { ...message, synced: false, mine: true };
  }

  function validateBatch(batch, r) {
    if (!batch || batch.kind !== 'chat-batch' || ![1, 2].includes(batch.version) || batch.scope !== r.scope || batch.roomId !== r.cloudId
      || !Array.isArray(batch.messages) || batch.messages.length > BATCH_SIZE) throw new Error('聊天记录空间或格式不匹配');
    for (const m of batch.messages) {
      if (!m || typeof m.id !== 'string' || !uuid.test(m.id) || typeof m.text !== 'string' || (!m.text.trim() && !m.attachments?.length) || m.text.length > MAX_TEXT_LENGTH
        || !Number.isFinite(Date.parse(m.createdAt)) || typeof m.senderId !== 'string' || !m.senderId || m.senderId.length > 128
        || typeof m.senderName !== 'string' || m.senderName.length > 200 || typeof m.senderEmail !== 'string' || m.senderEmail.length > 254
        || typeof m.deviceId !== 'string' || !m.deviceId || m.deviceId.length > 128
        || (r.scope === 'personal' && m.senderId !== r.cloudId)) throw new Error('聊天消息格式无效');
      if (m.attachments !== undefined) {
        if (batch.version !== 2 || !Array.isArray(m.attachments) || m.attachments.length > chatFiles.MAX_ATTACHMENTS || new Set(m.attachments.map(file => file?.id)).size !== m.attachments.length) throw new Error('聊天附件列表无效');
        m.attachments = m.attachments.map(file => chatFiles.metadata(file, true));
      }
    }
  }
  async function resolveCloud(input, s, r) {
    const settings = getSettings();
    let groupVersion;
    let groupFolder;
    function check() {
      fence(s);
      room(input, s);
      if (r.scope === 'group' && groupVersion !== undefined) {
        const current = queryOne('SELECT key_version, feishu_folder_token FROM groups WHERE id = ?', [r.groupId]);
        if (!current || current.key_version !== groupVersion || current.feishu_folder_token !== groupFolder) {
          throw new Error('群密钥或共享文件夹配置已变化，请重新同步');
        }
      } else if (r.scope === 'personal') {
        const current = getSettings();
        if (current.feishuPassphrase !== settings.feishuPassphrase || current.folderToken !== settings.folderToken) {
          throw new Error('飞书同步配置已变化，请重新同步');
        }
      }
    }
    let key;
    let folder;
    if (r.scope === 'personal') {
      if (!s.linked) throw new Error('请先在同步中心创建或加入云端账号，再同步个人聊天');
      if (!settings.feishuPassphrase) throw new Error('请先配置飞书加密口令');
      key = settings.feishuPassphrase;
      folder = await resolvePersonalFolder(settings.folderToken || 'root');
    } else {
      const group = queryOne('SELECT * FROM groups WHERE id = ?', [r.groupId]);
      folder = group?.feishu_folder_token;
      groupVersion = group?.key_version;
      groupFolder = folder;
      if (!folder || folder === 'root') throw new Error('请为该组配置明确的飞书共享文件夹，并向成员授予访问权限');
      key = groups.getGroupKeyForUser(db, queryOne, r.groupId, s.user.id, s.user, s.password);
    }
    check();
    const namespace = crypto.createHash('sha256').update(`${r.scope}:${r.cloudId}`).digest('hex').slice(0, 32);
    const keyVersion = r.scope === 'group' ? `-${crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)}` : '';
    const prefix = `axonmind-chat-${namespace}${keyVersion}-`;
    return { scope: r.scope, key, folder, prefix, check,
      target: prefix };
  }
  const attachmentStore = chatFiles.createAttachmentStore({ db, queryOne, queryAll, save, session, room, contentKey, decode, persistBody, resolveCloud, transport, fence });

  async function runSync(input, s, r) {
    const errors = [];
    let check = () => fence(s);
    try {
      const context = await resolveCloud(input, s, r);
      const { key, folder, prefix } = context;
      check = context.check;
      const files = await transport.list(folder);
      check();
      let received = 0;
      for (const file of files.filter(f => f.name?.startsWith(prefix) && f.name.endsWith('.axonchat'))) {
        if (queryOne('SELECT 1 FROM chat_downloads WHERE owner_user_id = ? AND room_id = ? AND file_token = ?', [s.user.id, r.localId, file.token])) continue;
        try {
          const bytes = await transport.download(file.token);
          check();
          room(input, s);
          if (bytes.length > MAX_BATCH_BYTES) throw new Error('聊天记录文件过大');
          if (r.scope === 'personal') {
            const envelope = JSON.parse(bytes.toString('utf8'));
            if (envelope.version !== localCrypto.VAULT_VERSION || envelope.kdf?.iterations !== localCrypto.KEY_ITERATIONS) {
              throw new Error('聊天加密文件参数无效');
            }
          }
          const batch = r.scope === 'personal'
            ? localCrypto.decryptVaultPayload(bytes, key)
            : JSON.parse(groupCrypto.decryptWithGroupKey(JSON.parse(bytes.toString('utf8')), key).toString('utf8'));
          validateBatch(batch, r);
          const expectedDigest = crypto.createHash('sha256').update(batch.messages.map(message => message.id).join(':')).digest('hex');
          if (file.name !== `${prefix}${expectedDigest}.axonchat`) throw new Error('聊天文件标识与记录不一致');
          db.run('BEGIN');
          try {
            for (const message of batch.messages) {
              const existing = queryOne('SELECT * FROM chat_messages WHERE owner_user_id = ? AND room_id = ? AND id = ?', [s.user.id, r.localId, message.id]);
              if (!existing) { insertMessage(message, s, r, false, new Date().toISOString()); received += 1; }
              else if (message.attachments?.length) {
                const previous = decode(existing, s);
                if (previous.text !== message.text || chatFiles.fingerprint(previous.attachments) !== chatFiles.fingerprint(message.attachments)) throw new Error('重复消息的内容不一致');
                persistBody(message, s, r);
              }
              attachmentStore.registerRemote(message, s, r, context);
            }
            db.run('INSERT OR IGNORE INTO chat_downloads VALUES (?, ?, ?)', [s.user.id, r.localId, file.token]);
            db.run('COMMIT');
          } catch (error) { db.run('ROLLBACK'); throw error; }
          save();
        } catch (error) {
          check();
          errors.push('有一份云端聊天记录无法读取，请检查加密口令或组密钥，文件也可能已损坏');
        }
      }
      check();
      // Only locally queued messages are uploaded; never republish received history.
      const pending = r.writable ? queryAll('SELECT * FROM chat_messages WHERE owner_user_id = ? AND room_id = ? AND outgoing = 1 AND synced_at IS NULL ORDER BY created_at, id', [s.user.id, r.localId]) : [];
      let uploaded = 0;
      for (let offset = 0; offset < pending.length;) {
        check();
        room(input, s, true);
        let rows = pending.slice(offset, offset + BATCH_SIZE);
        let messages = rows.map(row => {
          const { synced, mine, ...message } = decode(row, s);
          return message;
        });
        for (let index = 0; index < messages.length; index++) {
          messages[index] = await attachmentStore.uploadForMessage(messages[index], s, r, context, files);
          check();
        }
        const batch = { kind: 'chat-batch', version: messages.some(message => message.attachments?.length) ? 2 : 1, scope: r.scope, roomId: r.cloudId, messages };
        // JSON escaping can expand text sixfold; keep valid large messages
        // uploadable by reducing the batch before the encrypted size limit.
        while (Buffer.byteLength(JSON.stringify(batch)) > 8 * 1024 * 1024 && rows.length > 1) {
          rows = rows.slice(0, Math.ceil(rows.length / 2));
          messages = messages.slice(0, rows.length);
          batch.messages = messages;
        }
        const bytes = r.scope === 'personal' ? localCrypto.encryptVaultPayload(batch, key)
          : Buffer.from(JSON.stringify(groupCrypto.encryptWithGroupKey(Buffer.from(JSON.stringify(batch)), key)));
        if (bytes.length > MAX_BATCH_BYTES) throw new Error('聊天记录文件过大，请减少单条消息长度');
        const digest = crypto.createHash('sha256').update(rows.map(row => row.id).join(':')).digest('hex');
        const name = `${prefix}${digest}.axonchat`;
        room(input, s, true);
        const existing = files.find(file => file.name === name);
        // Retry ambiguous uploads by downloading/validating them before acknowledging pending messages.
        let uploadedFile;
        if (existing && queryOne('SELECT 1 FROM chat_downloads WHERE owner_user_id = ? AND room_id = ? AND file_token = ?', [s.user.id, r.localId, existing.token])) {
          uploadedFile = { file_token: existing.token };
        } else {
          uploadedFile = await transport.upload(folder, name, bytes);
        }
        check();
        if (!uploadedFile?.file_token) throw new Error('飞书未返回聊天文件 Token');
        const now = new Date().toISOString();
        room(input, s, true);
        for (const row of rows) db.run('UPDATE chat_messages SET synced_at = ? WHERE owner_user_id = ? AND room_id = ? AND id = ?', [now, s.user.id, r.localId, row.id]);
        db.run('INSERT OR IGNORE INTO chat_downloads VALUES (?, ?, ?)', [s.user.id, r.localId, uploadedFile.file_token]);
        save();
        uploaded += rows.length;
        offset += rows.length;
      }
      check();
      syncState(s, r, { lastSyncAt: new Date().toISOString(), lastError: errors.join('；') });
      return { uploaded, received, errors };
    } catch (error) {
      check();
      syncState(s, r, { lastError: String(error.message || error) });
      throw error;
    }
  }
  function syncRoom(input) {
    const s = session();
    const r = room(input, s);
    const id = `${s.user.id}:${s.vaultId}:${s.epoch || 0}:${r.localId}`;
    if (running.has(id)) return running.get(id);
    const promise = runSync(input, s, r).finally(() => running.delete(id));
    running.set(id, promise);
    return promise;
  }
  async function syncAll() {
    const s = session();
    const rooms = [{ scope: 'personal' }, ...groups.getUserGroups(db, queryAll, s.user.id).map(g => ({ scope: 'group', groupId: g.id }))];
    const results = [];
    for (const input of rooms) {
      fence(s);
      try { results.push({ ...input, ...await syncRoom(input) }); }
      catch (error) { fence(s); results.push({ ...input, errors: [String(error.message || error)] }); }
    }
    return results;
  }
  function exportInvite(input) {
    const s = session();
    const r = room({ scope: 'group', groupId: input.groupId }, s);
    const membership = groups.requireGroupAccess(db, queryOne, r.groupId, s.user.id, ['owner', 'admin']);
    const group = queryOne('SELECT * FROM groups WHERE id = ?', [r.groupId]);
    if (!group.feishu_folder_token || group.feishu_folder_token === 'root') throw new Error('请先为用户组设置飞书共享文件夹');
    const email = String(input.email || '').trim().toLowerCase();
    if (!email || email.length > 254 || (!email.includes('@') && !/^\+?\d{6,}$/.test(email))) throw new Error('请输入受邀账号的邮箱或手机号');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const invite = { kind: 'chat-invite', version: 1, email, expiresAt,
      group: { id: group.id, name: group.name, slug: group.slug, ownerUserId: group.owner_user_id,
        folderToken: group.feishu_folder_token, keyVersion: group.key_version, createdAt: group.created_at },
      role: email === s.user.email.toLowerCase() ? membership.role : (input.role === 'viewer' ? 'viewer' : 'member'),
      key: groups.getGroupKeyForUser(db, queryOne, r.groupId, s.user.id, s.user, s.password).toString('base64') };
    const secret = crypto.randomBytes(32);
    const encrypted = groupCrypto.encryptWithGroupKey(Buffer.from(JSON.stringify(invite)), secret);
    return { code: `${INVITE_PREFIX}.${Buffer.from(JSON.stringify(encrypted)).toString('base64url')}.${secret.toString('base64url')}`, expiresAt };
  }
  function acceptInvite(input) {
    const s = session();
    let invite;
    try {
      const code = String(input.code || '').trim();
      if (code.length > 16000) throw new Error();
      const [prefix, encoded, secret, extra] = code.split('.');
      if (prefix !== INVITE_PREFIX || !encoded || !secret || extra) throw new Error();
      invite = JSON.parse(groupCrypto.decryptWithGroupKey(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')), Buffer.from(secret, 'base64url')).toString('utf8'));
      const g = invite.group;
      if (invite.kind !== 'chat-invite' || invite.version !== 1 || !g || !uuid.test(g.id) || typeof g.name !== 'string' || !g.name || g.name.length > 200
        || typeof g.slug !== 'string' || typeof g.ownerUserId !== 'string' || typeof g.folderToken !== 'string' || !g.folderToken || g.folderToken === 'root'
        || !Number.isInteger(g.keyVersion) || g.keyVersion < 1 || !Number.isFinite(Date.parse(g.createdAt))
        || !['owner', 'admin', 'member', 'viewer'].includes(invite.role) || Buffer.from(invite.key, 'base64').length !== 32
        || !Number.isFinite(Date.parse(invite.expiresAt))) throw new Error();
    } catch { throw new Error('群聊邀请无效或已损坏'); }
    if (invite.email !== s.user.email.toLowerCase()) throw new Error('此邀请属于其他账号，请使用受邀邮箱或手机号登录');
    if (Date.parse(invite.expiresAt) <= Date.now()) throw new Error('群聊邀请已过期，请联系管理员重新生成');
    const g = invite.group;
    const existing = queryOne('SELECT * FROM groups WHERE id = ?', [g.id]);
    if (existing) {
      if (existing.feishu_folder_token !== g.folderToken || existing.owner_user_id !== g.ownerUserId || g.keyVersion < existing.key_version) {
        throw new Error('邀请与现有群聊不一致，或使用了过旧的组密钥');
      }
      const membership = queryOne("SELECT * FROM group_memberships WHERE group_id = ? AND user_id = ? AND status = 'active'", [g.id, s.user.id]);
      if (membership && g.keyVersion === existing.key_version) {
        const wrappedKey = queryOne('SELECT 1 FROM group_member_keys WHERE group_id = ? AND user_id = ? AND key_version = ?', [g.id, s.user.id, g.keyVersion]);
        if (wrappedKey) {
          const key = groups.getGroupKeyForUser(db, queryOne, g.id, s.user.id, s.user, s.password);
          if (!key.equals(Buffer.from(invite.key, 'base64'))) throw new Error('邀请与现有群聊密钥不一致，请联系管理员');
          return { groupId: g.id };
        }
      }
    }
    const wrapped = groupCrypto.wrapGroupKey(Buffer.from(invite.key, 'base64'), s.user, s.password);
    db.run('BEGIN');
    try {
      db.run('INSERT OR IGNORE INTO groups (id, name, slug, owner_user_id, feishu_folder_token, key_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [g.id, g.name, g.slug, g.ownerUserId, g.folderToken, g.keyVersion, g.createdAt]);
      db.run('UPDATE groups SET key_version = ? WHERE id = ?', [g.keyVersion, g.id]);
      db.run("INSERT OR REPLACE INTO group_memberships (group_id, user_id, role, status, joined_at) VALUES (?, ?, ?, 'active', ?)", [g.id, s.user.id, invite.role, new Date().toISOString()]);
      db.run('INSERT OR REPLACE INTO group_member_keys (group_id, user_id, key_version, wrapped_key_ciphertext, wrapped_key_iv, wrapped_key_tag) VALUES (?, ?, ?, ?, ?, ?)', [g.id, s.user.id, g.keyVersion, wrapped.ciphertext, wrapped.iv, wrapped.tag]);
      db.run('COMMIT');
    } catch (error) { db.run('ROLLBACK'); throw error; }
    save();
    return { groupId: g.id };
  }
  return { list, send, syncRoom, syncAll, exportInvite, acceptInvite,
    stageAttachments: attachmentStore.stageAttachments, discardAttachments: attachmentStore.discardAttachments,
    getAttachment: attachmentStore.getAttachment, prepareGroupRotation: attachmentStore.prepareGroupRotation,
    clearDrafts: attachmentStore.clearDrafts, readDraftAttachment: attachmentStore.readDraftAttachment };
}

module.exports = { createChatService, rebindPersonalMessages, MAX_TEXT_LENGTH };
