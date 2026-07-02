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

  // Navigate to Projects
  await window.click('nav button:has-text("项目")');
  await window.waitForTimeout(800);

  // Add account
  await window.click('button:has-text("账号")');
  await window.waitForTimeout(300);
  // Click plus button in the account panel header
  await window.locator('h2:has-text("Git/SVN 账号")').locator('xpath=..').locator('button').first().click();
  await window.waitForTimeout(500);
  await window.screenshot({ path: '/tmp/electron-project-before-account.png' });

  await window.fill('input[placeholder="例如：work-github"]', 'test-account');
  await window.fill('input[placeholder="access token 或密码"]', 'ghp_test_token');
  await window.click('button:has-text("保存账号")');
  await window.waitForTimeout(1000);

  await window.screenshot({ path: '/tmp/electron-project-account.png' });

  // Add repository
  await window.click('button:has-text("项目仓库")');
  await window.waitForTimeout(300);
  // Click plus button in the repo panel header
  await window.locator('h2:has-text("仓库列表")').locator('xpath=..').locator('button').first().click();

  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultmind-repo-'));
  // Initialize a git repo so status works
  try {
    const { execSync } = await import('child_process');
    execSync('git init', { cwd: repoDir });
  } catch {
    // git may not be available; status will still exercise the action path
  }
  const repoName = `E2E Repo ${Date.now()}`;
  await window.fill('input[placeholder="例如：my-project"]', repoName);
  await window.fill('input[placeholder="https://github.com/org/repo.git"]', 'https://github.com/example/repo.git');
  await window.fill('input[placeholder="/path/to/local"]', repoDir);
  await window.click('button:has-text("添加项目")');
  await window.waitForTimeout(1000);

  await window.screenshot({ path: '/tmp/electron-project-repo.png' });

  // Verify repo appears and select it
  const repoLocator = window.locator(`text=${repoName}`).first();
  const isVisible = await repoLocator.isVisible().catch(() => false);
  if (!isVisible) {
    throw new Error(`Created repo "${repoName}" not found in list`);
  }
  await repoLocator.click();
  await window.waitForTimeout(500);

  // Run status action
  await window.click('button:has-text("Status")');
  await window.waitForTimeout(1500);

  await window.screenshot({ path: '/tmp/electron-project-status.png' });
  const output = await window.locator('pre').textContent().catch(() => '');
  console.log('Project action output:', output);
  if (!output || output.includes('等待操作')) {
    throw new Error('Project action output not displayed');
  }

  console.log('Projects test passed');
  console.log('Errors:', JSON.stringify(errors, null, 2));
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
})();
