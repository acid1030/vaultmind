import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'axonmind-attachment-e2e-'));
const env = { ...process.env, NODE_ENV: 'production', AXONMIND_E2E: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: [root, `--user-data-dir=${profile}`], env });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => window.vaultApi.register({ email: 'images@example.com', username: '附件测试', password: 'ImagePass123!' }));
  await page.reload();
  await page.locator('nav').getByRole('button', { name: '聊天', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('button[aria-label="截图"]')?.disabled === false);
  assert.ok(await page.getByRole('button', { name: '截图', exact: true }).isEnabled());
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 260;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#14344b'; ctx.fillRect(0, 0, 480, 260);
    ctx.fillStyle = '#22c9e8'; ctx.font = 'bold 28px sans-serif'; ctx.fillText('AxonMind', 36, 65);
    ctx.fillStyle = '#dceaf0'; ctx.font = '18px sans-serif'; ctx.fillText('Encrypted image attachment', 36, 112);
    ctx.fillStyle = '#1b5269'; ctx.fillRect(36, 155, 408, 65);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const imagePath = path.join(profile, '设计截图.png');
  const filePath = path.join(profile, '项目说明.txt');
  const savedPath = path.join(profile, 'saved-report.txt');
  fs.writeFileSync(imagePath, Buffer.from(png, 'base64'));
  fs.writeFileSync(filePath, '这是聊天文件内容。\n附件保存测试。');
  const pick = async paths => app.evaluate(({ dialog }, paths) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths }); }, paths);
  await pick([imagePath]);
  await page.getByRole('button', { name: '发送图片', exact: true }).click();
  await page.getByAltText('待发送 设计截图.png').waitFor();
  assert.equal((await page.evaluate(() => window.vaultApi.listChat({ scope: 'personal' }))).messages.length, 0, 'choosing an image must not send it');
  await page.getByRole('button', { name: '移除附件 设计截图.png', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '发送消息', exact: true }).isDisabled(), true);
  await pick([imagePath, filePath]);
  await page.getByRole('button', { name: '发送文件', exact: true }).click();
  await page.getByRole('button', { name: '移除附件 项目说明.txt', exact: true }).waitFor();
  await page.getByRole('textbox', { name: '消息内容' }).fill('图片和文件都可以发送，其他设备同步后可查看。');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page.getByRole('log', { name: '聊天记录' }).getByRole('button', { name: '预览图片 设计截图.png', exact: true }).waitFor();
  const first = (await page.evaluate(() => window.vaultApi.listChat({ scope: 'personal' }))).messages[0];
  assert.equal(first.attachments.length, 2);
  await page.getByRole('log', { name: '聊天记录' }).getByRole('button', { name: '预览图片 设计截图.png', exact: true }).click();
  await page.getByRole('dialog', { name: '图片预览 设计截图.png', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, savedPath);
  await page.getByRole('log', { name: '聊天记录' }).getByRole('button', { name: '保存 项目说明.txt', exact: true }).click();
  await page.getByText('附件已保存', { exact: true }).waitFor();
  assert.equal(fs.readFileSync(savedPath, 'utf8'), fs.readFileSync(filePath, 'utf8'));

  if (await page.getByRole('button', { name: '会话资料', exact: true }).getAttribute('aria-expanded') === 'false') await page.getByRole('button', { name: '会话资料', exact: true }).click();
  const details = page.getByRole('complementary', { name: '会话资料', exact: true });
  await details.getByRole('textbox', { name: '搜索共享附件' }).fill('项目说明');
  assert.equal(await details.locator('.vm-chat-attachment').count(), 1);
  await details.getByRole('button', { name: '保存 项目说明.txt', exact: true }).click();
  await page.getByRole('button', { name: '关闭会话资料', exact: true }).click();

  // Synthetic clipboard/drop events exercise FileReader + IPC without changing the user's clipboard.
  await page.getByRole('textbox', { name: '消息内容' }).evaluate((element, png) => {
    const data = new DataTransfer();
    data.items.add(new File([Uint8Array.from(atob(png), value => value.charCodeAt(0))], '粘贴图片.png', { type: 'image/png' }));
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, png);
  await page.getByAltText('待发送 粘贴图片.png').waitFor();
  await page.locator('section.vm-chat-conversation').evaluate(element => {
    const data = new DataTransfer(); data.items.add(new File(['拖入的内容'], '拖入文件.txt', { type: 'text/plain' }));
    element.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }));
  });
  await page.getByRole('button', { name: '移除附件 拖入文件.txt', exact: true }).waitFor();
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page.getByRole('button', { name: '预览图片 粘贴图片.png', exact: true }).waitFor();
  const history = await page.evaluate(() => window.vaultApi.listChat({ scope: 'personal' }));
  assert.equal(history.messages.length, 2);
  assert.ok(history.messages.some(message => !message.text && message.attachments.length === 2));
  await page.evaluate(() => window.vaultApi.changeLocalPassword({ currentPassword: 'ImagePass123!', newPassword: 'ChangedImagePass123!' }));
  const preview = await page.evaluate(message => window.vaultApi.getChatAttachment({ scope: 'personal', messageId: message.id, attachmentId: message.attachments[0].id }), first);
  assert.ok(preview.preview.startsWith('data:image/png;base64,'), 'password changes must preserve cached binary readability');
  const composerInView = async () => {
    const rect = await page.getByRole('button', { name: '发送消息', exact: true }).boundingBox();
    assert.ok(rect && rect.y >= 0 && rect.y + rect.height <= (await page.evaluate(() => window.innerHeight)), 'attachment history must scroll inside the conversation without pushing the composer below the viewport');
  };
  await composerInView();
  await page.screenshot({ path: '/tmp/axonmind-chat-attachments.png' });
  await page.setViewportSize({ width: 1000, height: 720 });
  await composerInView();
  await page.screenshot({ path: '/tmp/axonmind-chat-attachments-compact.png' });
  assert.ok(await page.getByRole('button', { name: '发送文件', exact: true }).isVisible());
  assert.deepEqual(errors, []);
  console.log('Chat attachment Electron E2E passed: picker, draft removal, paste/drop, image preview, file save, password change and compact layout.');
} finally {
  await app.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
