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
 // UI-only IPC fixtures: no real Feishu authorization or credentials.
 await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('vault:beginCloudSignin');ipcMain.handle('vault:beginCloudSignin',()=>({name:'跨设备测试用户',binding:false}));ipcMain.removeHandler('vault:finishCloudSignin');ipcMain.handle('vault:finishCloudSignin',()=>({needsLocalPassword:true}));});
 await page.getByRole('button',{name:'使用飞书扫码登录',exact:true}).click();
 await page.getByRole('textbox',{name:'云端加密口令',exact:true}).fill('fixture-passphrase');await page.getByRole('button',{name:'解锁并进入秘栈',exact:true}).click();await page.getByRole('alert').filter({hasText:'旧本机资料库'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'已有账号本机解锁密码',exact:true}).count(),0);
 assert.equal((await page.evaluate(()=>window.vaultApi.getState())).auth.isLoggedIn,false,'OAuth UI cannot bypass a local password');
 await page.setViewportSize({width:1280,height:850});await page.screenshot({path:'/tmp/mizhan-cloud-signin.png'});
 assert.deepEqual(errors,[]);console.log('Cloud sign-in UI passed: accessible before local registration, passphrase step and legacy vault guidance. OAuth transport is fixture-only.');
}finally{await app.close();fs.rmSync(profile,{recursive:true,force:true})}
