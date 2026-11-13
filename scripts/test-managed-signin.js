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
 let clock=Date.now();const server=createAuthServer({publicUrl:'https://auth.example.test/mizhan-auth',appId:'test-app',appSecret:'test-secret',tokenKey:crypto.randomBytes(32),now:()=>clock,fetcher:async(url,options)=>({ok:true,json:async()=>url.endsWith('user_info')?{code:0,data:{open_id:'open-1',name:'Test'}}:{access_token:'private-access',refresh_token:'private-refresh',expires_in:7200}})});
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
  const expiring=await post('/v1/feishu/oauth/sessions',{state,redirectUri,deviceId,challenge});clock+=600001;assert.equal((await fetch(base+'/callback?'+new URLSearchParams({state:new URL(expiring.data.authorizationUrl).searchParams.get('state'),code:'old'}))).status,400);
 }finally{await new Promise(r=>server.close(r))}
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
