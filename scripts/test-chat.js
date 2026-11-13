#!/usr/bin/env node
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const initSqlJs = require('sql.js');
const { migrateSchema } = require('../src/core/schema');
const { createChatService, rebindPersonalMessages } = require('../src/core/chat');
const { hashPassword } = require('../src/services/crypto');
const groups = require('../src/core/groups');
const groupCrypto = require('../src/core/group-crypto');
const { listAllFiles } = require('../src/core/feishu-drive');

async function main() {
  const SQL = await initSqlJs();
  const files = new Map();
  let failUpload = false;
  let failAfterUpload = false;
  let afterDownload = null;
  let afterUpload = null;
  const transport = {
    list: async folder => [...files.values()].filter(f => f.folder === folder),
    upload: async (folder, name, bytes) => {
      if (failUpload) throw new Error('offline');
      const token = crypto.randomUUID();
      files.set(token, { token, name, bytes, folder });
      if (failAfterUpload) { failAfterUpload = false; throw new Error('ambiguous upload'); }
      if (afterUpload) { afterUpload(); afterUpload = null; }
      return { file_token: token };
    },
    download: async token => {
      const bytes = files.get(token).bytes;
      if (afterDownload) { afterDownload(); afterDownload = null; }
      return bytes;
    },
  };
  function device(email, vaultId, deviceId, password = 'local-password', snapshot) {
    const db = snapshot ? new SQL.Database(snapshot) : new SQL.Database();
    if (!snapshot) db.run(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, username TEXT, password_salt TEXT, password_hash TEXT);
      CREATE TABLE app_state (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE library_items (scope TEXT, group_id TEXT);
      CREATE TABLE project_accounts (scope TEXT, group_id TEXT);`);
    migrateSchema(db);
    const queryAll = (sql, args = []) => {
      const stmt = db.prepare(sql);
      try { stmt.bind(args); const rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); return rows; }
      finally { stmt.free(); }
    };
    const queryOne = (sql, args) => queryAll(sql, args)[0];
    const existingUser = queryOne('SELECT * FROM users WHERE email = ?', [email]);
    const user = existingUser || { id: crypto.randomUUID(), email, username: email.split('@')[0], password_salt: crypto.randomBytes(16).toString('base64') };
    if (!existingUser) user.password_hash = hashPassword(password, user.password_salt);
    if (!existingUser) db.run('INSERT INTO users (id, email, username, password_salt, password_hash) VALUES (?, ?, ?, ?, ?)', Object.values(user));
    let loggedIn = true;
    const getSession = () => {
      if (!loggedIn) throw new Error('not logged in');
      return { user, password, vaultId, deviceId, linked: true };
    };
    let notices = 0;
    const service = createChatService({ onUploaded: () => notices++, db, queryAll, queryOne, save: () => {}, getSession,
      getSettings: () => ({ folderToken: 'personal-folder', feishuPassphrase: 'cloud-passphrase' }),
      resolvePersonalFolder: async f => f,
      transport,
    });
    return { db, user, service, queryAll, queryOne, notices: () => notices, rebind: next => { rebindPersonalMessages(db, user.id, vaultId, next); vaultId = next; }, logout: () => { loggedIn = false; } };
  }
  const pages = [];
  const listed = await listAllFiles(async cursor => {
    pages.push(cursor);
    return cursor ? { files: [{ token: 'second', name: 'b' }], has_more: false } : { files: [{ token: 'first', name: 'a' }], has_more: true, next_page_token: 'next' };
  });
  assert.deepEqual(pages, ['', 'next']);
  assert.equal(listed.length, 2, 'history after the first folder page must remain visible');
  await assert.rejects(listAllFiles(async () => ({ files: [], has_more: true, next_page_token: 'same' })), /分页/);
  const personal = { scope: 'personal' };
  const a = device('alice@example.com', 'alice-vault', 'device-a');
  const b = device('alice@example.com', 'alice-vault', 'device-b', 'different-local-password');
  const outsider = device('bob@example.com', 'bob-vault', 'device-c');
  assert.throws(() => a.service.send({ ...personal, text: '  ' }), /内容/);
  assert.throws(() => a.service.send({ ...personal, text: 'x'.repeat(20001) }), /20000/);
  assert.throws(() => a.service.list({ scope: 'wrong' }), /空间/);
  const first = a.service.send({ ...personal, text: '跨设备文本\n第二行' });
  assert.equal(a.service.list(personal).messages[0].text, '跨设备文本\n第二行');
  assert.equal(a.service.list(personal).pending, 1);
  assert.ok(!Buffer.from(a.db.export()).includes(Buffer.from('跨设备文本')), 'SQLite must not contain plaintext message bodies');
  assert.equal(a.notices(), 0, 'local save alone must not notify peers');
  const live = a.service.encodeLiveText(first);
  assert.ok(!live.includes(first.text));
  assert.equal(b.service.receiveLiveText(live), true);
  assert.equal(b.service.receiveLiveText(live), false);
  assert.equal(a.service.unreadCounts().total, 0);
  assert.equal(b.service.unreadCounts().total, 1);
  const readThrough = b.service.list(personal).readThrough;
  assert.equal(b.service.markRead({ ...personal, readThrough }), true);
  assert.equal(b.service.unreadCounts().total, 0);
  assert.equal(b.service.list(personal).messages[0].text, first.text);
  assert.equal(b.service.list(personal).messages[0].synced, false);
  assert.equal(b.service.list(personal).pending, 0);
  assert.throws(() => outsider.service.receiveLiveText(live));
  await a.service.syncRoom(personal);
  assert.equal(a.notices(), 1, 'notify peers once the upload succeeds');
  assert.equal(a.service.list(personal).pending, 0);
  assert.ok([...files.values()].every(f => !f.bytes.includes(Buffer.from('跨设备文本'))), 'cloud must be encrypted');
  await b.service.syncRoom(personal);
  assert.equal(b.service.list(personal).messages.length, 1);
  assert.equal(b.service.list(personal).messages[0].synced, true);
  assert.equal(b.service.unreadCounts().total, 0, 'archive download must not mark a read live message unread again');
  b.service.send({ ...personal, text: '从 B 发送' });
  await b.service.syncRoom(personal);
  await a.service.syncRoom(personal);
  assert.equal(a.service.list(personal).messages.length, 2);
  assert.equal(b.service.list(personal).messages.length, 2);
  await b.service.syncRoom(personal);
  assert.equal(b.service.list(personal).messages.length, 2, 'repeated download must deduplicate');
  await outsider.service.syncRoom(personal);
  assert.equal(outsider.service.list(personal).messages.length, 0, 'other accounts must not read personal history');
  assert.equal(first.senderId, 'alice-vault', 'sender identity is stable across devices');
  const reopened = device('alice@example.com', 'alice-vault', 'reopened-device', 'local-password', a.db.export());
  assert.equal(reopened.service.list(personal).messages.length, 2, 'encrypted history survives reopening SQLite');
  assert.ok(reopened.service.list(personal).messages.some(message => message.text === '跨设备文本\n第二行'));
  failUpload = true;
  a.service.send({ ...personal, text: '离线消息' });
  const beforeFailure = a.notices();
  await assert.rejects(a.service.syncRoom(personal), /offline/);
  assert.equal(a.notices(), beforeFailure, 'failed uploads must not notify peers');
  assert.equal(a.service.list(personal).pending, 1);
  failUpload = false;
  await a.service.syncRoom(personal);
  await b.service.syncRoom(personal);
  assert.equal(b.service.list(personal).messages.length, 3, 'offline messages are retried');

  a.service.send({ ...personal, text: '响应丢失后重试' });
  failAfterUpload = true;
  await assert.rejects(a.service.syncRoom(personal), /ambiguous upload/);
  const countBeforeRetry = files.size;
  await a.service.syncRoom(personal);
  assert.equal(files.size, countBeforeRetry, 'an acknowledged-by-download batch must not be uploaded twice');
  assert.equal(a.service.list(personal).pending, 0);
  const group = groups.createGroup(a.db, () => {}, a.queryOne, a.user, 'local-password', { name: '项目群', feishuFolderToken: 'shared-folder' });
  const room = { scope: 'group', groupId: group.id };
  assert.throws(() => outsider.service.list(room), /无权/);
  const invite = a.service.exportInvite({ groupId: group.id, email: 'bob@example.com', role: 'member' });
  assert.throws(() => b.service.acceptInvite({ code: invite.code }), /账号/);
  outsider.service.acceptInvite({ code: invite.code });
  a.service.send({ ...room, text: 'Alice 的群消息' });
  outsider.service.send({ ...room, text: 'Bob 的群消息' });
  await Promise.all([a.service.syncRoom(room), outsider.service.syncRoom(room)]);
  await Promise.all([a.service.syncRoom(room), outsider.service.syncRoom(room)]);
  assert.deepEqual(outsider.service.list(room).messages.map(m => m.text).sort(), ['Alice 的群消息', 'Bob 的群消息']);
  assert.equal(a.service.list(room).messages.length, 2, 'concurrent group messages must survive');
  assert.equal(a.service.list(personal).messages.length, 4, 'group and personal history stay separate');
  assert.throws(() => outsider.service.exportInvite({ groupId: group.id, email: 'eve@example.com' }), /无权/);
  const viewer = device('viewer@example.com', 'viewer-vault', 'device-viewer');
  viewer.service.acceptInvite({ code: a.service.exportInvite({ groupId: group.id, email: 'viewer@example.com', role: 'viewer' }).code });
  assert.throws(() => viewer.service.send({ ...room, text: '不能发' }), /无权|只读/);
  await viewer.service.syncRoom(room);
  assert.equal(viewer.service.list(room).messages.length, 2);
  const noFolder = groups.createGroup(a.db, () => {}, a.queryOne, a.user, 'local-password', { name: '无文件夹' });
  assert.throws(() => a.service.exportInvite({ groupId: noFolder.id, email: 'bob@example.com' }), /共享文件夹/);
  assert.throws(() => outsider.service.acceptInvite({ code: 'broken' }), /邀请/);
  const [, encryptedInvite, inviteSecret] = invite.code.split('.');
  const secretBytes = Buffer.from(inviteSecret, 'base64url');
  const expired = JSON.parse(groupCrypto.decryptWithGroupKey(JSON.parse(Buffer.from(encryptedInvite, 'base64url').toString()), secretBytes));
  expired.expiresAt = '2000-01-01T00:00:00.000Z';
  const expiredCode = `axonchat1.${Buffer.from(JSON.stringify(groupCrypto.encryptWithGroupKey(Buffer.from(JSON.stringify(expired)), secretBytes))).toString('base64url')}.${inviteSecret}`;
  assert.throws(() => outsider.service.acceptInvite({ code: expiredCode }), /过期/);
  const changedCode = invite.code.slice(0, -4) + 'xxxx';
  assert.throws(() => outsider.service.acceptInvite({ code: changedCode }), /邀请/);

  const beforeLink = device('new@example.com', 'unlinked-vault', 'unlinked-device');
  beforeLink.service.send({ ...personal, text: '绑定云端之前的留言' });
  beforeLink.rebind('linked-vault');
  await beforeLink.service.syncRoom(personal);
  const afterLink = device('new@example.com', 'linked-vault', 'other-device');
  await afterLink.service.syncRoom(personal);
  assert.equal(afterLink.service.list(personal).messages[0].text, '绑定云端之前的留言');
  // Re-invitation must support group key rotation without rolling back a newer key.
  groups.rotateGroupKey(a.db, () => {}, a.queryOne, a.queryAll, a.user, 'local-password', group.id);
  const refreshed = a.service.exportInvite({ groupId: group.id, email: 'bob@example.com' });
  outsider.service.acceptInvite({ code: refreshed.code });
  outsider.service.send({ ...room, text: '轮换后的消息' });
  await outsider.service.syncRoom(room);
  await a.service.syncRoom(room);
  assert.ok(a.service.list(room).messages.some(m => m.text === '轮换后的消息'));
  assert.throws(() => outsider.service.acceptInvite({ code: invite.code }), /过旧|旧|不一致|不匹配/);
  // A foreign room's valid encrypted data must not be imported, even if its filename is disguised.
  const groupFile = [...files.values()].filter(f => f.folder === 'shared-folder').at(-1);
  const personalFile = [...files.values()].find(f => f.folder === 'personal-folder');
  const forgedToken = crypto.randomUUID();
  files.set(forgedToken, { ...personalFile, token: forgedToken, name: groupFile.name, folder: 'shared-folder' });
  const damaged = await a.service.syncRoom(room);
  assert.ok(damaged.errors.length, 'damaged or wrong-room files must be reported');
  assert.equal(a.service.list(room).messages.length, 3);
  files.delete(forgedToken);

  // Rotating while an upload is in flight must not acknowledge an old-key batch.
  a.service.send({ ...room, text: '轮换与发送同时发生' });
  afterUpload = () => {
    groups.rotateGroupKey(a.db, () => {}, a.queryOne, a.queryAll, a.user, 'local-password', group.id);
    a.db.run('UPDATE chat_messages SET outgoing = 1, synced_at = NULL WHERE group_id = ?', [group.id]);
  };
  await assert.rejects(a.service.syncRoom(room), /密钥|配置/);
  assert.ok(a.service.list(room).pending > 0);
  await a.service.syncRoom(room);
  const rotatedPeer = device('rotated@example.com', 'rotated-vault', 'rotated-device');
  rotatedPeer.service.acceptInvite({ code: a.service.exportInvite({ groupId: group.id, email: 'rotated@example.com' }).code });
  await rotatedPeer.service.syncRoom(room);
  assert.ok(rotatedPeer.service.list(room).messages.some(m => m.text === '轮换与发送同时发生'));
  // Async logout fences downloads before any local import.
  const fresh = device('alice@example.com', 'alice-vault', 'fresh-device');
  afterDownload = fresh.logout;
  await assert.rejects(fresh.service.syncRoom(personal), /登录|session|logged in/);
  assert.equal(fresh.queryAll('SELECT * FROM chat_messages').length, 0);
  const bulk = device('bulk@example.com', 'bulk-vault', 'bulk-device');
  for (let index = 0; index < 105; index++) bulk.service.send({ ...personal, text: index < 100 ? '\0'.repeat(20000) : `history ${index}` });
  bulk.db.run('UPDATE chat_messages SET created_at = ?', ['2026-11-10T01:00:00.000Z']);
  const latest = bulk.service.list(personal);
  assert.equal(latest.messages.length, 100);
  assert.equal(latest.hasMore, true);
  const oldest = latest.messages[0];
  const earlier = bulk.service.list({ ...personal, before: { createdAt: oldest.createdAt, id: oldest.id } });
  assert.equal(earlier.messages.length, 5);
  assert.equal(new Set([...earlier.messages, ...latest.messages].map(m => m.id)).size, 105, 'pagination must not lose messages with identical timestamps');
  const firstSync = bulk.service.syncRoom(personal);
  assert.equal(bulk.service.syncRoom(personal), firstSync, 'simultaneous syncs of a room must share one operation');
  await firstSync;
  const bulkPeer = device('bulk@example.com', 'bulk-vault', 'bulk-peer');
  await bulkPeer.service.syncRoom(personal);
  assert.equal(bulkPeer.queryAll('SELECT * FROM chat_messages').length, 105, 'multiple immutable batches must all be downloaded');
  console.log('Chat tests passed: encrypted persistence, multi-device merge, group peers, permissions, retries and session isolation.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
