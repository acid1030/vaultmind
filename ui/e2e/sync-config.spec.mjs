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
    env: { ...process.env, NODE_ENV: 'production', AXONMIND_E2E: '1', AXONMIND_MANAGED_SERVICE_URL: '' },
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
  await window.click('nav button:has-text("设置")');
  await window.waitForTimeout(800);

  // Verify config center loads
  const configHeader = await window.getByRole('heading', { name: '配置中心', exact: true }).isVisible().catch(() => false);
  if (!configHeader) {
    throw new Error('Config view did not load correctly');
  }

  // Verify all three sync access modes and their mode-specific fields.
  await window.click('button:has-text("飞书同步")');
  await window.getByRole('radio', { name: /AxonMind 托管/ }).waitFor();
  await window.getByRole('radio', { name: /个人自建/ }).waitFor();
  await window.getByRole('radio', { name: /企业自建/ }).waitFor();
  await window.getByText('托管服务等待上线').waitFor();
  const managedLoginDisabled = await window.getByRole('button', { name: '登录飞书' }).isDisabled();
  if (!managedLoginDisabled) throw new Error('Managed login must be disabled without a configured service');
  await window.getByRole('radio', { name: /个人自建/ }).click();
  await window.locator('input[placeholder="cli_xxx"]').waitFor();
  await window.locator('input[placeholder*="所有设备保持一致"]').waitFor();
  await window.getByRole('radio', { name: /企业自建/ }).click();
  await window.getByText(/由企业管理员创建并授权企业自建应用/).waitFor();

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
