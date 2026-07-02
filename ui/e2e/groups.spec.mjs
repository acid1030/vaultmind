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

  // Navigate to Groups
  await window.click('nav button:has-text("用户组")');
  await window.waitForTimeout(800);

  // Create a group
  const groupName = `E2E Group ${Date.now()}`;
  await window.fill('input[placeholder="组名称，例如：研发团队"]', groupName);
  await window.click('button:has-text("创建用户组")');
  await window.waitForTimeout(1500);

  await window.screenshot({ path: '/tmp/electron-group-created.png' });

  // Verify group appears in list
  const groupLocator = window.locator(`text=${groupName}`).first();
  const isVisible = await groupLocator.isVisible().catch(() => false);
  if (!isVisible) {
    throw new Error(`Created group "${groupName}" not found in list`);
  }

  // Invite a member
  await window.fill('input[placeholder="成员邮箱"]', 'member@example.com');
  await window.click('button:has-text("邀请")');
  await window.waitForTimeout(1500);

  // Verify invite code appears
  const inviteCode = await window.locator('code').textContent().catch(() => '');
  if (!inviteCode || inviteCode.length < 4) {
    throw new Error('Invite code was not generated');
  }

  await window.screenshot({ path: '/tmp/electron-group-invite.png' });

  // Test key rotation
  await window.click('button:has-text("轮换密钥")');
  await window.waitForTimeout(1500);

  await window.screenshot({ path: '/tmp/electron-group-rotate.png' });

  console.log('Groups test passed');
  console.log('Errors:', JSON.stringify(errors, null, 2));
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
})();
