import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'axonmind-screenshot-editor-e2e-'));
const env = { ...process.env, NODE_ENV: 'production', AXONMIND_E2E: '1' }; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: [root, `--user-data-dir=${profile}`], env });
try {
  const page = await app.firstWindow();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => window.vaultApi.register({ email: 'annotation@example.com', username: '截图标注', password: 'Annotation123!' }));
  await page.reload();
  await page.locator('nav').getByRole('button', { name: '概览', exact: true }).waitFor();
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 520;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#20334f'; ctx.fillRect(0, 0, 900, 520);
    ctx.fillStyle = '#e0ebf8'; ctx.font = 'bold 28px sans-serif'; ctx.fillText('AxonMind screenshot annotation', 32, 40);
    for (let x = 620; x < 880; x++) { ctx.fillStyle = x % 2 ? '#e9eef4' : '#18283d'; ctx.fillRect(x, 300, 1, 170); }
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const fixture = path.join(profile, 'fixture.png'); fs.writeFileSync(fixture, Buffer.from(base64, 'base64'));
  // Replace only the native selection adapter. The editor, IPC, global callback,
  // room routing, staging and message encryption all use production code.
  await app.evaluate(({ globalShortcut }, { root, fixture }) => {
    const require = process.getBuiltinModule('module').createRequire(root + '/package.json');
    const fs = require('fs');
    const adapter = require(require('path').join(root, 'src/core/chat-screenshot.js'));
    adapter.captureScreenshot = async () => { globalThis.__captureCount = (globalThis.__captureCount || 0) + 1; return { canceled: false, name: '快捷键截图.png', bytes: fs.readFileSync(fixture) }; };
    const register = globalShortcut.register.bind(globalShortcut);
    globalShortcut.register = (key, callback) => { if (key === 'Control+Alt+F12') return false; globalThis.__captureCallback = callback; return register(key, callback); };
  }, { root, fixture });
  const shortcut = await page.evaluate(() => window.vaultApi.setScreenshotShortcut({ accelerator: 'Control+Alt+F10' }));
  assert.equal(shortcut.registered, true);
  await app.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.hide(); });
  const nextEditor = app.waitForEvent('window');
  await app.evaluate(() => globalThis.__captureCallback());
  const editor = await nextEditor;
  editor.on('pageerror', error => errors.push(error.message));
  await editor.waitForFunction(() => document.querySelector('#canvas').width === 900);
  const canvas = editor.getByLabel('截图标注画布');
  const draw = async (tool, from, to) => {
    await editor.getByRole('button', { name: tool, exact: true }).click();
    const bounds = await canvas.boundingBox();
    await editor.mouse.move(bounds.x + from.x / 900 * bounds.width, bounds.y + from.y / 520 * bounds.height);
    await editor.mouse.down();
    await editor.mouse.move(bounds.x + to.x / 900 * bounds.width, bounds.y + to.y / 520 * bounds.height, { steps: 8 });
    await editor.mouse.up();
  };
  const pixel = (x, y) => editor.evaluate(({ x, y }) => [...document.querySelector('#canvas').getContext('2d').getImageData(x, y, 1, 1).data], { x, y });
  await draw('矩形', { x: 50, y: 60 }, { x: 250, y: 150 });
  assert.ok((await pixel(50, 90))[0] > 200);
  await draw('箭头', { x: 320, y: 70 }, { x: 500, y: 160 });
  await draw('圆形', { x: 470, y: 200 }, { x: 580, y: 280 });
  await draw('画笔', { x: 70, y: 330 }, { x: 260, y: 380 });
  await editor.getByRole('button', { name: '文字', exact: true }).click();
  await editor.getByLabel('文字字号').selectOption('32');
  const bounds = await canvas.boundingBox();
  await editor.mouse.click(bounds.x + 100 / 900 * bounds.width, bounds.y + 210 / 520 * bounds.height);
  await editor.getByLabel('标注文字').fill('中文标注示例\n第二行文字');
  await editor.getByLabel('标注文字').press('Enter');
  assert.equal(await editor.getByLabel('标注文字').isHidden(), true);
  const beforeMosaic = await pixel(652, 350);
  assert.notDeepEqual(beforeMosaic, await pixel(653, 350));
  await draw('马赛克', { x: 640, y: 320 }, { x: 860, y: 450 });
  assert.deepEqual(await pixel(652, 350), await pixel(653, 350));
  await editor.keyboard.press('Control+z');
  assert.deepEqual(await pixel(652, 350), beforeMosaic);
  await editor.keyboard.press('Control+Shift+z');
  assert.deepEqual(await pixel(652, 350), await pixel(653, 350));
  await editor.getByRole('button', { name: '清空标注', exact: true }).click();
  assert.ok((await pixel(50, 90))[0] < 100);
  await editor.getByRole('button', { name: '撤销', exact: true }).click();
  assert.ok((await pixel(50, 90))[0] > 200);
  await editor.screenshot({ path: '/tmp/axonmind-screenshot-annotation.png' });
  await editor.getByRole('button', { name: '完成并加入聊天', exact: true }).click();
  await page.getByRole('button', { name: '移除附件 快捷键截图.png', exact: true }).waitFor();
  assert.equal((await page.evaluate(() => window.vaultApi.listChat({ scope: 'personal' }))).messages.length, 0, 'shortcut completion must only populate the draft');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page.getByRole('button', { name: '预览图片 快捷键截图.png', exact: true }).waitFor();
  const history = await page.evaluate(() => window.vaultApi.listChat({ scope: 'personal' }));
  const saved = await page.evaluate(message => window.vaultApi.getChatAttachment({ scope: 'personal', messageId: message.id, attachmentId: message.attachments[0].id }), history.messages[0]);
  const size = await page.evaluate(async preview => { const image = new Image(); image.src = preview; await image.decode(); return [image.naturalWidth, image.naturalHeight]; }, saved.preview);
  assert.deepEqual(size, [900, 520], 'display scaling must never change exported resolution');

  await page.getByRole('button', { name: '截图快捷键设置', exact: true }).click();
  await page.getByRole('textbox', { name: '截图快捷键', exact: true }).press('Control+Alt+F12');
  await page.getByRole('button', { name: '保存快捷键', exact: true }).click();
  await page.getByText('该截图快捷键已被系统或其他应用占用，请更换组合键', { exact: true }).waitFor();
  assert.equal((await page.evaluate(() => window.vaultApi.getScreenshotShortcut())).accelerator, 'Control+Alt+F10');
  await page.getByRole('textbox', { name: '截图快捷键', exact: true }).press('Control+Alt+F11');
  await page.getByRole('button', { name: '保存快捷键', exact: true }).click();
  await page.getByText('截图快捷键已保存', { exact: true }).waitFor();
  assert.equal((await page.evaluate(() => window.vaultApi.getScreenshotShortcut())).accelerator, 'Control+Alt+F11');
  await page.getByRole('button', { name: '关闭对话框', exact: true }).click();

  const canceledEditor = app.waitForEvent('window');
  await page.getByRole('button', { name: '截图', exact: true }).click();
  const canceledPage = await canceledEditor;
  await canceledPage.waitForFunction(() => document.querySelector('#canvas').width === 900);
  await Promise.all([canceledPage.waitForEvent('close'), canceledPage.keyboard.press('Escape').catch(error => { if (!error.message.includes('closed')) throw error; })]);
  await page.waitForFunction(() => !document.querySelector('button[aria-label="截图"]').disabled);
  assert.equal(await page.locator('.vm-chat-draft-file').count(), 0);
  const staged = await page.evaluate(base64 => window.vaultApi.stageChatData({ scope: 'personal', files: [{ name: '已有图片.png', base64 }] }), base64);
  // Route a staged fixture through the same draft-delivery event used by global capture.
  await app.evaluate(({ BrowserWindow }, attachments) => {
    BrowserWindow.getAllWindows()[0].webContents.send('vault:screenshotDelivered', { id: 'fixture-delivery', scope: 'personal', attachments });
  }, staged.attachments);
  await page.getByRole('button', { name: '标注图片 已有图片.png', exact: true }).waitFor();
  const editExisting = app.waitForEvent('window');
  await page.getByRole('button', { name: '标注图片 已有图片.png', exact: true }).click();
  const existingPage = await editExisting;
  await existingPage.waitForFunction(() => document.querySelector('#canvas').width === 900);
  await existingPage.getByRole('button', { name: '完成并加入聊天', exact: true }).click();
  await page.getByRole('button', { name: '移除附件 已有图片-标注.png', exact: true }).waitFor();
  assert.equal(await page.locator('.vm-chat-draft-file').count(), 1);
  await page.screenshot({ path: '/tmp/axonmind-annotated-chat.png' });
  assert.deepEqual(errors, []);
  console.log('Screenshot annotation Electron E2E passed: global callback, hidden-app routing, shapes/text/mosaic, undo/redo, source-resolution export, draft-only finish, shortcut conflict/settings, cancellation and draft annotation.');
} finally { await app.close(); fs.rmSync(profile, { recursive: true, force: true }); }
