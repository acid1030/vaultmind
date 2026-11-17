import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright-core';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'mizhan-cloud-login-'));
const env={...process.env,NODE_ENV:'production',AXONMIND_E2E:'1'};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root,`--user-data-dir=${profile}`],env});
try {
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.getByRole('button',{name:'使用飞书扫码登录',exact:true}).waitFor();
 assert.equal((await page.evaluate(()=>window.vaultApi.getState())).auth.hasUsers,false);
 assert.equal(await page.getByPlaceholder('you@example.com').isVisible(),false,'local registration is optional and collapsed by default');
 // UI-only IPC fixtures: no real Feishu authorization or credentials.
 const initial=await page.evaluate(()=>window.vaultApi.getState());
 await app.evaluate(({ipcMain},initial)=>{
  let complete=false,step=0;
  const signedIn={...initial,auth:{hasUsers:true,isLoggedIn:true,user:{id:'fixture',email:'fixture@example.test',username:'测试用户',phone:'',recoveryEmail:''}}};
  ipcMain.removeHandler('vault:getState');ipcMain.handle('vault:getState',()=>complete?signedIn:initial);
  ipcMain.removeHandler('vault:beginCloudSignin');ipcMain.handle('vault:beginCloudSignin',()=>({name:'旧版测试用户',needsRecovery:true}));
  ipcMain.removeHandler('vault:finishCloudSignin');ipcMain.handle('vault:finishCloudSignin',(_event,input)=>{
   if(step++===0){if(input.passphrase!=='fixture-passphrase')throw Error('Wrong recovery input');return {name:'旧版测试用户',needsLocalPassword:true};}
   if(input.localPassword!=='fixture-local-password')throw Error('Wrong local input');complete=true;return {state:signedIn};
  });
 },initial);
 await page.getByRole('button',{name:'使用飞书扫码登录',exact:true}).click();
 await page.getByRole('textbox',{name:'原同步口令',exact:true}).fill('fixture-passphrase');
 await page.getByRole('button',{name:'恢复并进入',exact:true}).click();
 await page.getByRole('textbox',{name:'原本机密码',exact:true}).waitFor();
 assert.equal((await page.evaluate(()=>window.vaultApi.getState())).auth.isLoggedIn,false,'legacy data stays locked until recovery succeeds');
 await page.getByRole('textbox',{name:'原本机密码',exact:true}).fill('fixture-local-password');
 await page.getByRole('button',{name:'恢复并进入',exact:true}).click();
 await page.locator('.vm-sidebar').waitFor();
 await app.evaluate(({ipcMain},initial)=>{
  let complete=false;
  const signedIn={...initial,auth:{hasUsers:true,isLoggedIn:true,user:{id:'fixture',email:'fixture@example.test',username:'测试用户',phone:'',recoveryEmail:''}}};
  ipcMain.removeHandler('vault:getState');ipcMain.handle('vault:getState',()=>complete?signedIn:initial);
  ipcMain.removeHandler('vault:beginCloudSignin');ipcMain.handle('vault:beginCloudSignin',()=>{complete=true;return {state:signedIn};});
  ipcMain.removeHandler('vault:finishCloudSignin');ipcMain.handle('vault:finishCloudSignin',()=>{throw Error('Automatic sign-in must not require a second UI action');});
 },initial);
 await page.reload();
 await page.getByRole('button',{name:'使用飞书扫码登录',exact:true}).waitFor();
 assert.equal(await page.getByRole('textbox',{name:'原同步口令',exact:true}).count(),0);
 await page.setViewportSize({width:1280,height:850});
 await page.locator('.vm-auth-frame').evaluate(async element=>{await Promise.all(element.getAnimations().map(animation=>animation.finished))});
 await page.screenshot({path:'/tmp/mizhan-cloud-signin.png'});
 await page.getByRole('button',{name:'使用飞书扫码登录',exact:true}).click();
 await page.locator('.vm-sidebar').waitFor();
 assert.equal(await page.getByRole('textbox',{name:'原同步口令',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('Cloud sign-in UI passed: one-click entry without a passphrase step and exceptional one-time legacy recovery. OAuth transport is fixture-only.');
}finally{await app.close();fs.rmSync(profile,{recursive:true,force:true})}
