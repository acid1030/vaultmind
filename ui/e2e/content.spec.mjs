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

  // Select text mode
  await window.click('button:has-text("文本")');

  // Fill and save
  const title = `E2E Note ${Date.now()}`;
  await window.fill('input[placeholder="内容标题"]', title);
  await window.fill('textarea[placeholder="文本、笔记或备注"]', 'This is an end-to-end test note.');
  await window.fill('input[placeholder="api, config, important"]', 'e2e, test');
  await window.click('button:has-text("保存")');
  await window.waitForTimeout(1500);

  await window.screenshot({ path: '/tmp/electron-add-content.png' });

  // Navigate to Library
  await window.click('nav button:has-text("内容库")');
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

  await window.screenshot({ path: '/tmp/electron-library-search.png' });

  console.log('Content library test passed');
  console.log('Errors:', JSON.stringify(errors, null, 2));
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
})();
