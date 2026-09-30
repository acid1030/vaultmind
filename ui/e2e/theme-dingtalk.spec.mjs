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
    env: { ...process.env, NODE_ENV: 'production', AXONMIND_E2E: '1' },
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

  // Audit every primary page for accidental near-black panels in light mode.
  const pageNames = ['概览', '知识库', '密码库', '添加内容', '用户组', '同步中心', '开发连接', '设置'];
  for (const pageName of pageNames) {
    const navButton = window.locator(`nav button:has-text("${pageName}")`).first();
    if (!await navButton.isVisible().catch(() => false)) continue;
    await navButton.click();
    await window.waitForTimeout(250);
    const darkPanels = await window.locator('main div, main section, main article, main button').evaluateAll(elements => elements
      .filter(element => {
        const rect = element.getBoundingClientRect();
        if (rect.width < 120 || rect.height < 36 || rect.bottom < 0 || rect.top > innerHeight) return false;
        if (element.closest('.vm-terminal')) return false;
        const match = getComputedStyle(element).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
        if (!match || Number(match[4] || 1) < 0.5) return false;
        return Number(match[1]) + Number(match[2]) + Number(match[3]) < 135;
      })
      .slice(0, 5)
      .map(element => ({ tag: element.tagName, className: element.className, text: (element.textContent || '').trim().slice(0, 60), background: getComputedStyle(element).backgroundColor })));
    if (darkPanels.length) throw new Error(`${pageName} 亮色模式存在近黑色面板: ${JSON.stringify(darkPanels)}`);
    if (pageName === '同步中心') await window.screenshot({ path: '/tmp/electron-light-sync.png', fullPage: true });
  }
  console.log('Light theme page audit passed');

  // Click again to switch back to dark mode
  await toggle.click();
  await window.waitForTimeout(800);

  const darkHtmlClass = await window.locator('html').getAttribute('class').catch(() => '');
  console.log('After 2nd toggle html class:', JSON.stringify(darkHtmlClass));
  if (darkHtmlClass && darkHtmlClass.includes('light')) {
    throw new Error(`Expected no 'light' class on html after 2nd toggle, got: "${darkHtmlClass}"`);
  }
  console.log('Theme toggle: light -> dark passed');

  // Audit the same routes for accidental light surfaces in dark mode.
  for (const pageName of pageNames) {
    const navButton = window.locator(`nav button:has-text("${pageName}")`).first();
    if (!await navButton.isVisible().catch(() => false)) continue;
    await navButton.click();
    await window.waitForTimeout(250);
    const lightPanels = await window.locator('main div, main section, main article, main button').evaluateAll(elements => elements
      .filter(element => {
        const rect = element.getBoundingClientRect();
        if (rect.width < 120 || rect.height < 36 || rect.bottom < 0 || rect.top > innerHeight) return false;
        const match = getComputedStyle(element).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
        if (!match || Number(match[4] || 1) < 0.5) return false;
        return Number(match[1]) + Number(match[2]) + Number(match[3]) > 705;
      })
      .slice(0, 5)
      .map(element => ({ tag: element.tagName, className: element.className, text: (element.textContent || '').trim().slice(0, 60), background: getComputedStyle(element).backgroundColor })));
    if (lightPanels.length) throw new Error(`${pageName} 暗色模式存在近白色面板: ${JSON.stringify(lightPanels)}`);
  }
  console.log('Dark theme page audit passed');

  await window.screenshot({ path: '/tmp/electron-theme-test.png' });

  // ---- Unfinished feature navigation test ----
  const dingtalkBtn = window.locator('nav button:has-text("钉钉")');
  if (await dingtalkBtn.count() !== 0) throw new Error('Unfinished DingTalk entry should not appear in primary navigation');
  console.log('Unfinished DingTalk entry is absent from primary navigation');

  await window.screenshot({ path: '/tmp/electron-dingtalk-test.png' });

  // Filter out network errors (Feishu sync not connected)
  const criticalErrors = errors.filter(e => !e.includes('ERR_CONNECTION'));
  console.log('Theme and navigation test passed');
  console.log('Critical errors:', JSON.stringify(criticalErrors, null, 2));
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
})();
