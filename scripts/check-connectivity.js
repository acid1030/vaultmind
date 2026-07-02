#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const initSqlJs = require('sql.js');

const dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'vaultmind', 'secure-vault.sqlite');

function readState(db, key) {
  const stmt = db.prepare('SELECT value FROM app_state WHERE key = ?');
  stmt.bind([key]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const raw = stmt.get()[0];
  stmt.free();
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function httpsJson(method, urlText, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlText);
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      method,
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      headers: {
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode || 0, text });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function testDeepSeek(baseUrl, apiKey, model) {
  const root = baseUrl.replace(/\/$/, '');
  const candidates = root.endsWith('/v1') ? [root] : [root, `${root}/v1`];
  const errors = [];
  for (const candidate of candidates) {
    const endpoint = `${candidate}/chat/completions`;
    const { status, text } = await httpsJson('POST', endpoint, {
      Authorization: `Bearer ${apiKey}`,
    }, {
      model: model || 'deepseek-chat',
      messages: [{ role: 'user', content: 'reply with OK only' }],
      max_tokens: 8,
      temperature: 0,
    });
    if (status < 400) return `模型 API 响应正常 (${endpoint})`;
    let msg = text.slice(0, 280);
    try {
      const j = JSON.parse(text);
      msg = j.error?.message || j.msg || msg;
    } catch { /* ignore */ }
    errors.push(`${endpoint} → HTTP ${status}: ${msg}`);
  }
  throw new Error(errors.join(' | '));
}

async function main() {
  if (!fs.existsSync(dbPath)) {
    console.error('数据库不存在');
    process.exit(1);
  }
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });
  const db = new SQL.Database(fs.readFileSync(dbPath));
  const aiStmt = db.prepare('SELECT base_url, model, api_key FROM ai_profiles LIMIT 1');
  if (!aiStmt.step()) {
    console.log('✗ DeepSeek: 无 ai_profiles');
    process.exit(2);
  }
  const [baseUrl, model, apiKey] = aiStmt.get();
  aiStmt.free();

  console.log('=== 连通性探测（联网）===\n');
  try {
    const msg = await testDeepSeek(baseUrl, apiKey, model);
    console.log(`✓ DeepSeek (${model}): ${msg}`);
  } catch (e) {
    console.log(`✗ DeepSeek: ${e.message}`);
    if (String(baseUrl).includes('api.deepseek.com') && !String(baseUrl).includes('/v1')) {
      console.log('  提示: DeepSeek 官方地址通常为 https://api.deepseek.com/v1');
    }
  }

  const feishu = readState(db, 'feishuToken');
  if (!feishu || !feishu.accessToken) {
    console.log('✗ 飞书 API: 跳过（本地未保存登录 token，请在应用内重新登录飞书）');
    process.exit(0);
  }

  try {
    const { status, text } = await httpsJson(
      'GET',
      'https://open.feishu.cn/open-apis/authen/v1/user_info',
      { Authorization: `Bearer ${feishu.accessToken}` },
    );
    if (status >= 400) throw new Error(`HTTP ${status}: ${text.slice(0, 200)}`);
    const j = JSON.parse(text);
    if (j.code !== 0) throw new Error(j.msg || `code ${j.code}`);
    const name = j.data && j.data.name ? j.data.name : '已认证';
    console.log(`✓ 飞书 API: 用户 ${name}`);
  } catch (e) {
    console.log(`✗ 飞书 API: ${e.message}（可能 token 过期，请应用内重新登录）`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
