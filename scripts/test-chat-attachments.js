const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const initSqlJs = require('sql.js');
const { createChatService, rebindPersonalMessages } = require('../src/core/chat');
const { migrateSchema } = require('../src/core/schema');
const local = require('../src/services/crypto');
const groups = require('../src/core/groups');
const { MAX_ATTACHMENT_BYTES, encryptBlob, decryptBlob } = require('../src/core/chat-attachments');

async function main() {
  const SQL = await initSqlJs();
  const files = new Map();
  let downloads = 0;
  let failBlob = false;
  let failBatch = false;
  let afterDownload;
  const transport = {
    list: async folder => [...files.values()].filter(file => file.folder === folder),
    upload: async (folder, name, bytes) => {
      if ((failBlob && name.endsWith('.axonchatblob')) || (failBatch && name.endsWith('.axonchat'))) throw new Error('offline');
      const token = crypto.randomUUID();
      files.set(token, { token, name, folder, bytes });
      return { file_token: token };
    },
    download: async token => { downloads++; if (afterDownload) { const callback = afterDownload; afterDownload = null; await callback(); } return files.get(token).bytes; },
  };
  function device(email, vaultId, id) {
    const db = new SQL.Database();
    db.run(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, username TEXT, password_salt TEXT, password_hash TEXT);
      CREATE TABLE app_state (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE library_items (scope TEXT, group_id TEXT);
      CREATE TABLE project_accounts (scope TEXT, group_id TEXT);`);
    migrateSchema(db);
    const all = (sql, args = []) => { const st = db.prepare(sql); try { st.bind(args); const rows = []; while (st.step()) rows.push(st.getAsObject()); return rows; } finally { st.free(); } };
    const one = (sql, args) => all(sql, args)[0];
    const password = `password-${id}`;
    const user = { id: crypto.randomUUID(), email, username: id, password_salt: crypto.randomBytes(16).toString('base64') };
    user.password_hash = local.hashPassword(password, user.password_salt);
    db.run('INSERT INTO users (id,email,username,password_salt,password_hash) VALUES (?,?,?,?,?)', Object.values(user));
    let epoch = 0;
    const service = createChatService({ db, queryOne: one, queryAll: all, save: () => {}, transport,
      getSession: () => ({ user, password, vaultId, deviceId: id, linked: true, epoch }),
      getSettings: () => ({ folderToken: 'personal', feishuPassphrase: 'shared-cloud-password' }), resolvePersonalFolder: async folder => folder });
    return { db, service, user, password, all, one, changeSession: () => epoch++,
      rebind: next => { rebindPersonalMessages(db, user.id, vaultId, next); vaultId = next; } };
  }
  const room = { scope: 'personal' };
  const a = device('alice@example.com', 'alice-vault', 'a');
  const b = device('alice@example.com', 'alice-vault', 'b');
  const outsider = device('bob@example.com', 'bob-vault', 'bob');
  const bytes = Buffer.from('private file content\nwith binary\0data');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=', 'base64');
  assert.throws(() => a.service.stageAttachments({ ...room, files: [{ name: 'big.bin', bytes: Buffer.alloc(MAX_ATTACHMENT_BYTES + 1) }] }), /12|大小/);
  assert.throws(() => a.service.stageAttachments({ ...room, files: Array.from({ length: 6 }, () => ({ name: 'x', bytes })) }), /5/);
  const draftOwner = device('draft@example.com', 'draft-vault', 'draft-owner');
  const staleDraft = draftOwner.service.stageAttachments({ ...room, files: [{ name: 'stale.txt', bytes }] });
  draftOwner.changeSession();
  assert.throws(() => draftOwner.service.send({ ...room, text: '', attachmentIds: staleDraft.map(file => file.id) }), /附件/);
  const zero = draftOwner.service.stageAttachments({ ...room, files: [{ name: 'empty.txt', bytes: Buffer.alloc(0) }, { name: 'not-a-preview.svg', bytes: Buffer.from('<svg></svg>') }] });
  assert.equal(zero[1].mime, 'application/octet-stream', 'SVG must remain a file, never a script-capable preview');
  draftOwner.service.send({ ...room, text: '', attachmentIds: zero.map(file => file.id) });
  await draftOwner.service.syncRoom(room);
  const staged = a.service.stageAttachments({ ...room, files: [{ name: '../private.txt', bytes }, { name: '截图.png', bytes: png }] });
  assert.equal(staged[0].name, 'private.txt');
  assert.equal(staged[1].mime, 'image/png');
  assert.equal(a.service.list(room).messages.length, 0, 'staging must not send');
  const message = a.service.send({ ...room, text: '', attachmentIds: staged.map(file => file.id) });
  assert.equal(message.attachments.length, 2);
  assert.equal(a.service.list(room).messages[0].attachments[0].name, 'private.txt');
  assert.ok(!Buffer.from(a.db.export()).includes(bytes));
  assert.ok(!Buffer.from(a.db.export()).includes(Buffer.from('private.txt')), 'metadata should be encrypted too');
  assert.equal((await a.service.getAttachment({ ...room, messageId: message.id, attachmentId: staged[0].id })).bytes.equals(bytes), true);
  assert.throws(() => a.service.send({ ...room, text: '', attachmentIds: [staged[0].id] }), /附件/);
  const batchesBeforeFailure = [...files.values()].filter(file => file.name.endsWith('.axonchat')).length;
  failBlob = true;
  await assert.rejects(a.service.syncRoom(room), /offline/);
  assert.equal([...files.values()].filter(file => file.name.endsWith('.axonchat')).length, batchesBeforeFailure, 'never publish a message before its binary files');
  failBlob = false;
  failBatch = true;
  await assert.rejects(a.service.syncRoom(room), /offline/);
  const blobCount = [...files.values()].filter(file => file.folder === 'personal' && file.name.endsWith('.axonchatblob')).length;
  assert.equal(blobCount, 4);
  failBatch = false;
  await a.service.syncRoom(room);
  assert.equal([...files.values()].filter(file => file.name.endsWith('.axonchatblob')).length, blobCount, 'batch retry must reuse uploaded blobs');
  assert.ok([...files.values()].every(file => !file.bytes.includes(bytes)));
  await b.service.syncRoom(room);
  const received = b.service.list(room).messages[0];
  assert.equal(received.attachments.length, 2);
  assert.ok(!JSON.stringify(received).includes(bytes.toString('base64')), 'history must not inline binary payloads');
  const prior = downloads;
  const fetched = await b.service.getAttachment({ ...room, messageId: message.id, attachmentId: staged[0].id });
  assert.ok(fetched.bytes.equals(bytes));
  assert.equal(downloads, prior + 1, 'attachment is fetched lazily');
  await b.service.getAttachment({ ...room, messageId: message.id, attachmentId: staged[0].id });
  assert.equal(downloads, prior + 1, 'downloaded attachments use the encrypted local cache');
  await assert.rejects(outsider.service.getAttachment({ ...room, messageId: message.id, attachmentId: staged[0].id }), /消息|附件/);
  const imageRef = received.attachments[1];
  const imageCloud = files.get(imageRef.fileToken);
  const originalEncrypted = imageCloud.bytes;
  imageCloud.bytes = Buffer.from('damaged');
  await assert.rejects(b.service.getAttachment({ ...room, messageId: message.id, attachmentId: imageRef.id }));
  assert.equal(b.one('SELECT content_ciphertext FROM chat_attachments WHERE owner_user_id = ? AND id = ?', [b.user.id, imageRef.id]).content_ciphertext, null, 'corrupt cloud data must not enter the cache');
  imageCloud.bytes = originalEncrypted;
  assert.ok((await b.service.getAttachment({ ...room, messageId: message.id, attachmentId: imageRef.id })).bytes.equals(png));
  const fresh = device('alice@example.com', 'alice-vault', 'fresh');
  await fresh.service.syncRoom(room);
  afterDownload = fresh.changeSession;
  await assert.rejects(fresh.service.getAttachment({ ...room, messageId: message.id, attachmentId: staged[0].id }), /登录/);

  const group = groups.createGroup(a.db, () => {}, a.one, a.user, a.password, { name: '附件群', feishuFolderToken: 'shared' });
  const groupRoom = { scope: 'group', groupId: group.id };
  outsider.service.acceptInvite({ code: a.service.exportInvite({ groupId: group.id, email: 'bob@example.com' }).code });
  const gf = a.service.stageAttachments({ ...groupRoom, files: [{ name: '组内文件.txt', bytes }] });
  const gm = a.service.send({ ...groupRoom, text: '组共享文件', attachmentIds: gf.map(file => file.id) });
  await a.service.syncRoom(groupRoom);
  await outsider.service.syncRoom(groupRoom);
  const gb = await outsider.service.getAttachment({ ...groupRoom, messageId: gm.id, attachmentId: gf[0].id });
  assert.ok(gb.bytes.equals(bytes));
  const viewer = device('viewer@example.com', 'viewer-vault', 'viewer');
  viewer.service.acceptInvite({ code: a.service.exportInvite({ groupId: group.id, email: 'viewer@example.com', role: 'viewer' }).code });
  assert.throws(() => viewer.service.stageAttachments({ ...groupRoom, files: [{ name: 'no.txt', bytes }] }), /无权/);
  const wrongRoomDraft = a.service.stageAttachments({ ...room, files: [{ name: 'wrong.txt', bytes }] });
  assert.throws(() => a.service.send({ ...groupRoom, text: '', attachmentIds: wrongRoomDraft.map(file => file.id) }), /附件|空间/);
  a.service.discardAttachments({ ids: wrongRoomDraft.map(file => file.id) });

  // A receiver with no cached binary must hydrate old-key attachments before rotating.
  await viewer.service.syncRoom(groupRoom);
  const otherDraft = outsider.service.stageAttachments({ ...groupRoom, files: [{ name: '来自另一端.txt', bytes }] });
  outsider.service.send({ ...groupRoom, text: '触发旋转预下载', attachmentIds: otherDraft.map(file => file.id) });
  await outsider.service.syncRoom(groupRoom);
  await a.service.syncRoom(groupRoom);
  let lateMessage;
  let lateAttachment;
  afterDownload = async () => {
    const late = outsider.service.stageAttachments({ ...groupRoom, files: [{ name: '下载期间新增.txt', bytes }] });
    lateAttachment = late[0];
    lateMessage = outsider.service.send({ ...groupRoom, text: '下载期间同步进来的消息', attachmentIds: late.map(file => file.id) });
    await outsider.service.syncRoom(groupRoom);
    await a.service.syncRoom(groupRoom);
  };
  let finalized = false;
  await a.service.prepareGroupRotation(group.id, () => {
    assert.ok(a.one('SELECT content_ciphertext FROM chat_attachments WHERE owner_user_id = ? AND id = ?', [a.user.id, lateAttachment.id]).content_ciphertext,
      'attachments imported during hydration must be cached before changing the key');
    groups.rotateGroupKey(a.db, () => {}, a.one, a.all, a.user, a.password, group.id);
    a.db.run('UPDATE chat_messages SET synced_at = NULL, outgoing = 1 WHERE group_id = ?', [group.id]);
    finalized = true;
  });
  assert.equal(finalized, true, 'rotation must execute in the same synchronous turn as the final cache completeness check');
  await a.service.syncRoom(groupRoom);
  viewer.service.acceptInvite({ code: a.service.exportInvite({ groupId: group.id, email: 'viewer@example.com', role: 'viewer' }).code });
  await viewer.service.syncRoom(groupRoom);
  const rotated = await viewer.service.getAttachment({ ...groupRoom, messageId: gm.id, attachmentId: gf[0].id });
  assert.ok(rotated.bytes.equals(bytes), 'duplicate message IDs must refresh rekeyed attachment references');
  assert.ok((await viewer.service.getAttachment({ ...groupRoom, messageId: lateMessage.id, attachmentId: lateAttachment.id })).bytes.equals(bytes));
  a.rebind('new-vault');
  await a.service.syncRoom(room);
  const linkedPeer = device('alice@example.com', 'new-vault', 'linked-peer');
  await linkedPeer.service.syncRoom(room);
  assert.ok((await linkedPeer.service.getAttachment({ ...room, messageId: message.id, attachmentId: staged[0].id })).bytes.equals(bytes));
  const maximum = Buffer.alloc(MAX_ATTACHMENT_BYTES, 0x5a);
  const maximumMeta = { size: maximum.length, sha256: crypto.createHash('sha256').update(maximum).digest('hex') };
  for (const context of [{ scope: 'personal', key: 'max-file-cloud-password' }, { scope: 'group', key: crypto.randomBytes(32) }]) {
    const encrypted = encryptBlob(maximum, context);
    assert.ok(encrypted.length < 20 * 1024 * 1024, 'a 12MiB raw attachment must fit Feishu direct-upload limits after encryption');
    assert.ok(decryptBlob(encrypted, context, maximumMeta).equals(maximum));
  }
  console.log('Chat attachment tests passed: encrypted binaries, lazy downloads, retries, permissions, session fences, rotation and rebinding.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
