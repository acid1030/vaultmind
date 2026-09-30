import { _electron as electron } from 'playwright-core';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.resolve(__dirname, '..', '..');

(async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultmind-e2e-'));
  const app = await electron.launch({
    args: [appPath, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  const errors = [];
  window.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  window.on('pageerror', err => errors.push(`pageerror: ${err.message}`));

  await window.waitForLoadState('networkidle');
  await window.waitForTimeout(1000);

  await window.waitForSelector('.vm-auth-frame');
  const authImagesReady = await window.locator('.vm-auth-frame img').evaluateAll(images =>
    images.length >= 2 && images.every(image => image.complete && image.naturalWidth > 0),
  );
  if (!authImagesReady) throw new Error('Brand images did not load on the authentication screen');

  // Take screenshot of initial state
  await window.screenshot({ path: '/tmp/electron-initial.png' });

  // Check if we're on login/register page
  const title = await window.locator('h1').textContent().catch(() => '');
  console.log('Title:', title);

  // If register mode is shown, fill and submit
  const registerButton = window.locator('button:has-text("注册")').first();
  if (await registerButton.isVisible().catch(() => false)) {
    await registerButton.click();
  }

  await window.fill('input[placeholder="you@example.com"]', `test${Date.now()}@example.com`);
  await window.fill('input[placeholder="你的名字"]', 'TestUser');
  await window.fill('input[placeholder="至少 8 位"]', 'TestPass123!');
  await window.click('button:has-text("创建账户")');
  await window.waitForSelector('text=请妥善保存以下恢复码');
  await window.screenshot({ path: '/tmp/electron-recovery-code.png' });
  await window.click('button:has-text("我已保存")');
  await window.waitForTimeout(1200);
  await window.screenshot({ path: '/tmp/electron-registered.png' });

  const appImagesReady = await window.locator('img').evaluateAll(images =>
    images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0),
  );
  if (!appImagesReady) throw new Error('A generated interface image failed to load');

  const brandName = await window.locator('.vm-brand strong').textContent();
  if (brandName?.trim() !== 'AxonMind') throw new Error(`Unexpected product brand: ${brandName}`);

  const backup = await window.evaluate(() => window.vaultApi.createBackup());
  if (!backup?.path || !fs.existsSync(backup.path)) throw new Error('Manual database backup was not created');
  const backups = await window.evaluate(() => window.vaultApi.listBackups());
  if (!backups.some(item => item.path === backup.path)) throw new Error('Created backup is missing from backup inventory');

  console.log('Errors:', JSON.stringify(errors, null, 2));
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
})();
