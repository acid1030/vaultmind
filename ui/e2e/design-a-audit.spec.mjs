import { _electron as electron } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mizhan-design-audit-'));
const output = path.join(root, 'docs/design/console-a/audit'); fs.mkdirSync(output, { recursive: true });
const repo = path.join(profile, 'repository'); fs.mkdirSync(repo); execFileSync('git', ['init', '-q', '--initial-branch=main'], { cwd: repo }); fs.writeFileSync(path.join(repo, '验收说明.txt'), '仅用于测试文件变更展示');
const env = { ...process.env, NODE_ENV: 'production', AXONMIND_E2E: '1' }; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: [root, `--user-data-dir=${profile}`], env });
try {
 const page = await app.firstWindow(); const errors = []; page.on('pageerror', e => errors.push(e.message));
 await page.evaluate(async repo => {
  await window.vaultApi.register({ email: 'visual-audit@example.com', username: '对照测试', password: 'VisualAudit123!' });
  for (const [kind, title, tags] of [['text','团队安全规范','安全,规范'],['text','项目架构说明','研发,架构'],['text','知识整理清单','知识'],['web','飞书文档入口','参考'],['secret','开发环境凭据','研发,安全']]) await window.vaultApi.createLibraryItem({ kind,title,tags,content:'仅用于隔离测试的内容',url:kind==='web'?'https://example.com':'',scope:'personal' });
  const state = await window.vaultApi.createGroup({name:'产品研发组',folderToken:'test-folder-not-connected'});
  await window.vaultApi.createLibraryItem({kind:'text',title:'产品研发组协作指南',content:'隔离测试共享资料',scope:'group',groupId:state.groups[0].id});
  await window.vaultApi.saveProjectAccount({label:'测试开发账号',provider:'github',username:'audit',secret:'fixture-only',scope:'personal'});
  await window.vaultApi.saveProjectRepository({name:'秘栈界面验收仓库',tool:'git',remoteUrl:'https://github.com/example/audit.git',localPath:repo,scope:'personal'});
  await window.vaultApi.sendChat({scope:'personal',text:'这是用于页面对照的个人留言。图片与文件可从下方工具栏发送。'});
 }, repo);
 await page.reload(); await page.emulateMedia({ reducedMotion: 'reduce' });
 await page.setViewportSize({width:1600,height:1000});
 for (const [id,label] of [['library','知识库'],['vault','密码库'],['chat','聊天'],['groups','用户组'],['sync','同步中心'],['add','添加内容'],['projects','开发连接'],['config','设置']]) {
  await page.locator(`.vm-sidebar [data-module="${id}"]`).click();
  if(id==='chat' && await page.getByRole('button',{name:'会话资料',exact:true}).getAttribute('aria-expanded') === 'false') await page.getByRole('button',{name:'会话资料',exact:true}).click();
  if(id==='projects') { await page.getByRole('button').filter({hasText:'秘栈界面验收仓库'}).click(); await page.getByRole('button',{name:'Status',exact:true}).click(); await page.getByRole('region',{name:'本次仓库操作记录'}).waitFor(); }
  if(id==='projects') { const changes = page.getByRole('region', {name:'文件变更',exact:true}); await changes.getByText('验收说明.txt', {exact:true}).waitFor(); }
  if(id==='groups') await page.getByRole('region', {name:'共享文件夹信息',exact:true}).waitFor();
  if(id==='sync') await page.getByRole('region', {name:'设备同步状态',exact:true}).waitFor();
  if(id==='add') await page.getByRole('region', {name:'导入说明',exact:true}).waitFor();
  if(id==='config') await page.getByRole('button',{name:'飞书同步 OAuth 登录 + 云盘加密同步',exact:true}).click();
  await page.waitForTimeout(180);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label} horizontal overflow`);
  await page.screenshot({path:path.join(output,`${id}.png`),fullPage:true});
 }
 assert.deepEqual(errors,[]); console.log('Eight-page design audit screenshots captured with isolated fixture data.');
} finally { await app.close(); fs.rmSync(profile,{recursive:true,force:true}); }
