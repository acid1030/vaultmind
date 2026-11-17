const crypto = require('crypto');
const localCrypto = require('../services/crypto');
const groupCrypto = require('./group-crypto');

const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function safeName(name) {
  const result = String(name || '附件').split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, '_').slice(0, 200);
  return !result || result === '.' || result === '..' ? '附件' : result;
}
function imageMime(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return '';
}
function metadata(file, requireToken = false) {
  if (!file || !UUID.test(file.id) || typeof file.name !== 'string' || !file.name || safeName(file.name) !== file.name
    || !Number.isInteger(file.size) || file.size < 0 || file.size > MAX_ATTACHMENT_BYTES
    || !['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/octet-stream'].includes(file.mime)
    || typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)
    || (requireToken && (typeof file.fileToken !== 'string' || !file.fileToken || file.fileToken.length > 256))) throw new Error('聊天附件信息无效');
  return { id: file.id, name: file.name, size: file.size, mime: file.mime, sha256: file.sha256, ...(file.fileToken ? { fileToken: file.fileToken } : {}) };
}
function fingerprint(attachments = []) {
  return JSON.stringify(attachments.map(file => { const { fileToken, ...rest } = metadata(file); return rest; }));
}
function encryptBlob(bytes, context) {
  let key = context.key;
  let kdf;
  if (context.scope === 'personal') {
    const salt = crypto.randomBytes(16);
    key = localCrypto.deriveVaultKey(context.key, salt);
    kdf = { salt: salt.toString('base64'), iterations: localCrypto.KEY_ITERATIONS };
  }
  return Buffer.from(JSON.stringify({ version: 1, kind: 'chat-blob', scope: context.scope, ...(kdf ? { kdf } : {}), ...groupCrypto.encryptWithGroupKey(bytes, key) }));
}
function decryptBlob(bytes, context, attachment) {
  if (bytes.length > 18 * 1024 * 1024) throw new Error('聊天附件文件过大');
  const payload = JSON.parse(bytes.toString('utf8'));
  if (payload.version !== 1 || payload.kind !== 'chat-blob' || payload.scope !== context.scope) throw new Error('聊天附件格式不匹配');
  let key = context.key;
  if (context.scope === 'personal') {
    if (payload.kdf?.iterations !== localCrypto.KEY_ITERATIONS || typeof payload.kdf.salt !== 'string' || Buffer.from(payload.kdf.salt, 'base64').length !== 16) throw new Error('附件加密参数无效');
    key = localCrypto.deriveVaultKey(context.key, Buffer.from(payload.kdf.salt, 'base64'));
  }
  const plain = groupCrypto.decryptWithGroupKey(payload, key);
  if (plain.length !== attachment.size || hash(plain) !== attachment.sha256) throw new Error('附件校验失败，文件可能已损坏');
  return plain;
}

