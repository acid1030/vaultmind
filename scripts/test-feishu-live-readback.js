#!/usr/bin/env node
// Opt-in, read-only cloud verification. Never writes to the user's database or cloud.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const initSqlJs = require('sql.js');
const { migrateSchema } = require('../src/core/schema');
const { createChatService } = require('../src/core/chat');
const { listAllFiles } = require('../src/core/feishu-drive');
async function main() {
  const [sourcePath, fixtures] = process.argv.slice(2);
  if (!sourcePath || !fixtures) throw new Error('Usage: node scripts/test-feishu-live-readback.js DATABASE FIXTURE_DIRECTORY');
  const SQL = await initSqlJs();
  const source = new SQL.Database(fs.readFileSync(sourcePath));
  const rows = (db, sql, params = []) => {
    const stmt = db.prepare(sql); try { stmt.bind(params); const result = []; while (stmt.step()) result.push(stmt.getAsObject()); return result; } finally { stmt.free(); }
  };
  const state = key => JSON.parse(rows(source, 'SELECT value FROM app_state WHERE key = ?', [key])[0]?.value || 'null');
  const settings = state('settings');
  const token = state('feishuToken');
  const original = rows(source, 'SELECT * FROM users WHERE cloud_linked = 1')[0];
  assert.ok(original && token?.accessToken && settings?.feishuPassphrase, 'Requires a linked and authorized source profile');
  source.close();
  let downloads = 0;
  const request = async (route, binary = false) => {
    const response = await fetch(`https://open.feishu.cn${route}`, { headers: { Authorization: `Bearer ${token.accessToken}` }, signal: AbortSignal.timeout(30000) });
    assert.ok(response.ok, `Feishu HTTP ${response.status}`);
    if (binary) { downloads++; return Buffer.from(await response.arrayBuffer()); }
    const json = await response.json(); assert.equal(json.code || 0, 0, `Feishu API code ${json.code}`); return json;
  };
  const root = (await request('/open-apis/drive/explorer/v2/root_folder/meta')).data.token;
  const folder = settings.folderToken && settings.folderToken !== 'root' ? settings.folderToken : root;
  const db = new SQL.Database();
  db.run('CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, username TEXT, password_salt TEXT, password_hash TEXT); CREATE TABLE app_state (key TEXT PRIMARY KEY, value TEXT); CREATE TABLE library_items (scope TEXT, group_id TEXT); CREATE TABLE project_accounts (scope TEXT, group_id TEXT);');
  migrateSchema(db);
  const user = { id: crypto.randomUUID(), email: original.email, username: 'isolated-readback', password_salt: crypto.randomBytes(16).toString('base64'), password_hash: '' };
  db.run('INSERT INTO users (id,email,username,password_salt,password_hash) VALUES (?,?,?,?,?)', Object.values(user));
  const session = { user, password: crypto.randomBytes(24).toString('hex'), vaultId: original.vault_id, deviceId: crypto.randomUUID(), linked: true };
  const service = createChatService({ db, queryAll: (sql, args) => rows(db, sql, args), queryOne: (sql, args) => rows(db, sql, args)[0], save: () => {}, getSession: () => session, getSettings: () => ({ folderToken: folder, feishuPassphrase: settings.feishuPassphrase }), resolvePersonalFolder: async () => folder,
    transport: {
      list: async () => listAllFiles(cursor => request(`/open-apis/drive/v1/files?folder_token=${encodeURIComponent(folder)}&page_size=200${cursor ? `&page_token=${encodeURIComponent(cursor)}` : ''}`)),
      download: value => request(`/open-apis/drive/v1/files/${encodeURIComponent(value)}/download`, true),
      upload: async () => { throw new Error('Live readback forbids uploads'); },
    },
  });
  const room = { scope: 'personal' };
  const sync = await service.syncRoom(room);
  assert.deepEqual(sync.errors, []);
  const messages = service.list(room).messages;
  const message = messages.find(item => item.text.includes('MZ-20261110-LIVE'));
  assert.ok(message, 'Fresh receiver must recover the marked test message from cloud');
  assert.equal(message.attachments.length, 2);
  for (const attachment of message.attachments) {
    assert.ok(['验收测试说明.txt', '验收测试图片.png'].includes(attachment.name));
    const actual = await service.getAttachment({ ...room, messageId: message.id, attachmentId: attachment.id });
    assert.deepEqual(actual.bytes, fs.readFileSync(path.join(fixtures, attachment.name)), 'Cloud attachment must match fixture byte-for-byte');
  }
  await service.syncRoom(room);
  assert.equal(service.list(room).messages.length, messages.length, 'Repeated sync must not duplicate messages');
  db.close();
  console.log(JSON.stringify({ passed: true, freshReceiver: true, cloudDownloads: downloads, recoveredMessages: messages.length, attachmentsByteIdentical: 2, repeatSyncDeduplicated: true, cloudWrites: 0 }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
