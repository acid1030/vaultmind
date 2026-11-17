const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAuthServer } = require('../server/feishu-auth/server');
const { createSigninKeyStore } = require('../server/feishu-auth/signin-keys');
const { sealLocalUnlock, openLocalUnlock, resolveSigninKey } = require('../src/core/managed-keys');
const { hashPassword, encryptVaultPayload, decryptVaultPayload } = require('../src/services/crypto');

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mizhan-signin-keys-'));
  const tokenKey = crypto.randomBytes(32);
  const options = {
    publicUrl: 'https://auth.example.test/mizhan-auth', appId: 'test-app', appSecret: 'test-secret', tokenKey, keyDirectory: directory,
    fetcher: async (_url, input) => {
      const identity = { 'Bearer user-a': 'open-a', 'Bearer user-b': 'open-b', 'Bearer legacy': 'legacy-open' }[input.headers.Authorization];
      return { ok: Boolean(identity), json: async () => identity ? { data: { open_id: identity } } : { error: 'invalid token' } };
    },
  };
  let server;
  async function start() {
    server = createAuthServer(options);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  }
  const post = async (token, data) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/mizhan-auth/v1/feishu/signin-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data),
    });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return { status: response.status, data: await response.json() };
  };
  try {
    await start();
    assert.equal((await post('', { action: 'create' })).status, 400);
    assert.equal((await post('invalid', { action: 'create' })).status, 400);
    assert.equal((await post('user-a', { action: 'lookup' })).data.passphrase, null);
    const first = await post('user-a', { action: 'create' });
    assert.equal(first.status, 200);
    assert.match(first.data.passphrase, /^[A-Za-z0-9_-]{43}$/);
    const simultaneous = await Promise.all(Array.from({ length: 4 }, () => post('user-a', { action: 'create' })));
    assert.ok(simultaneous.every(result => result.data.passphrase === first.data.passphrase));
    const other = await post('user-b', { action: 'create', openId: 'open-a' });
    assert.notEqual(other.data.passphrase, first.data.passphrase, 'identity comes from Feishu, not the request body');
    assert.equal((await post('legacy', { action: 'import' })).status, 400);
    assert.equal((await post('legacy', { action: 'import', passphrase: 'existing-sync-secret' })).data.passphrase, 'existing-sync-secret');
    assert.equal((await post('legacy', { action: 'import', passphrase: 'different-secret' })).status, 400);
    for (const name of fs.readdirSync(directory)) {
      const file = path.join(directory, name), bytes = fs.readFileSync(file, 'utf8');
      assert.ok(!bytes.includes(first.data.passphrase) && !bytes.includes('existing-sync-secret'));
      assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    }
    await new Promise(resolve => server.close(resolve));
    await start();
    assert.equal((await post('user-a', { action: 'lookup' })).data.passphrase, first.data.passphrase, 'same key after a service restart');
    const store = createSigninKeyStore({ directory, tokenKey, appId: 'test-app' });
    const nameFor = id => path.join(directory, crypto.createHash('sha256').update(`test-app:${id}`).digest('hex') + '.json');
    fs.copyFileSync(nameFor('open-a'), nameFor('open-b'));
    assert.throws(() => store.read('open-b'), 'encrypted records cannot be swapped across identities');
    assert.throws(() => createSigninKeyStore({ directory, tokenKey: crypto.randomBytes(32), appId: 'test-app' }).read('open-a'));

    const password = crypto.randomBytes(32).toString('base64url'), passphrase = first.data.passphrase;
    const user = { id: 'user', password_salt: crypto.randomBytes(16).toString('base64') };
    user.password_hash = hashPassword(password, user.password_salt);
    const input = { user, openIdHash: 'verified-identity', password, passphrase, encrypt: encryptVaultPayload };
    const envelope = sealLocalUnlock(input);
    const unlock = { envelope, user, openIdHash: input.openIdHash, passphrase, decrypt: decryptVaultPayload, hashPassword };
    assert.equal(openLocalUnlock(unlock), password);
    assert.ok(!envelope.includes(password));
    assert.throws(() => openLocalUnlock({ ...unlock, openIdHash: 'other-identity' }));
    assert.throws(() => openLocalUnlock({ ...unlock, user: { ...user, id: 'other-local-user' } }));
    assert.throws(() => openLocalUnlock({ ...unlock, passphrase: 'wrong-managed-key' }));

    let created = 0;
    const create = async value => { created++; return value || passphrase; };
    const validate = async value => assert.equal(value, 'old-sync-password');
    const base = { lookup: async () => null, create, hasProfile: true, validate };
    assert.equal((await resolveSigninKey(base)).needsRecovery, true);
    assert.equal((await resolveSigninKey({ ...base, savedPassphrase: 'wrong-secret' })).needsRecovery, true);
    assert.equal(created, 0, 'missing or wrong legacy keys never overwrite the cloud account');
    assert.equal((await resolveSigninKey({ ...base, savedPassphrase: 'old-sync-password' })).passphrase, 'old-sync-password');
    assert.equal((await resolveSigninKey({ ...base, recoveryPassphrase: 'old-sync-password' })).passphrase, 'old-sync-password');
    assert.equal((await resolveSigninKey({ ...base, lookup: async () => 'old-sync-password' })).passphrase, 'old-sync-password');
    await assert.rejects(resolveSigninKey({ ...base, lookup: async () => 'wrong-managed-key' }), /托管密钥/);
    await assert.rejects(resolveSigninKey({ ...base, lookup: async () => { throw Error('offline'); } }), /offline/);
    console.log('Managed keys passed: verified identity, encrypted durable storage, restart recovery, concurrent creation, local unlock binding and safe legacy migration.');
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
