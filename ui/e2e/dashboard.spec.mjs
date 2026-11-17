import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mizhan-dashboard-'));
const env = { ...process.env, NODE_ENV: 'production', AXONMIND_E2E: '1' }; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: [root, `--user-data-dir=${profile}`], env });
try {
  const page = await app.firstWindow(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(async () => {
    await window.vaultApi.register({ email: 'dashboard@example.com', username: '首页测试', password: 'Dashboard123!' });
    await window.vaultApi.createLibraryItem({ kind: 'text', title: '隐私与安全使用指南', content: '用于首页验收的普通笔记', tags: '隐私,安全', scope: 'personal' });
    await window.vaultApi.createLibraryItem({ kind: 'text', title: '项目协作规范', content: '团队协作测试资料', tags: '团队,规范', scope: 'personal' });
    await window.vaultApi.createLibraryItem({ kind: 'web', title: '知识来源入口', url: 'https://example.com', tags: '工具,安全', scope: 'personal' });
    await window.vaultApi.createLibraryItem({ kind: 'secret', title: '测试凭据', content: 'fixture-value-only', tags: '安全', scope: 'personal' });
    await window.vaultApi.createGroup({ name: '研发协作组' });
  });
  await page.reload();
  await page.getByRole('article', { name: '知识流转', exact: true }).waitFor();
  const flow = page.locator('.vm-workspace-flow');
  assert.match(await flow.getAttribute('aria-label'), /可见内容 4/);
  const signal = flow.locator('.vm-flow-signal').first();
  assert.equal(await signal.evaluate(el => getComputedStyle(el).animationName), 'vm-flow-travel');
  assert.equal(await page.locator('.vm-dashboard-stat').count(), 4);
  assert.equal(await page.locator('.vm-dashboard-spark').count(), 4);
  assert.equal(await page.locator('.vm-dashboard-stat-value').first().textContent(), '4条可见内容');
  await page.getByRole('group', { name: '图谱视图' }).getByRole('button', { name: '标签', exact: true }).click();
  await page.getByRole('heading', { name: '标签分布 · Top 5' }).waitFor();
  assert.ok((await page.locator('.vm-orb-breakdown').textContent()).includes('安全'));
  await page.getByRole('group', { name: '图谱视图' }).getByRole('button', { name: '全局', exact: true }).click();
  const recent = page.getByRole('group', { name: '最近内容筛选' });
  await recent.getByRole('button', { name: '密码', exact: true }).click();
  assert.equal(await page.locator('.vm-recent-row').count(), 1);
  assert.ok((await page.locator('.vm-recent-row').textContent()).includes('测试凭据'));
  assert.equal(await page.getByText('fixture-value-only', { exact: true }).count(), 0, 'dashboard never reveals credential bodies');
  await recent.getByRole('button', { name: '全部', exact: true }).click();
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.getByRole('button', { name: '切换暗色模式' }).click();
  const orb = page.getByRole('article', { name: '知识网络图谱', exact: true }).locator('canvas');
  await orb.waitFor();
  assert.equal(await flow.count(), 0);
  const frame = await orb.evaluate(canvas => canvas.toDataURL());
  await page.waitForFunction(previous => document.querySelector('.vm-orb-canvas')?.toDataURL() !== previous, frame);
  await page.screenshot({ path: '/tmp/mizhan-orb-dashboard.png', fullPage: true });
  await page.getByRole('button', { name: '切换亮色模式' }).click();
  await flow.waitFor();
  assert.equal(await page.locator('.vm-orb-canvas').count(), 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await signal.evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.screenshot({ path: '/tmp/mizhan-orb-dashboard-light.png', fullPage: true });
  for (const width of [1000, 760]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'dashboard must not overflow');
  }
  await page.screenshot({ path: '/tmp/mizhan-orb-dashboard-compact.png', fullPage: true });
  await page.setViewportSize({ width: 2560, height: 1310 });
  const wide = await page.evaluate(() => {
    const page = document.querySelector('.vm-page[data-view="home"]');
    const dashboard = page.querySelector('.vm-home-console');
    const bounds = page.getBoundingClientRect();
    const panel = dashboard.getBoundingClientRect();
    const style = getComputedStyle(page);
    return {
      left: Math.abs(panel.left - bounds.left - parseFloat(style.paddingLeft)),
      right: Math.abs(bounds.right - panel.right - parseFloat(style.paddingRight)),
      overflow: page.scrollHeight > page.clientHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert.ok(wide.left <= 1 && wide.right <= 1, 'wide dashboard must fill the workspace inside its padding');
  assert.equal(wide.overflow, false, 'wide dashboard must fit without page scrolling');
  assert.deepEqual(errors, []);
  console.log('Dashboard E2E passed: real counts, animated workspace flow, reduced motion, tag view, recent filters, secret masking, themes and compact layouts.');
} finally { await app.close(); fs.rmSync(profile, { recursive: true, force: true }); }
