const http=require('node:http'),crypto=require('node:crypto');
function authorizeManaged({serviceUrl,port,deviceId,openExternal,post,timeout=600000}) {
 if(new URL(serviceUrl).protocol!=='https:')throw Error('登录服务必须使用 HTTPS');
 return new Promise((resolve,reject)=>{
  const state=crypto.randomBytes(24).toString('hex'),verifier=crypto.randomBytes(32).toString('base64url'),challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
  const redirectUri=`http://127.0.0.1:${port}/feishu/oauth/callback`;let done=false,claiming=false;
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);server.close();error?reject(error):resolve(result)};
  const server=http.createServer(async(req,res)=>{
   const url=new URL(req.url,redirectUri);
   if(req.method!=='GET'||url.pathname!=='/feishu/oauth/callback'||url.searchParams.get('state')!==state||claiming){res.writeHead(400);return res.end('Invalid callback')}
   claiming=true;
   try{if(url.searchParams.has('error'))throw Error('飞书授权已取消');const ticket=url.searchParams.get('ticket');if(!ticket)throw Error('缺少登录票据');const result=await post(serviceUrl+'/v1/feishu/oauth/sessions/exchange',{ticket,state,verifier,redirectUri,deviceId});res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<h2>飞书授权完成，请返回秘栈继续解锁</h2>');finish(null,result)}catch(e){res.writeHead(400);res.end('Login failed. Return to Mizhan.');finish(e)}
  });
  const timer=setTimeout(()=>finish(Error('飞书登录超时，请重新扫码')),timeout);server.on('error',e=>finish(e));
  server.listen(port,'127.0.0.1',async()=>{try{const result=await post(serviceUrl+'/v1/feishu/oauth/sessions',{state,challenge,redirectUri,deviceId});const auth=new URL(result?.data?.authorizationUrl||result.authorizationUrl);if(auth.protocol!=='https:'||auth.hostname!=='accounts.feishu.cn')throw Error('登录服务返回了无效授权地址');await openExternal(auth.toString())}catch(e){finish(e)}});
 });
}
module.exports={authorizeManaged};
