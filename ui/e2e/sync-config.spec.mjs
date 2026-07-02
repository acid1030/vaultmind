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

  // Navigate to Sync
  await window.click('nav button:has-text("同步")');
  await window.waitForTimeout(800);

  // Verify sync center loads (shows Feishu status)
  const syncStatus = await window.locator('text=飞书未连接').isVisible().catch(() => false);
  if (!syncStatus) {
    throw new Error('Sync center did not load correctly');
  }

  await window.screenshot({ path: '/tmp/electron-sync.png' });

  // Navigate to Config
  await window.click('nav button:has-text("配置")');
  await window.waitForTimeout(800);

  // Verify config center loads
  const configHeader = await window.locator('text=配置中心').isVisible().catch(() => false);
  if (!configHeader) {
    throw new Error('Config view did not load correctly');
  }

  // Save recovery info
  await window.click('button:has-text("账户恢复")');
  await window.waitForTimeout(500);
  await window.screenshot({ path: '/tmp/electron-config-recovery.png' });
  await window.fill('input[placeholder="+86 手机号"]', '13800138000');
  await window.fill('input[placeholder="recovery@example.com"]', 'recovery@example.com');
  await window.click('button:has-text("保存恢复资料")');
  await window.waitForTimeout(1000);

  await window.screenshot({ path: '/tmp/electron-config.png' });

  console.log('Sync & Config test passed');
  console.log('Errors:', JSON.stringify(errors, null, 2));
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
})();
