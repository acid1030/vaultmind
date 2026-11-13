'use strict';
const http=require('node:http'), crypto=require('node:crypto');
const { createChatLive } = require('./chat-live');
const API='https://open.feishu.cn';
function createAuthServer({publicUrl,appId,appSecret,tokenKey,scope='drive:drive drive:drive:readonly auth:user.id:read wiki:wiki:readonly offline_access',fetcher=fetch,now=Date.now}) {
 const base=new URL(publicUrl);if(base.protocol!=='https:'||base.search||base.hash)throw Error('PUBLIC_URL must be HTTPS');
 if(!appId||!appSecret||!Buffer.isBuffer(tokenKey)||tokenKey.length!==32)throw Error('Missing auth configuration');
 const prefix=base.pathname.replace(/\/$/,''),sessions=new Map(),tickets=new Map(),rates=new Map();
 const random=()=>crypto.randomBytes(32).toString('base64url');
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
 const wrap=value=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',tokenKey,iv);return Buffer.concat([iv,cipher.update(JSON.stringify(value)),cipher.final(),cipher.getAuthTag()]).toString('base64url')};
 const unwrap=value=>{if(typeof value!=='string'||value.length>12000)throw Error();const b=Buffer.from(value,'base64url'),d=crypto.createDecipheriv('aes-256-gcm',tokenKey,b.subarray(0,12));d.setAuthTag(b.subarray(-16));return JSON.parse(Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString())};
 const remote=async(path,body,accessToken)=>{const response=await fetcher(API+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok||data.code&&data.code!==0||data.error)throw Error('Feishu authorization failed');return data};
 async function payload(t){if(!t.access_token)throw Error('Missing access token');const user=(await remote('/open-apis/authen/v1/user_info',null,t.access_token)).data;if(!user?.open_id)throw Error('Missing user identity');return {accessToken:t.access_token,refreshToken:t.refresh_token?wrap({refresh:t.refresh_token,openId:user.open_id,expires:now()+Math.max(60,Number(t.refresh_token_expires_in||2592000))*1000}):'',expiresIn:Number(t.expires_in||7200),refreshExpiresIn:Number(t.refresh_token_expires_in||2592000),scope:t.scope||scope,user:{openId:user.open_id,name:user.name||'',email:user.email||'',avatarUrl:user.avatar_url||''}}}
 async function body(req){let text='';for await(const b of req){text+=b;if(text.length>16384)throw Error('Request too large')}return JSON.parse(text||'{}')}
 const server=http.createServer(async(req,res)=>{
  try {
   for(const map of [sessions,tickets,rates])for(const [id,s] of map)if(s.expires<=now())map.delete(id);
   const url=new URL(req.url,'http://localhost'),route=url.pathname;
   if(req.method==='GET'&&route===prefix+'/health')return json(res,200,{ok:true,configured:true});
   const ip=req.socket.remoteAddress,r=rates.get(ip)||{count:0,expires:now()+60000};if(++r.count>180)return json(res,429,{message:'Too many requests'});rates.set(ip,r);
   if(req.method==='POST'&&route===prefix+'/v1/feishu/oauth/sessions'){
    const b=await body(req),redirect=new URL(b.redirectUri);
    if(redirect.protocol!=='http:'||redirect.hostname!=='127.0.0.1'||!redirect.port||redirect.username||redirect.password||redirect.search||redirect.hash||redirect.pathname!=='/feishu/oauth/callback'||!/^[a-f0-9]{36,128}$/i.test(b.state||'')||!/^[A-Za-z0-9_-]{43}$/.test(b.challenge||'')||typeof b.deviceId!=='string'||b.deviceId.length>200)throw Error();
    if(sessions.size>=1000)return json(res,503,{message:'Login busy'});
    const state=random();sessions.set(state,{...b,expires:now()+600000});
    const auth=new URL('https://accounts.feishu.cn/open-apis/authen/v1/authorize');auth.search=new URLSearchParams({client_id:appId,response_type:'code',redirect_uri:publicUrl.replace(/\/$/,'')+'/callback',scope,state}).toString();
    return json(res,200,{authorizationUrl:auth.toString()});
   }
   if(req.method==='GET'&&route===prefix+'/callback'){
    const state=url.searchParams.get('state'),s=sessions.get(state);if(!s)throw Error();sessions.delete(state);
    const redirect=new URL(s.redirectUri);redirect.searchParams.set('state',s.state);
    if(url.searchParams.has('error'))redirect.searchParams.set('error','cancelled');
    else {const code=url.searchParams.get('code');if(!code||code.length>4096)throw Error();const t=await remote('/open-apis/authen/v2/oauth/token',{grant_type:'authorization_code',client_id:appId,client_secret:appSecret,code,redirect_uri:publicUrl.replace(/\/$/,'')+'/callback'});const result=await payload(t);const ticket=random();tickets.set(ticket,{...s,result,expires:now()+60000});redirect.searchParams.set('ticket',ticket)}
    res.writeHead(302,{Location:redirect.toString(),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();
   }
   if(req.method==='POST'&&route===prefix+'/v1/feishu/oauth/sessions/exchange'){
    const b=await body(req),t=tickets.get(b.ticket);if(!t||b.state!==t.state||b.redirectUri!==t.redirectUri||b.deviceId!==t.deviceId||typeof b.verifier!=='string'||b.verifier.length>128||crypto.createHash('sha256').update(b.verifier).digest('base64url')!==t.challenge)throw Error();tickets.delete(b.ticket);return json(res,200,t.result);
   }
   if(req.method==='POST'&&route===prefix+'/v1/feishu/oauth/refresh'){
    const b=await body(req),t=unwrap(b.refreshToken);if(!t.refresh||t.expires<=now())throw Error();const v=await remote('/open-apis/authen/v2/oauth/token',{grant_type:'refresh_token',client_id:appId,client_secret:appSecret,refresh_token:t.refresh});const result=await payload(v);if(result.user.openId!==t.openId)throw Error();return json(res,200,result);
   }
   if(req.method==='POST'&&route===prefix+'/v1/chat/live-ticket'){
    const b=await body(req), match=/^Bearer ([^\s]+)$/.exec(req.headers.authorization||'');
    if(!match||!(/^[0-9a-f-]{36}$/i.test(b.vaultId)))return json(res,400,{message:'Invalid live request'});
    const user=(await remote('/open-apis/authen/v1/user_info',null,match[1])).data;
    if(!user?.open_id)return json(res,403,{message:'Invalid Feishu identity'});
    return json(res,200,{ticket:chatLive.issue(user.open_id,b.vaultId)});
   }
   return json(res,404,{message:'Not found'});
  }catch{return json(res,400,{message:'登录未完成或授权已失效，请重新发起飞书登录'})}
 });
 const chatLive=createChatLive(server,prefix+'/v1/chat/live',now);
 return server;
}
if(require.main===module){const server=createAuthServer({publicUrl:process.env.PUBLIC_URL,appId:process.env.FEISHU_APP_ID,appSecret:process.env.FEISHU_APP_SECRET,tokenKey:Buffer.from(process.env.TOKEN_KEY||'','hex')});server.listen(Number(process.env.PORT||3492),'127.0.0.1',()=>console.log('Mizhan auth listening on loopback'));}
module.exports={createAuthServer};
