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
const cloudAccount = require('../src/core/cloud-account');
const feishuDrive = require('../src/core/feishu-drive');
const feishuWiki = require('../src/core/feishu-wiki');
const knowledgeHints = require('../src/core/knowledge-hints');
const llmFallback = require('../src/core/llm-fallback');
const knowledgeSafety = require('../src/core/knowledge-safety');
const extractContent = require('../src/core/extract-content');
const syncAccess = require('../src/core/sync-access');

const LOCAL_KEY_ITERATIONS = 180000;

function createTestPdf(text) {
  const content = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let output = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) output += `${String(offset).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output);
}

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
  assert.equal(syncAccess.normalizeMode(undefined, { appId: 'legacy-app' }), 'personal', 'legacy credentials migrate to personal mode');
  assert.equal(syncAccess.normalizeMode(undefined, {}), 'managed', 'new installations default to managed mode');
  assert.equal(syncAccess.readiness({ syncAccessMode: 'personal', appId: 'cli-test', appSecret: 'secret' }).ready, true);
  assert.equal(syncAccess.readiness({ syncAccessMode: 'enterprise', appId: 'cli-test' }).ready, false);
  assert.equal(syncAccess.readiness({ syncAccessMode: 'managed' }, 'https://sync.axonmind.example').ready, true);
  assert.throws(() => syncAccess.normalizeServiceUrl('http://127.0.0.1:8787'), /HTTPS/);
  assert.throws(() => syncAccess.normalizeServiceUrl('http://public.example'), /HTTPS/);
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
  db.run('INSERT INTO users (id, email, username, password_salt, password_hash, created_at, vault_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userA.id, userA.email, userA.username, userA.password_salt, userA.password_hash, userA.created_at, 'vault-a']);
  db.run('INSERT INTO users (id, email, username, password_salt, password_hash, created_at, vault_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userB.id, userB.email, userB.username, userB.password_salt, userB.password_hash, userB.created_at, 'vault-b']);

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
  const hits = await searchService.searchLocalAssets(db, queryAll, userA.id, '生产', { scope: 'personal', groupId: '' });
  assert.ok(hits.length >= 1, 'fts should find item');
  assert.ok(hits[0].content.includes('生产密钥') || hits[0].title.includes('生产密钥'), 'evidence should include content');
  const unrelatedHits = await searchService.searchLocalAssets(db, queryAll, userA.id, '完全不存在的检索短语', { scope: 'personal', groupId: '' });
  assert.equal(unrelatedHits.length, 0, 'unmatched query must not fall back to unrelated recent items');

  const localManifest = manifestService.buildManifestEntries(db, queryAll, userA.id, 'personal', '', {
    vaultId: 'vault-a', deviceId: 'device-a',
  });
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
  const concurrentItem = { ...localManifest.items[0], title: '远端并发标题' };
  const conflictManifest = manifestService.mergeManifests(localManifest, { ...localManifest, items: [concurrentItem] }, { strategy: 'local' });
  assert.equal(conflictManifest.conflicts.length, 1, 'same-timestamp divergent edits are reported as conflicts');
  assert.equal(conflictManifest.items.find((item) => item.id === concurrentItem.id).title, localManifest.items[0].title, 'conflicts preserve the local version');
  const deletedManifest = manifestService.mergeManifests(localManifest, {
    ...remoteManifest,
    tombstones: [{ id: 'delete-item-1', assetId: 'item-1', entityType: 'item', deletedAt: new Date(Date.now() + 1000).toISOString(), deviceId: 'device-b' }],
  });
  assert.ok(!deletedManifest.items.some((i) => i.id === 'item-1'), 'newer tombstone prevents deleted item resurrection');
  assert.throws(() => manifestService.mergeManifests(localManifest, { ...remoteManifest, vaultId: 'vault-other' }), /另一个/);

  const profile = cloudAccount.createProfile({
    vaultId: 'vault-a', email: userA.email, username: userA.username,
    device: { id: 'device-a', name: 'Mac A', platform: 'darwin-arm64' },
  });
  const joined = cloudAccount.mergeDevice(profile, { id: 'device-b', name: 'Mac B', platform: 'darwin-arm64' });
  assert.equal(joined.devices.length, 2, 'cloud profile keeps multiple devices');
  const recoveredDevices = cloudAccount.mergeKnownDevices(profile, joined.devices);
  assert.equal(recoveredDevices.devices.length, 2, 'known devices survive a stale cloud profile write');
  assert.ok(cloudAccount.accountFileName('ou-test').startsWith('vaultmind-account-'));

  const files = feishuDrive.parseListFilesResponse({
    data: { files: [{ token: 'tok1', name: 'vaultmind-user-x.axonvault' }] },
  });
  assert.equal(files[0].token, 'tok1');
  assert.ok(feishuDrive.findManifestFile(files, 'vaultmind-user-x.axonvault'));

  const gitProject = require('../src/core/git-project');
  const authed = gitProject.authRemoteUrl('https://github.com/org/repo.git', 'wally', 'ghp_test');
  assert.ok(authed.includes('wally'));
  assert.ok(authed.includes('ghp_test'));
  assert.equal(gitProject.authRemoteUrl('git@github.com:org/repo.git', 'wally', 'ghp_test'), 'git@github.com:org/repo.git');
  assert.equal(gitProject.isGitRepository('/tmp/not-a-repo'), false);
  const redactedOutput = await gitProject.runCommand(process.execPath, ['-e', "process.stderr.write('ghp_sensitive')"], { redact: ['ghp_sensitive'] });
  assert.equal(redactedOutput, '***');

  const wikiHits = feishuWiki.parseSearchResponse({
    data: { items: [{ title: '部署手册', url: 'https://feishu.cn/wiki/x', node_id: 'n1' }] },
  });
  assert.equal(wikiHits[0].type, 'feishu_wiki');
  assert.equal(feishuWiki.truncateQuery('a'.repeat(60)).length, 50);
  assert.ok(knowledgeHints.obsidianSetupHint().isHint);
  assert.ok(knowledgeHints.feishuWikiLoginHint().isHint);
  const balanceNotice = llmFallback.describeLlmFailure(new Error('HTTP 402: Insufficient Balance'));
  assert.ok(balanceNotice.includes('余额或额度不足'));
  const fallbackAnswer = llmFallback.buildEvidenceFallback([{ source: '本地库', title: '部署手册', content: '部署步骤' }], balanceNotice);
  assert.ok(fallbackAnswer.includes('### 当前状态'));
  assert.ok(fallbackAnswer.includes('1 条相关资料'));
  const redacted = knowledgeSafety.redactSensitiveText('password: Test@123456 token=ghp_1234567890abcdef');
  assert.ok(!redacted.includes('Test@123456'));
  assert.ok(!redacted.includes('ghp_1234567890abcdef'));
  const safeEvidence = knowledgeSafety.prepareEvidence([
    { source: '本地库', type: 'local', kind: 'secret', title: 'GitHub Token', content: 'ghp_1234567890abcdef' },
    { source: '本地库', type: 'local', kind: 'text', title: '重复文档', content: '第一条' },
    { source: '本地库', type: 'local', kind: 'text', title: '重复文档', content: '第二条' },
  ]);
  assert.equal(safeEvidence.length, 2, 'evidence should be deduplicated');
  assert.ok(safeEvidence[0].content.includes('密码库'), 'secret evidence should not expose content');

  const pdfText = await extractContent.extractTextFromBuffer(createTestPdf('AxonMind PDF extraction works'), 'test.pdf');
  assert.ok(pdfText.includes('AxonMind PDF extraction works'), 'PDF text extraction should work without native canvas');

  const rotate = groupService.rotateGroupKey(db, saveDatabase, queryOne, queryAll, userA, 'password-a', group.id);
  assert.ok(rotate.keyVersion >= 2);
  assert.ok(rotate.needsReinvite.includes(userB.id));

  console.log('All core tests passed.');
}

main().catch((error) => {
  console.error('TEST FAILED:', error);
  process.exit(1);
});
