#!/usr/bin/env node
const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const initSqlJs = require('sql.js');
const { migrateSchema } = require('../src/core/schema');
const groupService = require('../src/core/groups');
const groupCrypto = require('../src/core/group-crypto');
const inviteCrypto = require('../src/core/invite-crypto');
const searchService = require('../src/core/search');
const manifestService = require('../src/core/manifest-sync');
const feishuDrive = require('../src/core/feishu-drive');

const LOCAL_KEY_ITERATIONS = 180000;

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, Buffer.from(salt, 'base64'), LOCAL_KEY_ITERATIONS, 32, 'sha256').toString('base64');
}

function deriveContentKey(password, saltBase64) {
  return crypto.pbkdf2Sync(password, Buffer.from(saltBase64, 'base64'), LOCAL_KEY_ITERATIONS, 32, 'sha256');
}

function encryptForUser(bytes, password, user) {
  const iv = crypto.randomBytes(12);
  const key = deriveContentKey(password, user.password_salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

async function main() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  migrateSchema(db);
  db.run(`
    CREATE TABLE IF NOT EXISTS library_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      content_ciphertext TEXT NOT NULL,
      content_iv TEXT NOT NULL,
      content_tag TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      scope TEXT DEFAULT 'personal',
      group_id TEXT,
      created_by TEXT,
      tags TEXT,
      updated_at TEXT,
      remote_only INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      local_path TEXT,
      file_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      token TEXT NOT NULL,
      url TEXT,
      uploaded_at TEXT NOT NULL,
      algorithm TEXT NOT NULL,
      kind TEXT NOT NULL,
      scope TEXT DEFAULT 'personal',
      group_id TEXT,
      created_by TEXT,
      asset_id TEXT
    );
    CREATE TABLE IF NOT EXISTS project_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      label TEXT NOT NULL,
      username TEXT,
      secret_ciphertext TEXT NOT NULL,
      secret_iv TEXT NOT NULL,
      secret_tag TEXT NOT NULL,
      created_at TEXT NOT NULL,
      scope TEXT DEFAULT 'personal',
      group_id TEXT,
      created_by TEXT
    );
  `);

  const saveDatabase = () => {};
  const queryOne = (sql, params = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  };
  const queryAll = (sql, params = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  };

  const saltA = crypto.randomBytes(16).toString('base64');
  const saltB = crypto.randomBytes(16).toString('base64');
  const userA = {
    id: 'user-a',
    email: 'alice@test.local',
    username: 'Alice',
    password_salt: saltA,
    password_hash: hashPassword('password-a', saltA),
    created_at: new Date().toISOString(),
  };
  const userB = {
    id: 'user-b',
    email: 'bob@test.local',
    username: 'Bob',
    password_salt: saltB,
    password_hash: hashPassword('password-b', saltB),
    created_at: new Date().toISOString(),
  };
  db.run('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)', [userA.id, userA.email, userA.username, userA.password_salt, userA.password_hash, userA.created_at]);
  db.run('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)', [userB.id, userB.email, userB.username, userB.password_salt, userB.password_hash, userB.created_at]);

  groupService.createGroup(db, saveDatabase, queryOne, userA, 'password-a', { name: '测试组' });
  const group = queryOne('SELECT * FROM groups LIMIT 1');
  assert(group, 'group created');

  groupService.inviteToGroup(db, saveDatabase, queryOne, queryAll, userA, 'password-a', {
    groupId: group.id,
    email: userB.email,
    role: 'member',
  });
  const accepted = groupService.processPendingInvitesForUser(db, saveDatabase, queryOne, queryAll, userB, 'password-b');
  assert.equal(accepted.length, 1, 'bob should join group');

  const gk = groupService.getGroupKeyForUser(db, queryOne, group.id, userB.id, userB, 'password-b');
  assert.equal(gk.length, 32, 'group key length');

  const plain = Buffer.from('team-secret', 'utf8');
  const enc = groupCrypto.encryptWithGroupKey(plain, gk);
  const dec = groupCrypto.decryptWithGroupKey(enc, gk);
  assert.equal(dec.toString('utf8'), 'team-secret');

  const sealed = inviteCrypto.sealGroupKeyForInvite(gk, 'new@test.local', group.id);
  const opened = inviteCrypto.openGroupKeyFromInvite(sealed, 'new@test.local', group.id);
  assert.ok(opened.equals(gk), 'invite seal roundtrip');

  db.run(`INSERT INTO library_items
    (id, user_id, kind, title, url, content_ciphertext, content_iv, content_tag, size, created_at, scope, group_id, created_by, tags, updated_at, remote_only)
    VALUES ('item-1', ?, 'secret', '生产密钥', '', 'x', 'y', 'z', 10, ?, 'personal', NULL, ?, '', ?, 0)`, [
    userA.id, new Date().toISOString(), userA.id, new Date().toISOString(),
  ]);
  searchService.indexAsset(db, {
    assetId: 'item-1',
    ownerUserId: userA.id,
    scope: 'personal',
    groupId: '',
    kind: 'secret',
    sourceTable: 'library_items',
    title: '生产密钥',
    tags: 'prod api',
  });
  const hits = searchService.searchLocalAssets(db, queryAll, userA.id, '生产', { scope: 'personal', groupId: '' });
  assert.ok(hits.length >= 1, 'fts should find item');

  const localManifest = manifestService.buildManifestEntries(db, queryAll, userA.id, 'personal', '');
  const remoteManifest = {
    ...localManifest,
    items: [...localManifest.items, {
      id: 'remote-item',
      kind: 'text',
      title: '远端文档',
      url: '',
      size: 0,
      tags: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'library_items',
      remoteOnly: true,
    }],
  };
  const merged = manifestService.mergeManifests(localManifest, remoteManifest);
  assert.ok(merged.items.some((i) => i.id === 'remote-item'), 'merge keeps remote item');

  const files = feishuDrive.parseListFilesResponse({
    data: { files: [{ token: 'tok1', name: 'vaultmind-user-x.axonvault' }] },
  });
  assert.equal(files[0].token, 'tok1');
  assert.ok(feishuDrive.findManifestFile(files, 'vaultmind-user-x.axonvault'));

  const rotate = groupService.rotateGroupKey(db, saveDatabase, queryOne, queryAll, userA, 'password-a', group.id);
  assert.ok(rotate.keyVersion >= 2);
  assert.ok(rotate.needsReinvite.includes(userB.id));

  console.log('All core tests passed.');
}

main().catch((error) => {
  console.error('TEST FAILED:', error);
  process.exit(1);
});
