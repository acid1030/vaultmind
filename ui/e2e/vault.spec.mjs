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

  // Navigate to Vault
  await window.click('nav button:has-text("密码库")');
  await window.waitForTimeout(800);

  // Open add form
  await window.click('button:has-text("添加密码")');

  // Fill form
  const title = `E2E Secret ${Date.now()}`;
  await window.fill('input[placeholder="GitHub 账号 / AWS Key"]', title);
  await window.fill('textarea[placeholder="密码、API Key、SSH 私钥..."]', 'sk-e2e-test-secret-12345');
  await window.click('button:has-text("加密保存")');
  await window.waitForTimeout(1500);

  await window.screenshot({ path: '/tmp/electron-vault-added.png' });

  // Verify item appears
  const itemLocator = window.locator(`text=${title}`).first();
  const isVisible = await itemLocator.isVisible().catch(() => false);
  if (!isVisible) {
    throw new Error(`Created secret "${title}" not found in vault`);
  }

  // Test unlock
  await window.locator('button[title="解锁查看"]').first().click();
  await window.waitForTimeout(800);
  const unlockedText = await window.locator('pre').textContent().catch(() => '');
  if (!unlockedText.includes('sk-e2e-test-secret-12345')) {
    throw new Error('Unlock did not reveal secret content');
  }

  await window.screenshot({ path: '/tmp/electron-vault-unlock.png' });

  console.log('Password vault test passed');
  console.log('Errors:', JSON.stringify(errors, null, 2));
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
})();
