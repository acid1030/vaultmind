const assert=require('node:assert/strict'),crypto=require('node:crypto'),http=require('node:http');
const {createAuthServer}=require('../server/feishu-auth/server');
const {authorizeManaged}=require('../src/core/managed-signin');
const {chooseSigninAccount}=require('../src/core/signin-profile');
const {hashPassword}=require('../src/services/crypto');
(async()=>{
 // The login screen must obtain a persistent installation ID without an active user.
 const mainSource=require('node:fs').readFileSync(require.resolve('../src/main.js'),'utf8');
 const deviceHelper=mainSource.match(/function installationDeviceId\(\) \{[\s\S]*?\n\}/);
 assert.ok(deviceHelper,'pre-login installation ID helper exists');
 const stateStore=new Map();
 const context={crypto,getStateValue:(key,fallback)=>stateStore.get(key)||fallback,setStateValue:(key,value)=>stateStore.set(key,value)};
 require('node:vm').createContext(context);
 require('node:vm').runInContext(deviceHelper[0],context);
 const firstDevice=context.installationDeviceId();
 assert.match(firstDevice,/^[a-f0-9-]{36}$/);
 assert.equal(context.installationDeviceId(),firstDevice,'same installation survives repeated pre-login attempts');
 stateStore.set('installationDeviceId','existing-device');
 assert.equal(context.installationDeviceId(),'existing-device','existing device IDs remain unchanged');
 const fs = require('node:fs');
 const path = require('node:path');
 const directory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mizhan-sync-key-'));
 const tokenKey = crypto.randomBytes(32);
 const syncPassphrase = 'fixture-original-sync-key';
 const vaultId = crypto.randomUUID();
 const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
 const derived = crypto.pbkdf2Sync(syncPassphrase, salt, 210000, 32, 'sha256');
 const cipher = crypto.createCipheriv('aes-256-gcm', derived, iv);
 const ciphertext = Buffer.concat([cipher.update(JSON.stringify({
  kind: 'account-profile', text: JSON.stringify({ kind: 'account-profile', vaultId }),
 })), cipher.final()]);
 const encrypted = Buffer.from(JSON.stringify({
  version: 2, kdf: { iterations: 210000, salt: salt.toString('base64') },
  iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64'),
 }));
 const { accountFileName } = require('../src/core/cloud-account');
 let clock = Date.now();
 const server = createAuthServer({
  publicUrl: 'https://auth.example.test/mizhan-auth', appId: 'test-app', appSecret: 'test-secret',
  tokenKey, syncKeyDirectory: directory, now: () => clock,
  fetcher: async (url) => ({
   ok: true, arrayBuffer: async () => encrypted,
   json: async () => {
    if (url.endsWith('user_info')) return { code: 0, data: { open_id: 'open-1', name: 'Test' } };
    if (url.endsWith('/root_folder/meta')) return { code: 0, data: { token: 'root' } };
    if (url.includes('/files?')) return { code: 0, data: { files: [{ name: accountFileName('open-1'), token: 'account-file' }] } };
    return { access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 7200 };
   },
  }),
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}/mizhan-auth`;
 const post=async(route,body)=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}};
 const verifier=crypto.randomBytes(32).toString('base64url'),state=crypto.randomBytes(24).toString('hex'),redirectUri='http://127.0.0.1:37891/feishu/oauth/callback',deviceId='test-device',challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
 try{
  assert.equal((await post('/v1/feishu/oauth/sessions',{state,redirectUri:'https://evil.example/steal',deviceId,challenge})).status,400);
  const start=await post('/v1/feishu/oauth/sessions',{state,redirectUri,deviceId,challenge});assert.equal(start.status,200);const auth=new URL(start.data.authorizationUrl);assert.equal(auth.hostname,'accounts.feishu.cn');assert.ok(auth.searchParams.get('scope').includes('offline_access'));assert.ok(!JSON.stringify(start).includes('test-secret'));
  const response=await fetch(base+'/callback?'+new URLSearchParams({state:auth.searchParams.get('state'),code:'test-code'}),{redirect:'manual'});assert.equal(response.status,302);const callback=new URL(response.headers.get('location'));assert.equal(callback.hostname,'127.0.0.1');assert.ok(!callback.href.includes('private-access'));
  const ticket=callback.searchParams.get('ticket');assert.equal((await post('/v1/feishu/oauth/sessions/exchange',{ticket,state,redirectUri,deviceId,verifier:'wrong'})).status,400);
  const exchange=await post('/v1/feishu/oauth/sessions/exchange',{ticket,state,redirectUri,deviceId,verifier});assert.equal(exchange.status,200);assert.equal(exchange.data.user.openId,'open-1');assert.notEqual(exchange.data.refreshToken,'private-refresh');assert.equal((await post('/v1/feishu/oauth/sessions/exchange',{ticket,state,redirectUri,deviceId,verifier})).status,400);
  assert.equal((await post('/v1/feishu/oauth/refresh',{refreshToken:exchange.data.refreshToken})).status,200);assert.equal((await post('/v1/feishu/oauth/refresh',{refreshToken:'private-refresh'})).status,400);
  const grant = exchange.data.syncKeyGrant;
  assert.equal((await post('/v1/sync-key', { grant: exchange.data.refreshToken })).status, 400);
  assert.equal((await post('/v1/sync-key', { grant })).data.record, null);
  assert.equal((await post('/v1/sync-key', { grant, vaultId, fileToken: 'foreign-file', passphrase: syncPassphrase })).status, 400);
  assert.equal((await post('/v1/sync-key', { grant, vaultId, fileToken: 'account-file', passphrase: 'incorrect-key' })).status, 400);
  const enrollment = { grant, vaultId, fileToken: 'account-file', passphrase: syncPassphrase };
  assert.equal((await post('/v1/sync-key', enrollment)).status, 200);
  assert.equal((await post('/v1/sync-key', enrollment)).status, 200);
  const stored = fs.readFileSync(path.join(directory, fs.readdirSync(directory)[0]));
  assert.equal(stored.includes(syncPassphrase), false);
  const { createSyncKeyStore } = require('../server/feishu-auth/sync-key-store');
  const reopened = createSyncKeyStore(directory, tokenKey, 'test-app');
  assert.deepEqual(await reopened.read('open-1'), { vaultId, passphrase: syncPassphrase });
  assert.equal(await reopened.read('open-2'), null);
  const second = await post('/v1/feishu/oauth/sessions', { state, redirectUri, deviceId: 'second-device', challenge });
  const secondCallback = await fetch(base + '/callback?' + new URLSearchParams({
   state: new URL(second.data.authorizationUrl).searchParams.get('state'), code: 'second-code',
  }), { redirect: 'manual' });
  const secondTicket = new URL(secondCallback.headers.get('location')).searchParams.get('ticket');
  const secondExchange = await post('/v1/feishu/oauth/sessions/exchange', {
   ticket: secondTicket, state, redirectUri, deviceId: 'second-device', verifier,
  });
  assert.deepEqual((await post('/v1/sync-key', { grant: secondExchange.data.syncKeyGrant })).data.record,
   { vaultId, passphrase: syncPassphrase });
  const expiring=await post('/v1/feishu/oauth/sessions',{state,redirectUri,deviceId,challenge});clock+=600001;assert.equal((await fetch(base+'/callback?'+new URLSearchParams({state:new URL(expiring.data.authorizationUrl).searchParams.get('state'),code:'old'}))).status,400);
  assert.equal((await post('/v1/sync-key', { grant })).status, 400);
 }finally{await new Promise(r=>server.close(r));fs.rmSync(directory,{recursive:true,force:true})}
 const identity={openId:'verified-open',name:'Name'},passphrase='encryption-only';const user={id:'local',email:'old@example.com',password_salt:'salt',password_hash:hashPassword('local-unlock','salt')};
 const profile={email:'old@example.com',vaultId:'old-vault'};
 assert.equal(chooseSigninAccount({identity,profile,users:[user],passphrase,hashPassword}).needsLocalPassword,true);
 assert.equal(chooseSigninAccount({identity,profile,users:[user],passphrase,localPassword:'local-unlock',hashPassword}).user.id,'local');
 assert.equal(chooseSigninAccount({identity,profile,users:[],passphrase,hashPassword}).vaultId,'old-vault');
 assert.throws(()=>chooseSigninAccount({identity,profile,users:[{...user,feishu_open_id_hash:'different'}],passphrase,hashPassword}),/其他飞书/);
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));let started;
 const auth=await authorizeManaged({serviceUrl:'https://auth.example.test',port,deviceId:'device',post:async(url,body)=>{if(url.endsWith('/sessions')){started=body;return {authorizationUrl:'https://accounts.feishu.cn/login'}}assert.equal(crypto.createHash('sha256').update(body.verifier).digest('base64url'),started.challenge);return {accessToken:'verified'}},openExternal:async()=>{assert.equal((await fetch(`http://127.0.0.1:${port}/feishu/oauth/callback?state=wrong`)).status,400);await fetch(`http://127.0.0.1:${port}/feishu/oauth/callback?`+new URLSearchParams({state:started.state,ticket:'one-use'}))}});
 assert.equal(auth.accessToken,'verified');console.log('Managed sign-in passed: PKCE, callback restrictions, replay/expiry, opaque refresh, local password isolation and pre-login loopback authorization.');
})().catch(e=>{console.error(e);process.exitCode=1});
