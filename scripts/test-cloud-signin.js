const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const initSqlJs = require('sql.js');
const cloudAccount = require('../src/core/cloud-account');
const feishuDrive = require('../src/core/feishu-drive');
const { chooseSigninAccount, findSigninAccount } = require('../src/core/signin-profile');
const managedKeys = require('../src/core/managed-keys');
const { createSigninKeyStore } = require('../server/feishu-auth/signin-keys');
const { hashPassword, encryptVaultPayload, decryptVaultPayload, encryptForLocalUser, decryptForLocalUser } = require('../src/services/crypto');

(async () => {
  const SQL = await initSqlJs();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mizhan-cloud-flow-'));
  const keys = createSigninKeyStore({ directory, tokenKey: crypto.randomBytes(32), appId: 'test-app' });
  const source = fs.readFileSync(require.resolve('../src/main.js'), 'utf8');
  const flow = source.slice(source.indexOf('let pendingCloudSignin ='), source.indexOf('\nasync function handleFeishuLogin()'));
  const databases = [];
  function device(cloud) {
    const db = new SQL.Database(); databases.push(db);
    db.run(`CREATE TABLE users (id TEXT PRIMARY KEY, vault_id TEXT, email TEXT, username TEXT, password_salt TEXT, password_hash TEXT, created_at TEXT, cloud_linked INTEGER DEFAULT 0, feishu_open_id_hash TEXT);`);
    db.run(`CREATE TABLE app_state (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE library_items (id TEXT PRIMARY KEY,user_id TEXT,scope TEXT,content_ciphertext TEXT,content_iv TEXT,content_tag TEXT);
      CREATE TABLE decrypted_items (id TEXT PRIMARY KEY,user_id TEXT,scope TEXT,content_ciphertext TEXT,content_iv TEXT,content_tag TEXT);
      CREATE TABLE project_accounts (id TEXT PRIMARY KEY,user_id TEXT,scope TEXT,secret_ciphertext TEXT,secret_iv TEXT,secret_tag TEXT);
      CREATE TABLE chat_messages (id TEXT,owner_user_id TEXT,room_id TEXT,content_ciphertext TEXT,content_iv TEXT,content_tag TEXT);
      CREATE TABLE chat_attachments (id TEXT,owner_user_id TEXT,room_id TEXT,content_ciphertext TEXT,content_iv TEXT,content_tag TEXT);
      CREATE TABLE group_member_keys (user_id TEXT,group_id TEXT,key_version INTEGER,wrapped_key_ciphertext TEXT,wrapped_key_iv TEXT,wrapped_key_tag TEXT);`);
    const queryAll = (sql, args = []) => {
      const statement = db.prepare(sql), rows = [];
      try { statement.bind(args); while (statement.step()) rows.push(statement.getAsObject()); }
      finally { statement.free(); }
      return rows;
    };
    const state = {
      get: key => { const row = queryAll('SELECT value FROM app_state WHERE key=?', [key])[0]; return row ? JSON.parse(row.value) : undefined; },
      has: key => Boolean(queryAll('SELECT key FROM app_state WHERE key=?', [key])[0]),
      set: (key, value) => db.run('INSERT OR REPLACE INTO app_state(key,value) VALUES(?,?)', [key, JSON.stringify(value)]),
    };
    const identity = { openId: cloud.openId, name: 'Fixture user', email: cloud.email || '' };
    const context = {
      Buffer, crypto, Date, db, cloudAccount, feishuDrive, hashPassword, encryptVaultPayload, decryptVaultPayload, encryptForLocalUser, decryptForLocalUser,
      chooseSigninAccount, findSigninAccount, ...managedKeys,
      activeUser: null, activePassword: '', chatSessionEpoch: 0, queryAll,
      requireUser: () => context.activeUser,
      ensureDatabase: async () => {}, saveDatabase: () => {},
      queryOne: (sql, args) => queryAll(sql, args)[0] || null,
      getStateValue: (key, fallback) => state.has(key) ? state.get(key) : fallback,
      setStateValue: (key, value) => state.set(key, JSON.parse(JSON.stringify(value))),
      getSettings: () => ({ folderToken: 'root', feishuAutoSync: false, ...state.get('settings') }),
      getFeishuToken: () => state.get('token') || null,
      setFeishuToken: token => state.set('token', token),
      managedServiceUrl: () => 'https://auth.example.test',
      managedAuthorization: async () => ({ user: identity, accessToken: cloud.openId, provider: 'axonmind-managed' }),
      ensureFeishuPayload: result => result.data || result,
      requestJson: async (_method, url, input) => {
        if (url.endsWith('/signin-key')) {
          assert.equal(input.headers.Authorization, `Bearer ${cloud.openId}`);
          const { action, passphrase } = input.body;
          return { passphrase: action === 'lookup' ? keys.read(cloud.openId) : keys.create(cloud.openId, action === 'import' ? passphrase : undefined) };
        }
        if (url.includes('/root_folder/meta')) return { token: 'cloud-root' };
        if (url.includes('/drive/v1/files?')) return { files: cloud.profile ? [{ name: cloudAccount.accountFileName(cloud.openId), token: 'profile-file' }] : [], has_more: false };
        throw Error('Unexpected request: ' + url);
      },
      requestBuffer: async () => ({ status: 200, body: cloud.profile }),
      FEISHU_API: 'https://open.feishu.cn',
      restoreSessionPassword: () => '', assertLoginAllowed: () => {}, recordLoginFailure: () => {}, loginAttempts: new Map(),
      linkCloudAccount: async ({ mode, passphrase }) => {
        cloud.writes = (cloud.writes || 0) + 1;
        const user = context.activeUser;
        const profile = mode === 'join' ? cloudAccount.decryptProfile(cloud.profile, passphrase, decryptVaultPayload) : cloudAccount.createProfile({
          vaultId: user.vault_id, email: user.email, username: user.username, device: { id: crypto.randomUUID() },
        });
        cloud.profile = cloudAccount.encryptProfile(profile, passphrase, encryptVaultPayload);
        db.run('UPDATE users SET vault_id=?,cloud_linked=1,feishu_open_id_hash=? WHERE id=?', [profile.vaultId, cloudAccount.hashFeishuOpenId(cloud.openId), user.id]);
        context.activeUser = context.queryOne('SELECT * FROM users WHERE id=?', [user.id]);
      },
      createLocalSession: () => { context.chatSessionEpoch++; }, afterAuthSuccess: () => {}, requestAutoSync: () => {},
      publicState: () => ({ auth: { isLoggedIn: Boolean(context.activeUser), user: { id: context.activeUser?.id } } }),
    };
    vm.createContext(context); vm.runInContext(flow, context);
    vm.runInContext(source.slice(source.indexOf('function changeLocalPassword('), source.indexOf('\nfunction runCommand(')), context);
    return {
      context, state, begin: () => context.beginCloudSignin(), finish: input => context.finishCloudSignin(input),
      lock: () => { context.activeUser = null; context.activePassword = ''; context.chatSessionEpoch++; },
      addUser: (email, password) => {
        const user = { id: crypto.randomUUID(), vault_id: crypto.randomUUID(), email, username: 'Legacy', password_salt: crypto.randomBytes(16).toString('base64') };
        user.password_hash = hashPassword(password, user.password_salt);
        db.run('INSERT INTO users(id,vault_id,email,username,password_salt,password_hash) VALUES(?,?,?,?,?,?)', Object.values(user));
        return user;
      },
    };
  }
  try {
    const cloud = { openId: 'new-user' }, first = device(cloud);
    const result = await first.begin();
    assert.equal(result.state.auth.isLoggedIn, true, 'OAuth alone completes new account sign-in');
    assert.equal(result.needsRecovery, undefined);
    assert.equal(first.state.get('settings').feishuAutoSync, true);
    const passphrase = keys.read(cloud.openId), firstPassword = first.context.activePassword;
    assert.notEqual(firstPassword, passphrase, 'local encryption and cloud encryption use independent secrets');
    assert.ok(!JSON.stringify(result).includes(passphrase) && !JSON.stringify(result).includes(firstPassword), 'secrets never reach the renderer');
    const firstId = first.context.activeUser.id, vaultId = first.context.activeUser.vault_id;
    first.lock(); await first.begin();
    assert.equal(first.context.activeUser.id, firstId);
    assert.equal(first.context.activePassword, firstPassword, 'repeated OAuth restores the original local encryption key');
    const second = device(cloud); await second.begin();
    assert.equal(second.context.activeUser.vault_id, vaultId, 'another device joins the existing cloud account automatically');
    assert.notEqual(second.context.activePassword, firstPassword);

    const localContent = encryptForLocalUser(Buffer.from('local data survives a password change'), firstPassword, first.context.activeUser);
    first.context.db.run('INSERT INTO library_items VALUES(?,?,?,?,?,?)', ['item', firstId, 'personal', localContent.ciphertext, localContent.iv, localContent.tag]);
    first.context.changeLocalPassword({ currentPassword: firstPassword, newPassword: 'changed-local-password' });
    first.lock();
    assert.equal((await first.begin()).state.auth.isLoggedIn, true);
    assert.equal(first.context.activePassword, 'changed-local-password', 'a local password change updates the automatic unlock envelope');
    const changedItem = first.context.queryOne('SELECT * FROM library_items WHERE id=?', ['item']);
    assert.equal(decryptForLocalUser(changedItem, first.context.activePassword, first.context.activeUser).toString(), 'local data survives a password change');
    first.state.set(`managedSignin:${firstId}`, 'damaged-envelope');
    first.lock();
    assert.equal((await first.begin()).needsLocalPassword, true);
    assert.equal((await first.finish({ localPassword: 'changed-local-password' })).state.auth.isLoggedIn, true, 'damaged local caches offer recovery instead of an endless retry loop');

    const legacyCloud = { openId: 'legacy-user', email: 'legacy@example.test' }, legacy = device(legacyCloud);
    const user = legacy.addUser(legacyCloud.email, 'original-local-password');
    const content = encryptForLocalUser(Buffer.from('preserved legacy content'), 'original-local-password', user);
    legacy.context.activeUser = user; legacy.context.activePassword = 'original-local-password';
    legacy.state.set('settings', { feishuPassphrase: 'original-sync-password' });
    legacyCloud.profile = cloudAccount.encryptProfile(cloudAccount.createProfile({ vaultId: user.vault_id, email: user.email, device: { id: 'old-device' } }), 'original-sync-password', encryptVaultPayload);
    await legacy.begin();
    assert.equal(keys.read(legacyCloud.openId), 'original-sync-password', 'saved legacy keys migrate without re-encryption or user input');
    legacy.lock(); await legacy.begin();
    assert.equal(legacy.context.activePassword, 'original-local-password');
    assert.equal(decryptForLocalUser({ content_ciphertext: content.ciphertext, content_iv: content.iv, content_tag: content.tag }, legacy.context.activePassword, user).toString(), 'preserved legacy content');

    const recoveryCloud = { openId: 'unmigrated-user', email: 'recover@example.test' }, recovery = device(recoveryCloud);
    const oldUser = recovery.addUser(recoveryCloud.email, 'old-local-password');
    recoveryCloud.profile = cloudAccount.encryptProfile(cloudAccount.createProfile({ vaultId: oldUser.vault_id, email: oldUser.email, device: { id: 'old-device' } }), 'old-sync-password', encryptVaultPayload);
    assert.equal((await recovery.begin()).needsRecovery, true);
    assert.equal(keys.read(recoveryCloud.openId), null);
    assert.equal((await recovery.finish({ passphrase: 'wrong-sync-password' })).needsRecovery, true);
    assert.equal(keys.read(recoveryCloud.openId), null, 'wrong recovery never registers a new key');
    assert.equal((await recovery.finish({ passphrase: 'old-sync-password' })).needsLocalPassword, true);
    assert.equal(recovery.context.activeUser, null);
    assert.equal((await recovery.finish({ localPassword: 'wrong-local-password' })).needsLocalPassword, true);
    await recovery.finish({ localPassword: 'old-local-password' });
    recovery.lock();
    assert.equal((await recovery.begin()).state.auth.isLoggedIn, true, 'legacy credentials are requested only once');

    const blocked = device({ openId: 'different-user' });
    blocked.context.activeUser = { ...user, feishu_open_id_hash: cloudAccount.hashFeishuOpenId('legacy-user') };
    blocked.context.activePassword = 'original-local-password';
    await assert.rejects(blocked.begin(), /其他飞书身份/);
    assert.equal(keys.read('different-user'), null, 'a different identity cannot bind or create keys for the active vault');

    const cancelledCloud = { openId: 'cancelled-user' }, cancelled = device(cancelledCloud);
    cancelled.context.managedAuthorization = async () => { cancelled.context.chatSessionEpoch++; return { user: { openId: cancelledCloud.openId } }; };
    await assert.rejects(cancelled.begin(), /登录状态已变化/);
    assert.equal(keys.read(cancelledCloud.openId), null);
    console.log('Cloud sign-in passed: one-step registration, repeat login, cross-device restore, automatic legacy binding, recovery, identity isolation and cancelled sessions.');
  } finally {
    for (const db of databases) db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
