#!/usr/bin/env node
/**
 * Read-only readiness check against local VaultMind SQLite (no network).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const initSqlJs = require('sql.js');

const dbPath = path.join(
  process.env.VAULTMIND_DATA_DIR
    || path.join(os.homedir(), 'Library', 'Application Support', 'vaultmind'),
  'secure-vault.sqlite',
);

function readState(db, key) {
  const row = db.exec('SELECT value FROM app_state WHERE key = ?', [key]);
  if (!row.length || !row[0].values.length) return null;
  try {
    return JSON.parse(row[0].values[0][0]);
  } catch {
    return row[0].values[0][0];
  }
}

async function main() {
  const checks = [];
  const pass = (name, detail) => checks.push({ name, ok: true, detail });
  const fail = (name, detail) => checks.push({ name, ok: false, detail });
  const warn = (name, detail) => checks.push({ name, ok: 'warn', detail });

  if (!fs.existsSync(dbPath)) {
    fail('本地数据库', `未找到 ${dbPath}，请先在应用中注册/登录`);
    printReport(checks);
    process.exit(1);
  }
  pass('本地数据库', dbPath);

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });
  const db = new SQL.Database(fs.readFileSync(dbPath));

  const users = db.exec('SELECT id, email, username FROM users LIMIT 5');
  if (!users.length || !users[0].values.length) {
    fail('本地账号', 'users 表为空，需注册');
  } else {
    pass('本地账号', users[0].values.map((r) => r[1] || r[2]).join(', '));
  }

  const settings = readState(db, 'settings') || {};
  if (settings.appId) pass('飞书 App ID', settings.appId);
  else fail('飞书 App ID', '未配置');
  if (settings.appSecret) pass('飞书 App Secret', '已保存');
  else fail('飞书 App Secret', '未配置');
  if (settings.folderToken) pass('飞书文件夹 Token', settings.folderToken);
  else warn('飞书文件夹 Token', '未设置，将使用 root');

  const feishuToken = readState(db, 'feishuToken');
  if (feishuToken && feishuToken.accessToken) {
    const exp = feishuToken.expiresAt ? `，过期 ${feishuToken.expiresAt}` : '';
    pass('飞书登录', (feishuToken.user && feishuToken.user.name) || 'access_token 存在' + exp);
  } else {
    fail('飞书登录', '未登录或 token 缺失');
  }

  const wiki = readState(db, 'feishuWiki') || {};
  if (wiki.enabled !== false) pass('飞书 Wiki 检索', wiki.spaceId ? `启用，空间 ${wiki.spaceId}` : '启用（全库）');
  else warn('飞书 Wiki 检索', '已关闭');

  const ai = db.exec('SELECT provider, base_url, model, api_key FROM ai_profiles LIMIT 1');
  if (ai.length && ai[0].values.length) {
    const [provider, baseUrl, model, apiKey] = ai[0].values[0];
    pass('大模型配置', `${provider || '-'} / ${model || '-'} @ ${baseUrl || '-'}`);
    if (apiKey) pass('大模型 API Key', '已保存');
    else fail('大模型 API Key', '为空');
  } else {
    fail('大模型配置', 'ai_profiles 无记录');
  }

  const items = db.exec('SELECT COUNT(*) FROM library_items');
  const records = db.exec('SELECT COUNT(*) FROM records');
  const itemCount = items.length ? items[0].values[0][0] : 0;
  const recordCount = records.length ? records[0].values[0][0] : 0;
  if (itemCount > 0 || recordCount > 0) {
    pass('内容库', `library_items=${itemCount}, records=${recordCount}`);
  } else {
    warn('内容库', '尚无条目，对话可能无匹配；请在「添加」中创建或从飞书拉取');
  }

  const logs = db.exec('SELECT COUNT(*) FROM query_logs');
  const logCount = logs.length ? logs[0].values[0][0] : 0;
  if (logCount > 0) pass('知识库对话历史', `${logCount} 条`);
  else warn('知识库对话历史', '尚无查询记录');

  printReport(checks);
  const blockers = checks.filter((c) => c.ok === false);
  const ready = blockers.length === 0;
  console.log(ready ? '\n结论: 本地配置齐全，可进行日常使用（飞书/模型连通性需你在应用内点测试或实际同步验证）。'
    : `\n结论: 尚有 ${blockers.length} 项未就绪，见上方失败项。`);
  process.exit(ready ? 0 : 2);
}

function printReport(checks) {
  console.log('\n=== VaultMind 就绪检查 ===\n');
  for (const c of checks) {
    const icon = c.ok === true ? '✓' : c.ok === 'warn' ? '!' : '✗';
    console.log(`${icon} ${c.name}: ${c.detail}`);
  }
}

main().catch((err) => {
  console.error('检查失败:', err);
  process.exit(1);
});
