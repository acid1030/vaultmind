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

  // ---- Theme toggle test ----
  // Detect initial theme (should be dark by default)
  const initialHtmlClass = await window.locator('html').getAttribute('class').catch(() => '');
  console.log('Initial html class:', JSON.stringify(initialHtmlClass));

  // Find theme toggle button
  const toggle = window.locator('button[title="切换亮色模式"], button[title="切换暗色模式"]');
  const toggleCount = await toggle.count();
  if (toggleCount === 0) {
    throw new Error('Theme toggle button not found');
  }

  const toggleTitle = await toggle.getAttribute('title');
  console.log('Toggle button title:', toggleTitle);

  // Click to switch to light mode
  await toggle.click();
  await window.waitForTimeout(800);

  const lightHtmlClass = await window.locator('html').getAttribute('class').catch(() => '');
  console.log('After toggle html class:', JSON.stringify(lightHtmlClass));

  if (!lightHtmlClass || !lightHtmlClass.includes('light')) {
    throw new Error(`Expected 'light' class on html after toggle, got: "${lightHtmlClass}"`);
  }
  console.log('Theme toggle: dark -> light passed');

  // Click again to switch back to dark mode
  await toggle.click();
  await window.waitForTimeout(800);

  const darkHtmlClass = await window.locator('html').getAttribute('class').catch(() => '');
  console.log('After 2nd toggle html class:', JSON.stringify(darkHtmlClass));
  if (darkHtmlClass && darkHtmlClass.includes('light')) {
    throw new Error(`Expected no 'light' class on html after 2nd toggle, got: "${darkHtmlClass}"`);
  }
  console.log('Theme toggle: light -> dark passed');

  await window.screenshot({ path: '/tmp/electron-theme-test.png' });

  // ---- DingTalk disabled test ----
  // Find the DingTalk nav button
  const dingtalkBtn = window.locator('nav button:has-text("钉钉")');
  const dingtalkVisible = await dingtalkBtn.isVisible().catch(() => false);

  if (!dingtalkVisible) {
    throw new Error('DingTalk nav button not found');
  }

  // Check that it's visually disabled (opacity or pointer-events)
  const opacity = await dingtalkBtn.evaluate(el => window.getComputedStyle(el).opacity);
  const pointerEvents = await dingtalkBtn.evaluate(el => window.getComputedStyle(el).pointerEvents);
  console.log('DingTalk button opacity:', opacity, 'pointerEvents:', pointerEvents);

  if (parseFloat(opacity) > 0.5) {
    throw new Error(`DingTalk button should be dimmed, opacity=${opacity}`);
  }
  if (pointerEvents !== 'none') {
    throw new Error(`DingTalk button should have pointer-events: none, got: ${pointerEvents}`);
  }

  // Verify it has tooltip "即将推出"
  const dingtalkTitle = await dingtalkBtn.getAttribute('title').catch(() => '');
  if (dingtalkTitle !== '即将推出') {
    throw new Error(`DingTalk button title should be "即将推出", got: "${dingtalkTitle}"`);
  }
  console.log('DingTalk disabled state passed (opacity, pointer-events, tooltip)');

  await window.screenshot({ path: '/tmp/electron-dingtalk-test.png' });

  // Filter out network errors (Feishu sync not connected)
  const criticalErrors = errors.filter(e => !e.includes('ERR_CONNECTION'));
  console.log('Theme & DingTalk test passed');
  console.log('Critical errors:', JSON.stringify(criticalErrors, null, 2));
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
})();