function createAttachmentStore({ db, queryOne, queryAll, save, session, room, contentKey, decode, persistBody, resolveCloud, transport, fence }) {
  const drafts = new Map();
  let draftSession = '';
  const downloads = new Map();
  function clearDrafts() {
    for (const value of drafts.values()) value.bytes.fill(0);
    drafts.clear();
    draftSession = '';
  }
  function checkDraftSession(s) {
    const key = `${s.user.id}:${s.epoch || 0}`;
    if (draftSession !== key) { clearDrafts(); draftSession = key; }
  }
  function stageAttachments(input) {
    const s = session(), r = room(input, s, true);
    checkDraftSession(s);
    if (!Array.isArray(input.files) || !input.files.length || input.files.length > MAX_ATTACHMENTS || drafts.size + input.files.length > 20) throw new Error('一次最多选择 5 个附件，请先发送或移除已有附件');
    const files = input.files.map(file => {
      if (!Buffer.isBuffer(file.bytes) || file.bytes.length > MAX_ATTACHMENT_BYTES) throw new Error('单个附件大小不能超过 12MB');
      return { id: crypto.randomUUID(), name: safeName(file.name), size: file.bytes.length,
        mime: imageMime(file.bytes) || 'application/octet-stream', sha256: hash(file.bytes), bytes: Buffer.from(file.bytes), roomId: r.localId };
    });
    for (const file of files) drafts.set(file.id, file);
    return files.map(({ bytes, roomId, ...info }) => info);
  }
  function discardAttachments(input) {
    const s = session(); checkDraftSession(s);
    for (const id of Array.isArray(input.ids) ? input.ids : []) { drafts.get(id)?.bytes.fill(0); drafts.delete(id); }
  }
  function take(ids, s, r) {
    checkDraftSession(s);
    if (!Array.isArray(ids) || ids.length > MAX_ATTACHMENTS || new Set(ids).size !== ids.length) throw new Error('每条消息最多 5 个附件');
    return ids.map(id => { const file = drafts.get(id); if (!file || file.roomId !== r.localId) throw new Error('附件已失效或不属于当前聊天空间，请重新添加'); return file; });
  }
  function readDraftAttachment(input) {
    const s = session(), r = room(input, s, true);
    const file = take([input.attachmentId], s, r)[0];
    return { ...metadata(file), bytes: Buffer.from(file.bytes) };
  }
  function rowFor(s, r, id) {
    return queryOne('SELECT * FROM chat_attachments WHERE owner_user_id = ? AND room_id = ? AND id = ?', [s.user.id, r.localId, id]);
  }
  function cache(file, bytes, s, r) {
    const encrypted = groupCrypto.encryptWithGroupKey(bytes, contentKey(s));
    db.run('UPDATE chat_attachments SET content_ciphertext = ?, content_iv = ?, content_tag = ? WHERE owner_user_id = ? AND room_id = ? AND id = ?',
      [encrypted.ciphertext, encrypted.iv, encrypted.tag, s.user.id, r.localId, file.id]);
  }
  function attachDrafts(message, files, s, r) {
    for (const file of files) {
      db.run('INSERT INTO chat_attachments (owner_user_id, room_id, id, message_id) VALUES (?, ?, ?, ?)', [s.user.id, r.localId, file.id, message.id]);
      cache(file, file.bytes, s, r);
    }
  }
  function commitDrafts(files) {
    for (const file of files) { file.bytes.fill(0); drafts.delete(file.id); }
  }
  function registerRemote(message, s, r, context) {
    for (const file of message.attachments || []) {
      const existing = rowFor(s, r, file.id);
      if (existing && existing.message_id !== message.id) throw new Error('附件所属消息不匹配');
      db.run('INSERT OR IGNORE INTO chat_attachments (owner_user_id, room_id, id, message_id) VALUES (?, ?, ?, ?)', [s.user.id, r.localId, file.id, message.id]);
      db.run('UPDATE chat_attachments SET file_token = ?, upload_target = ? WHERE owner_user_id = ? AND room_id = ? AND id = ?', [file.fileToken, context.target, s.user.id, r.localId, file.id]);
    }
  }
  async function fetchFile(input, s, r, providedContext) {
    const messageRow = queryOne('SELECT * FROM chat_messages WHERE owner_user_id = ? AND room_id = ? AND id = ?', [s.user.id, r.localId, String(input.messageId || '')]);
    if (!messageRow) throw new Error('找不到该聊天消息');
    const message = decode(messageRow, s);
    const file = message.attachments?.find(item => item.id === input.attachmentId);
    if (!file) throw new Error('找不到该消息的附件');
    const cached = rowFor(s, r, file.id);
    if (cached?.content_ciphertext != null) return { attachment: file, bytes: groupCrypto.decryptWithGroupKey(cached, contentKey(s)) };
    if (!file.fileToken) throw new Error('附件尚未上传，请在发送设备同步后重试');
    const context = providedContext || await resolveCloud(input, s, r);
    context.check();
    const encrypted = await transport.download(file.fileToken);
    context.check();
    const bytes = decryptBlob(encrypted, context, file);
    cache(file, bytes, s, r);
    save();
    return { attachment: file, bytes };
  }
  function getAttachment(input) {
    const s = session(), r = room(input, s);
    const id = `${s.user.id}:${s.epoch || 0}:${r.localId}:${input.messageId}:${input.attachmentId}`;
    if (downloads.has(id)) return downloads.get(id);
    const promise = fetchFile(input, s, r).finally(() => downloads.delete(id));
    downloads.set(id, promise);
    return promise;
  }
  async function uploadForMessage(message, s, r, context, cloudFiles) {
    if (!message.attachments?.length) return message;
    const attachments = [];
    for (const raw of message.attachments || []) {
      const file = metadata(raw);
      context.check();
      const cached = rowFor(s, r, file.id);
      let token;
      if (cached?.upload_target === context.target && cached.file_token && cloudFiles.some(item => item.token === cached.file_token)) token = cached.file_token;
      else {
        const local = await fetchFile({ scope: r.scope, groupId: r.groupId, messageId: message.id, attachmentId: file.id }, s, r, context);
        context.check();
        room({ scope: r.scope, groupId: r.groupId }, s, true);
        const name = `${context.prefix}blob-${file.id}.axonchatblob`;
        for (const existing of cloudFiles.filter(item => item.name === name)) {
          try { const bytes = await transport.download(existing.token); context.check(); decryptBlob(bytes, context, file); token = existing.token; break; }
          catch { context.check(); }
        }
        if (!token) {
          const encrypted = encryptBlob(local.bytes, context);
          const uploaded = await transport.upload(context.folder, name, encrypted);
          context.check();
          room({ scope: r.scope, groupId: r.groupId }, s, true);
          if (!uploaded?.file_token) throw new Error('飞书未返回附件文件 Token');
          token = uploaded.file_token;
          cloudFiles.push({ token, name });
        }
        db.run('UPDATE chat_attachments SET file_token = ?, upload_target = ? WHERE owner_user_id = ? AND room_id = ? AND id = ?', [token, context.target, s.user.id, r.localId, file.id]);
      }
      attachments.push({ ...file, fileToken: token });
    }
    const updated = { ...message, attachments };
    if (attachments.length) { persistBody(updated, s, r); save(); }
    return updated;
  }
  async function prepareGroupRotation(groupId, finalize = () => {}) {
    const s = session(), input = { scope: 'group', groupId }, r = room(input, s, true);
    const context = await resolveCloud(input, s, r);
    // Downloads yield to sync imports. Rescan until every attachment visible
    // in this database is cached, then rotate synchronously without yielding.
    for (;;) {
      context.check();
      const pending = [];
      for (const row of queryAll('SELECT * FROM chat_messages WHERE owner_user_id = ? AND room_id = ?', [s.user.id, r.localId])) {
        for (const attachment of decode(row, s).attachments || []) {
          if (rowFor(s, r, attachment.id)?.content_ciphertext == null) pending.push({ messageId: row.id, attachmentId: attachment.id });
        }
      }
      if (!pending.length) { context.check(); fence(s); return finalize(); }
      for (const attachment of pending) {
        await fetchFile({ ...input, ...attachment }, s, r, context);
        context.check();
      }
    }
  }

  return { stageAttachments, discardAttachments, take, attachDrafts, commitDrafts, registerRemote, uploadForMessage, getAttachment, prepareGroupRotation, clearDrafts, readDraftAttachment };
}
module.exports = { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS, safeName, imageMime, metadata, fingerprint, encryptBlob, decryptBlob, createAttachmentStore };
