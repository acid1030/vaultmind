import { _electron as electron } from 'playwright-core';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.resolve(__dirname, '..', '..');

async function launchApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultmind-e2e-'));
  const app = await electron.launch({
    args: [appPath, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  return { app, userDataDir };
}

async function register(window) {
  const registerButton = window.locator('button:has-text("注册")').first();
  if (await registerButton.isVisible().catch(() => false)) {
    await registerButton.click();
  }
  await window.fill('input[placeholder="you@example.com"]', `test${Date.now()}@example.com`);
  await window.fill('input[placeholder="你的名字"]', 'TestUser');
  await window.fill('input[placeholder="至少 8 位"]', 'TestPass123!');
  await window.click('button:has-text("创建账户")');
  await window.waitForSelector('button:has-text("我已保存")');
  await window.click('button:has-text("我已保存")');
  await window.waitForTimeout(1500);
}

(async () => {
  const { app, userDataDir } = await launchApp();
  const window = await app.firstWindow();
  const errors = [];
  window.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  window.on('pageerror', err => errors.push(`pageerror: ${err.message}`));

  await window.waitForLoadState('networkidle');
  await register(window);

  // Navigate to Add Content
  await window.click('nav button:has-text("添加")');
  await window.waitForTimeout(500);

  const localDestination = window.getByRole('radio', { name: /保存到本机/ });
  if (await localDestination.getAttribute('aria-checked') !== 'true') {
    throw new Error('Local-first file destination is not the default');
  }

  // Select text mode
  await window.click('button:has-text("文本")');

  // Fill and save
  const title = `E2E Note ${Date.now()}`;
  await window.fill('input[placeholder="内容标题"]', title);
  const sensitiveValue = 'Test@123456';
  const tokenValue = 'ghp_1234567890abcdef1234567890abcdef1234';
  await window.fill('textarea[placeholder="文本、笔记或备注"]', `This is an end-to-end test note. password: ${sensitiveValue} token: ${tokenValue}`);
  await window.fill('input[placeholder="api, config, important"]', 'e2e, test');
  await window.click('button:has-text("保存")');
  await window.waitForTimeout(1500);

  await window.screenshot({ path: '/tmp/electron-add-content.png' });

  // 工作台最近内容可直接打开具体条目，而不是只跳转到知识库。
  await window.click('nav button:has-text("概览")');
  await window.locator('.vm-recent-row', { hasText: title }).click();
  await window.locator('.vm-content-preview').waitFor({ state: 'visible' });
  await window.getByRole('button', { name: '关闭预览' }).click();

  // Navigate to Library
  await window.click('nav button:has-text("知识库")');
  await window.waitForTimeout(800);

  // Verify item appears
  const itemLocator = window.locator(`text=${title}`).first();
  const isVisible = await itemLocator.isVisible().catch(() => false);
  if (!isVisible) {
    throw new Error(`Created item "${title}" not found in library`);
  }

  // Test search
  await window.fill('input[placeholder="搜索标题与标签..."]', title);
  await window.waitForTimeout(500);
  const searchVisible = await itemLocator.isVisible().catch(() => false);
  if (!searchVisible) {
    throw new Error('Search did not keep the created item visible');
  }

  // Test filter (text tab)
  await window.click('button:has-text("文本")');
  await window.waitForTimeout(500);
  const filterVisible = await itemLocator.isVisible().catch(() => false);
  if (!filterVisible) {
    throw new Error('Text filter did not keep the created item visible');
  }

  // 本地文本可直接查看，不需要下载。
  const itemRow = itemLocator.locator('xpath=ancestor::div[contains(@class,"group")]').first();
  if (await itemRow.getByRole('button', { name: '取回' }).count()) {
    throw new Error('Local text item incorrectly requires download');
  }
  await itemRow.getByRole('button', { name: '查看' }).click();
  await window.waitForSelector(`text=${sensitiveValue}`);
  await window.getByRole('button', { name: '关闭', exact: true }).click();

  // 回答需结构化展示、带来源卡片，同时不能泄露凭据。
  const question = window.locator('.vm-library-chat textarea');
  await question.fill(title);
  await question.press('Enter');
  await window.locator('.vm-answer-body h3').first().waitFor({ state: 'visible' });
  await window.locator('.vm-answer-source').first().waitFor({ state: 'visible' });
  const answerText = await window.locator('.vm-answer').last().innerText();
  if (answerText.includes(sensitiveValue) || answerText.includes(tokenValue)) {
    throw new Error('Knowledge answer exposed sensitive content');
  }

  // 全局搜索支持键盘打开当前选中结果。
  await window.keyboard.press('Meta+K');
  const globalSearch = window.locator('.vm-command-input input');
  await globalSearch.fill(title);
  await window.locator('.vm-command-row').first().waitFor({ state: 'visible' });
  await globalSearch.press('Enter');
  await window.locator('.vm-search-preview').waitFor({ state: 'visible' });
  await window.locator('.vm-command-panel button').first().click();
  await window.keyboard.press('Escape');

  // 本地文件导入会立即成为本机可用内容，不产生“待取回”状态。
  const localFileName = `local-product-note-${Date.now()}.txt`;
  const localFilePath = path.join(userDataDir, localFileName);
  fs.writeFileSync(localFilePath, 'Local-first file content for product workflow.', 'utf8');
  const imported = await window.evaluate(async ({ filePath, fileName }) => {
    const result = await window.vaultApi.importFiles({ filePaths: [filePath], scope: 'personal' });
    return {
      failures: result.failures,
      item: result.state.items.find(entry => entry.name === fileName),
    };
  }, { filePath: localFilePath, fileName: localFileName });
  if (imported.failures.length || !imported.item || imported.item.remoteOnly || !imported.item.localOnly) {
    throw new Error('Local file import did not produce an immediately available local item');
  }

  await window.screenshot({ path: '/tmp/electron-library-answer.png' });

  console.log('Content library test passed');
  console.log('Errors:', JSON.stringify(errors, null, 2));
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
})();
