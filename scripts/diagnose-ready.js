#!/usr/bin/env node
/**
 * Readiness check against local VaultMind SQLite (no secrets printed).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const initSqlJs = require('sql.js');

const DB_PATH = process.env.VAULTMIND_DB
  || path.join(process.env.HOME || '', 'Library/Application Support/vaultmind/secure-vault.sqlite');

function mask(s) {
  if (!s) return '(empty)';
  if (s.length <= 6) return '******';
  return `${s.slice(0, 4)}…${s.slice(-2)}`;
}

function getJson(db, key, fallback = null) {
  const stmt = db.prepare('SELECT value FROM app_state WHERE key = ?');
  stmt.bind([key]);
  if (!stmt.step()) {
    stmt.free();
    return fallback;
  }
  const row = stmt.getAsObject();
  stmt.free();
  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}

function httpsJson(method, urlText, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlText);
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = https.request({
      method,
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      headers: {
        Accept: 'application/json',
        ...(payload ? {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': String(Buffer.byteLength(payload)),
        } : {}),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text.slice(0, 300) };
        }
        resolve({ status: res.statusCode || 0, data });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function testDeepSeek(profile) {
  const base = String(profile.base_url || '').replace(/\/$/, '');
  const urls = base.endsWith('/v1') ? [base] : [base, `${base}/v1`];
  const errors = [];
  for (const root of urls) {
    const endpoint = `${root}/chat/completions`;
    const res = await httpsJson('POST', endpoint, {
      headers: { Authorization: `Bearer ${profile.api_key}` },
      body: {
        model: profile.model || 'deepseek-chat',
        messages: [{ role: 'user', content: 'reply with OK only' }],
        max_tokens: 8,
        temperature: 0,
      },
    });
    if (res.status >= 200 && res.status < 300) {
      const reply = res.data?.choices?.[0]?.message?.content || '';
      return { ok: true, endpoint, reply: String(reply).slice(0, 80) };
    }
    errors.push(`${endpoint} → HTTP ${res.status}: ${JSON.stringify(res.data).slice(0, 120)}`);
  }
  return { ok: false, error: errors.join(' | ') };
}

async function testFeishuDrive(accessToken, folderToken) {
  const folder = folderToken || 'root';
  const res = await httpsJson(
    'GET',
    `https://open.feishu.cn/open-apis/drive/v1/files?folder_token=${encodeURIComponent(folder)}&page_size=5`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (res.status >= 200 && res.status < 300 && (res.data.code === 0 || res.data.code === undefined)) {
    const files = res.data?.data?.files || [];
    return { ok: true, fileCount: files.length };
  }
  return { ok: false, error: `HTTP ${res.status} code=${res.data?.code} msg=${res.data?.msg || ''}` };
}

async function refreshFeishuToken(settings, token) {
  if (!token?.refreshToken) return { ok: false, error: '无 refresh_token，需重新登录飞书' };
  const res = await httpsJson('POST', 'https://open.feishu.cn/open-apis/authen/v2/oauth/token', {
    body: {
      grant_type: 'refresh_token',
      client_id: settings.appId,
      client_secret: settings.appSecret,
      refresh_token: token.refreshToken,
    },
  });
  const data = res.data?.data || res.data;
  if (data?.access_token) return { ok: true, accessToken: data.access_token };
  return { ok: false, error: JSON.stringify(res.data).slice(0, 200) };
}

async function main() {
  const report = { checks: [], ready: true, blockers: [], warnings: [] };
  const add = (name, ok, detail, { blocker = true } = {}) => {
    report.checks.push({ name, ok, detail });
    if (!ok && blocker) {
      report.ready = false;
      report.blockers.push(`${name}: ${detail}`);
    } else if (!ok && !blocker) {
      report.warnings.push(`${name}: ${detail}`);
    }
  };

  if (!fs.existsSync(DB_PATH)) {
    console.log(JSON.stringify({ ready: false, error: `数据库不存在: ${DB_PATH}` }, null, 2));
    process.exit(1);
  }

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });
  const db = new SQL.Database(fs.readFileSync(DB_PATH));

  const users = db.exec('SELECT id, email, username FROM users');
  const userCount = users[0]?.values?.length || 0;
  add('本地账号', userCount > 0, userCount > 0 ? `${userCount} 个用户` : '尚未注册');

  const settings = getJson(db, 'settings', {});
  add('飞书 App ID', Boolean(settings.appId), settings.appId ? mask(settings.appId) : '未配置');
  add('飞书 App Secret', Boolean(settings.appSecret), settings.appSecret ? '已保存' : '未配置');
  add('飞书文件夹 Token', Boolean(settings.folderToken), settings.folderToken || 'root');

  const feishuToken = getJson(db, 'feishuToken', null);
  add(
    '飞书登录态',
    Boolean(feishuToken?.accessToken),
    feishuToken?.user?.name || feishuToken?.user?.open_id || '未登录',
    { blocker: false },
  );

  const aiRows = db.exec('SELECT provider, base_url, api_key, model FROM ai_profiles LIMIT 1');
  const ai = aiRows[0]?.values?.[0];
  if (ai) {
    const profile = { provider: ai[0], base_url: ai[1], api_key: ai[2], model: ai[3] };
    add('大模型 Base URL', Boolean(profile.base_url), profile.base_url || '空');
    add('大模型 API Key', Boolean(profile.api_key), profile.api_key ? '已保存' : '空');
    add('大模型名称', Boolean(profile.model), profile.model || '空');
  } else {
    add('大模型配置', false, 'ai_profiles 为空');
  }

  const items = db.exec('SELECT COUNT(*) FROM library_items');
  const itemCount = items[0]?.values[0][0] || 0;
  add('本地内容库', itemCount > 0, `${itemCount} 条条目`, { blocker: false });

  const records = db.exec('SELECT COUNT(*) FROM records');
  const recordCount = records[0]?.values[0][0] || 0;
  add('飞书同步记录', true, `${recordCount} 条`, { blocker: false });

  const sessionFile = path.join(path.dirname(DB_PATH), 'local-session-token');
  add('本地会话', fs.existsSync(sessionFile), fs.existsSync(sessionFile) ? '已登录会话文件存在' : '需在本机打开应用登录');

  // Live API tests
  if (ai && ai[2] && ai[1]) {
    try {
      const llm = await testDeepSeek({ base_url: ai[1], api_key: ai[2], model: ai[3] });
      add('DeepSeek 连通性', llm.ok, llm.ok ? `${llm.endpoint} → ${llm.reply}` : llm.error);
    } catch (e) {
      add('DeepSeek 连通性', false, String(e.message || e));
    }
  }

  if (settings.appId && settings.appSecret && feishuToken) {
    try {
      const refreshed = await refreshFeishuToken(settings, feishuToken);
      if (refreshed.ok) {
        const drive = await testFeishuDrive(refreshed.accessToken, settings.folderToken);
        add('飞书云盘访问', drive.ok, drive.ok ? `可列出文件夹，样本 ${drive.fileCount} 个文件` : drive.error);
      } else {
        add('飞书 Token 刷新', false, refreshed.error);
      }
    } catch (e) {
      add('飞书 API', false, String(e.message || e));
    }
  }

  if (itemCount === 0) report.warnings.push('内容库为空：对话可能搜不到实质内容，建议先「添加」一条文本');
  if (!feishuToken?.accessToken) report.warnings.push('未登录飞书：无法同步/Wiki，本地检索 + DeepSeek 仍可用');

  const canUseCore = userCount > 0 && ai && ai[2] && ai[1];
  const canUseFull = canUseCore && feishuToken?.accessToken && itemCount > 0;
  report.summary = canUseFull
    ? '可以完整开始使用'
    : canUseCore
      ? '可以部分使用（见注意事项）'
      : '尚不能开始使用，请先处理阻塞项';
  report.canUseCore = Boolean(canUseCore);
  report.canUseFull = Boolean(canUseFull);

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ready ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
