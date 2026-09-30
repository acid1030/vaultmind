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

  // Close the reveal panel and verify the shared destructive-action dialog.
  await window.locator('.glass-panel button:has-text("关闭")').click();
  await window.locator('button[title="删除"]').first().click({ force: true });
  const confirmDialog = window.getByRole('alertdialog');
  await confirmDialog.waitFor({ state: 'visible' });
  if (!await confirmDialog.getByText('删除加密凭据？').isVisible()) {
    throw new Error('Shared confirmation dialog did not show the expected copy');
  }
  await window.screenshot({ path: '/tmp/electron-confirm-dialog.png' });
  await confirmDialog.getByRole('button', { name: '取消' }).click();
  if (!await itemLocator.isVisible()) throw new Error('Canceling deletion removed the secret');

  await window.locator('button[title="删除"]').first().click({ force: true });
  await window.getByRole('alertdialog').getByRole('button', { name: '删除凭据' }).click();
  await window.waitForTimeout(500);
  if (await itemLocator.isVisible().catch(() => false)) throw new Error('Confirmed deletion did not remove the secret');
  if (!await window.getByRole('button', { name: '添加第一条凭据' }).isVisible()) {
    throw new Error('Actionable empty state did not appear after deleting the last secret');
  }

  console.log('Password vault test passed');
  console.log('Errors:', JSON.stringify(errors, null, 2));
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
})();
