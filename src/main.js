const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { execFile } = require('child_process');
const initSqlJs = require('sql.js');

const DEFAULT_SETTINGS = {
  appId: '',
  appSecret: '',
  folderToken: 'root',
  redirectPort: 37891,
};

const VAULT_VERSION = 2;
const KEY_ITERATIONS = 210000;
const LOCAL_KEY_ITERATIONS = 180000;
const MAX_FILE_BYTES = 18 * 1024 * 1024;
const FEISHU_API = 'https://open.feishu.cn';
const FEISHU_AUTH = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize';
const REQUIRED_SCOPES = ['drive:drive', 'drive:drive:readonly', 'auth:user.id:read'].join(' ');

let mainWindow = null;
let pendingLogin = null;
let SQL = null;
let db = null;
let activeUser = null;
let activePassword = '';

function databasePath() {
  return path.join(app.getPath('userData'), 'secure-vault.sqlite');
}

async function ensureDatabase() {
  if (db) return db;
  SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });
  const target = databasePath();
  if (fs.existsSync(target)) {
    db = new SQL.Database(fs.readFileSync(target));
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      local_path TEXT,
      file_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      token TEXT NOT NULL,
      url TEXT,
      uploaded_at TEXT NOT NULL,
      algorithm TEXT NOT NULL,
      kind TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS decrypted_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      record_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      source_path TEXT,
      saved_path TEXT,
      content_ciphertext TEXT NOT NULL,
      content_iv TEXT NOT NULL,
      content_tag TEXT NOT NULL,
      size INTEGER NOT NULL,
      downloaded_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_profiles (
      user_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT,
      model TEXT NOT NULL,
      temperature REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS knowledge_sources (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      api_key TEXT,
      enabled INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vector_sources (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      api_key TEXT,
      collection TEXT,
      enabled INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS obsidian_sources (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT,
      insecure_tls INTEGER NOT NULL,
      enabled INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS query_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS library_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      content_ciphertext TEXT NOT NULL,
      content_iv TEXT NOT NULL,
      content_tag TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      label TEXT NOT NULL,
      username TEXT,
      secret_ciphertext TEXT NOT NULL,
      secret_iv TEXT NOT NULL,
      secret_tag TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_repositories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT,
      tool TEXT NOT NULL,
      name TEXT NOT NULL,
      remote_url TEXT NOT NULL,
      local_path TEXT NOT NULL,
      migration_dir TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS local_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  ensureColumn('users', 'phone', 'TEXT');
  ensureColumn('users', 'recovery_email', 'TEXT');
  ensureColumn('users', 'recovery_code_hash', 'TEXT');
  ensureColumn('users', 'recovery_code_salt', 'TEXT');
  saveDatabase();
  return db;
}

function ensureColumn(table, column, type) {
  try {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch {
    // column already exists
  }
}

function saveDatabase() {
  if (!db) return;
  fs.mkdirSync(path.dirname(databasePath()), { recursive: true });
  fs.writeFileSync(databasePath(), Buffer.from(db.export()));
}

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    if (!stmt.step()) return null;
    return stmt.getAsObject();
  } finally {
    stmt.free();
  }
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  const rows = [];
  try {
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function setStateValue(key, value) {
  db.run('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
  saveDatabase();
}

function getStateValue(key, fallback) {
  const row = queryOne('SELECT value FROM app_state WHERE key = ?', [key]);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}

function sessionTokenPath() {
  return path.join(app.getPath('userData'), 'local-session-token');
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createLocalSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  db.run('DELETE FROM local_sessions WHERE user_id = ?', [userId]);
  db.run(
    'INSERT INTO local_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    [hashSessionToken(token), userId, expiresAt, new Date().toISOString()],
  );
  fs.writeFileSync(sessionTokenPath(), token, { mode: 0o600 });
  saveDatabase();
}

function clearLocalSession() {
  try {
    const token = fs.readFileSync(sessionTokenPath(), 'utf8').trim();
    if (token) db.run('DELETE FROM local_sessions WHERE token_hash = ?', [hashSessionToken(token)]);
  } catch {
    // no session file
  }
  try {
    fs.rmSync(sessionTokenPath(), { force: true });
  } catch {
    // ignore
  }
  saveDatabase();
}

function restoreLocalSession() {
  if (activeUser) return;
  try {
    const token = fs.readFileSync(sessionTokenPath(), 'utf8').trim();
    if (!token) return;
    const row = queryOne('SELECT * FROM local_sessions WHERE token_hash = ?', [hashSessionToken(token)]);
    if (!row || Number(row.expires_at) < Date.now()) {
      clearLocalSession();
      return;
    }
    activeUser = queryOne('SELECT * FROM users WHERE id = ?', [row.user_id]);
    activePassword = '';
  } catch {
    // ignore missing/invalid session
  }
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, Buffer.from(salt, 'base64'), LOCAL_KEY_ITERATIONS, 32, 'sha256').toString('base64');
}

function requireUser() {
  if (!activeUser) throw new Error('请先登录本地账号');
  return activeUser;
}

function requireSessionPassword() {
  if (!activePassword) throw new Error('请重新登录本地账号');
  return activePassword;
}

function deriveContentKey(password, saltBase64) {
  return crypto.pbkdf2Sync(password, Buffer.from(saltBase64, 'base64'), LOCAL_KEY_ITERATIONS, 32, 'sha256');
}

function encryptForLocalUser(bytes, password, user) {
  const iv = crypto.randomBytes(12);
  const key = deriveContentKey(password, user.password_salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

function decryptForLocalUser(item, password, user) {
  if (hashPassword(password, user.password_salt) !== user.password_hash) {
    throw new Error('本地密码错误');
  }
  const key = deriveContentKey(password, user.password_salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(item.content_iv, 'base64'));
  decipher.setAuthTag(Buffer.from(item.content_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(item.content_ciphertext, 'base64')),
    decipher.final(),
  ]);
}

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...getStateValue('settings', {}) };
}

function getFeishuToken() {
  return getStateValue('feishuToken', null);
}

function setFeishuToken(token) {
  setStateValue('feishuToken', token);
}

function publicState() {
  const settings = getSettings();
  const token = getFeishuToken();
  const user = activeUser ? {
    id: activeUser.id,
    email: activeUser.email,
    username: activeUser.username,
    phone: activeUser.phone || '',
    recoveryEmail: activeUser.recovery_email || '',
  } : null;
  const records = activeUser
    ? queryAll('SELECT * FROM records WHERE user_id = ? ORDER BY uploaded_at DESC', [activeUser.id]).map(normalizeRecord)
    : [];
  const items = activeUser
    ? queryAll('SELECT * FROM decrypted_items WHERE user_id = ? ORDER BY downloaded_at DESC', [activeUser.id]).map(maskItem)
    : [];
  const libraryItems = activeUser
    ? [
      ...queryAll('SELECT * FROM library_items WHERE user_id = ? ORDER BY created_at DESC', [activeUser.id]).map(maskLibraryItem),
      ...items,
    ]
    : [];
  const aiProfile = activeUser ? normalizeAiProfile(queryOne('SELECT * FROM ai_profiles WHERE user_id = ?', [activeUser.id])) : null;
  const knowledgeSources = activeUser
    ? queryAll('SELECT * FROM knowledge_sources WHERE user_id = ? ORDER BY created_at DESC', [activeUser.id]).map(normalizeSource)
    : [];
  const vectorSources = activeUser
    ? queryAll('SELECT * FROM vector_sources WHERE user_id = ? ORDER BY created_at DESC', [activeUser.id]).map(normalizeSource)
    : [];
  const obsidianSources = activeUser
    ? queryAll('SELECT * FROM obsidian_sources WHERE user_id = ? ORDER BY created_at DESC', [activeUser.id]).map(normalizeObsidianSource)
    : [];
  const queryLogs = activeUser
    ? queryAll('SELECT * FROM query_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [activeUser.id]).map(normalizeQueryLog)
    : [];
  const projectAccounts = activeUser
    ? queryAll('SELECT * FROM project_accounts WHERE user_id = ? ORDER BY created_at DESC', [activeUser.id]).map(normalizeProjectAccount)
    : [];
  const projectRepositories = activeUser
    ? queryAll('SELECT * FROM project_repositories WHERE user_id = ? ORDER BY created_at DESC', [activeUser.id]).map(normalizeProjectRepository)
    : [];
  return {
    auth: {
      hasUsers: Boolean(queryOne('SELECT id FROM users LIMIT 1')),
      isLoggedIn: Boolean(activeUser),
      user,
    },
    settings: {
      ...settings,
      appSecret: settings.appSecret ? '********' : '',
    },
    isFeishuLoggedIn: Boolean(token && token.accessToken),
    feishuUser: token && token.user,
    records,
    items: libraryItems,
    knowledgeCenter: {
      aiProfile,
      knowledgeSources,
      vectorSources,
      obsidianSources,
      queryLogs,
    },
    projects: {
      accounts: projectAccounts,
      repositories: projectRepositories,
    },
    redirectUri: `http://127.0.0.1:${settings.redirectPort}/feishu/oauth/callback`,
    requiredScopes: REQUIRED_SCOPES,
    databasePath: databasePath(),
  };
}

function normalizeObsidianSource(row) {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    apiKey: row.api_key ? '********' : '',
    insecureTls: Boolean(row.insecure_tls),
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
  };
}

function maskLibraryItem(row) {
  const size = Number(row.size || 0);
  return {
    id: row.id,
    recordId: '',
    kind: row.kind,
    name: row.title,
    title: row.title,
    url: row.url || '',
    sourcePath: row.url || '',
    savedPath: '',
    size,
    downloadedAt: row.created_at,
    maskedText: ['text', 'web', 'video', 'secret'].includes(row.kind) ? '*'.repeat(Math.max(8, Math.min(size, 80))) : '',
    localOnly: true,
  };
}

function normalizeAiProfile(row) {
  if (!row) {
    return {
      provider: 'openai-compatible',
      baseUrl: '',
      apiKey: '',
      model: '',
      temperature: 0.2,
    };
  }
  return {
    provider: row.provider,
    baseUrl: row.base_url,
    apiKey: row.api_key ? '********' : '',
    model: row.model,
    temperature: Number(row.temperature || 0.2),
  };
}

function normalizeSource(row) {
  return {
    id: row.id,
    name: row.name,
    endpoint: row.endpoint,
    apiKey: row.api_key ? '********' : '',
    collection: row.collection || '',
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
  };
}

function normalizeQueryLog(row) {
  let evidence = [];
  try {
    evidence = JSON.parse(row.evidence_json || '[]');
  } catch {
    evidence = [];
  }
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    evidence,
    createdAt: row.created_at,
  };
}

function normalizeProjectAccount(row) {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    username: row.username || '',
    hasSecret: Boolean(row.secret_ciphertext),
    createdAt: row.created_at,
  };
}

function normalizeProjectRepository(row) {
  return {
    id: row.id,
    accountId: row.account_id || '',
    tool: row.tool,
    name: row.name,
    remoteUrl: row.remote_url,
    localPath: row.local_path,
    migrationDir: row.migration_dir || '',
    createdAt: row.created_at,
  };
}

function normalizeRecord(row) {
  return {
    id: row.id,
    userId: row.user_id,
    localPath: row.local_path || '',
    fileName: row.file_name,
    size: Number(row.size || 0),
    token: row.token,
    url: row.url || '',
    uploadedAt: row.uploaded_at,
    algorithm: row.algorithm,
    kind: row.kind,
  };
}

function maskItem(row) {
  const size = Number(row.size || 0);
  return {
    id: row.id,
    recordId: row.record_id,
    kind: row.kind,
    name: row.name,
    sourcePath: row.source_path || '',
    savedPath: row.saved_path || '',
    size,
    downloadedAt: row.downloaded_at,
    maskedText: row.kind === 'text' ? '*'.repeat(Math.max(8, Math.min(size, 80))) : '',
  };
}

function sanitizeSettings(input, previousSecret = '') {
  const redirectPort = Number(input.redirectPort || DEFAULT_SETTINGS.redirectPort);
  return {
    appId: String(input.appId || '').trim(),
    appSecret: input.appSecret === '********' ? previousSecret : String(input.appSecret || '').trim(),
    folderToken: String(input.folderToken || 'root').trim() || 'root',
    redirectPort: Number.isFinite(redirectPort) && redirectPort > 0 ? Math.floor(redirectPort) : DEFAULT_SETTINGS.redirectPort,
  };
}

function requestJson(method, urlText, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlText);
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    const req = https.request({
      method,
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      headers: {
        Accept: 'application/json',
        ...(body ? {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': String(Buffer.byteLength(body)),
        } : {}),
        ...(options.headers || {}),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if ((res.statusCode || 500) >= 400) {
          reject(new Error(`Feishu HTTP ${res.statusCode}: ${text.slice(0, 500)}`));
          return;
        }
        try {
          resolve(text ? JSON.parse(text) : {});
        } catch {
          reject(new Error(`Feishu returned non-JSON response: ${text.slice(0, 500)}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function requestAnyJson(method, urlText, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlText);
    const transport = url.protocol === 'http:' ? http : https;
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    const req = transport.request({
      method,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      rejectUnauthorized: options.insecureTls ? false : undefined,
      headers: {
        Accept: 'application/json',
        ...(body ? {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': String(Buffer.byteLength(body)),
        } : {}),
        ...(options.headers || {}),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if ((res.statusCode || 500) >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 500)}`));
          return;
        }
        try {
          resolve(text ? JSON.parse(text) : {});
        } catch {
          resolve({ text });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('远程接口超时'));
    });
    if (body) req.write(body);
    req.end();
  });
}

function requestBuffer(method, urlText, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlText);
    const req = https.request({
      method,
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      headers: {
        ...(options.body ? { 'Content-Length': String(options.body.length) } : {}),
        ...(options.headers || {}),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on('end', () => {
        const status = res.statusCode || 0;
        const location = res.headers.location;
        const redirectsLeft = options.redirectsLeft ?? 3;
        if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
          requestBuffer(method, new URL(location, url).toString(), { ...options, redirectsLeft: redirectsLeft - 1 })
            .then(resolve, reject);
          return;
        }
        resolve({ status, headers: res.headers, body: Buffer.concat(chunks) });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function ensureFeishuPayload(response, fallback) {
  if (response.code && response.code !== 0) {
    throw new Error(response.msg || `${fallback}: Feishu code ${response.code}`);
  }
  if (response.data && typeof response.data === 'object') return response.data;
  return response;
}

function deriveVaultKey(passphrase, salt) {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('加密口令至少需要 8 个字符');
  }
  return crypto.pbkdf2Sync(passphrase, salt, KEY_ITERATIONS, 32, 'sha256');
}

function encryptVaultPayload(payload, passphrase) {
  const plain = Buffer.from(JSON.stringify(payload), 'utf8');
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveVaultKey(passphrase, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.from(JSON.stringify({
    version: VAULT_VERSION,
    algorithm: 'AES-256-GCM/PBKDF2-SHA256',
    kdf: { name: 'PBKDF2-SHA256', iterations: KEY_ITERATIONS, salt: salt.toString('base64') },
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    createdAt: new Date().toISOString(),
    ciphertext: encrypted.toString('base64'),
  }), 'utf8');
}

function decryptVaultPayload(buffer, passphrase) {
  const envelope = JSON.parse(buffer.toString('utf8'));
  if (envelope.version !== VAULT_VERSION) throw new Error('不支持的加密文件版本');
  const key = crypto.pbkdf2Sync(
    passphrase,
    Buffer.from(envelope.kdf.salt, 'base64'),
    envelope.kdf.iterations,
    32,
    'sha256',
  );
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plain.toString('utf8'));
}

function payloadFromFile(filePath) {
  const input = fs.readFileSync(filePath);
  if (input.length > MAX_FILE_BYTES) {
    throw new Error('当前版本单个文件限制约 18MB，避免超过飞书直传限制');
  }
  return {
    kind: 'file',
    name: path.basename(filePath),
    sourcePath: filePath,
    size: input.length,
    contentBase64: input.toString('base64'),
  };
}

function payloadFromText(name, text) {
  const cleanText = String(text || '');
  if (!cleanText.trim()) throw new Error('文本内容不能为空');
  return {
    kind: 'text',
    name: String(name || 'secret.txt').trim() || 'secret.txt',
    sourcePath: '',
    size: Buffer.byteLength(cleanText, 'utf8'),
    text: cleanText,
  };
}

function buildMultipart(fields, file) {
  const boundary = `----FeishuVault${crypto.randomBytes(12).toString('hex')}`;
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  ));
  parts.push(file.bytes);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { boundary, body: Buffer.concat(parts) };
}

async function exchangeCodeForToken(settings, code) {
  const redirectUri = `http://127.0.0.1:${settings.redirectPort}/feishu/oauth/callback`;
  const tokenResponse = await requestJson('POST', `${FEISHU_API}/open-apis/authen/v2/oauth/token`, {
    body: {
      grant_type: 'authorization_code',
      client_id: settings.appId,
      client_secret: settings.appSecret,
      code,
      redirect_uri: redirectUri,
    },
  });
  const tokenData = ensureFeishuPayload(tokenResponse, '飞书登录失败');
  if (!tokenData.access_token) throw new Error('飞书没有返回 access_token');

  let user;
  try {
    const userInfo = await requestJson('GET', `${FEISHU_API}/open-apis/authen/v1/user_info`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const data = ensureFeishuPayload(userInfo, '读取飞书用户信息失败');
    user = { name: data.name, openId: data.open_id, avatarUrl: data.avatar_url };
  } catch {
    user = undefined;
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + Math.max(60, Number(tokenData.expires_in || 7200) - 60) * 1000,
    scope: tokenData.scope,
    user,
  };
}

async function refreshFeishuTokenIfNeeded() {
  const settings = getSettings();
  const token = getFeishuToken();
  if (!token || !token.accessToken) throw new Error('请先登录飞书账号');
  if (Date.now() < token.expiresAt || !token.refreshToken) return token;

  const refreshed = await requestJson('POST', `${FEISHU_API}/open-apis/authen/v2/oauth/token`, {
    body: {
      grant_type: 'refresh_token',
      client_id: settings.appId,
      client_secret: settings.appSecret,
      refresh_token: token.refreshToken,
    },
  });
  const data = ensureFeishuPayload(refreshed, '刷新飞书登录失败');
  if (!data.access_token) throw new Error('飞书没有返回新的 access_token');
  const next = {
    ...token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || token.refreshToken,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 7200) - 60) * 1000,
    scope: data.scope || token.scope,
  };
  setFeishuToken(next);
  return next;
}

async function uploadVaultPayload(payload, passphrase) {
  const user = requireUser();
  const settings = getSettings();
  const token = await refreshFeishuTokenIfNeeded();
  const encrypted = encryptVaultPayload(payload, passphrase);
  const uploadName = `${payload.name}.axonvault`;
  const multipart = buildMultipart({
    file_name: uploadName,
    parent_type: 'explorer',
    parent_node: settings.folderToken || 'root',
    size: String(encrypted.length),
  }, { name: uploadName, bytes: encrypted });

  const response = await requestBuffer('POST', `${FEISHU_API}/open-apis/drive/v1/files/upload_all`, {
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': `multipart/form-data; boundary=${multipart.boundary}`,
    },
    body: multipart.body,
  });
  const data = ensureFeishuPayload(JSON.parse(response.body.toString('utf8')), '上传到飞书失败');
  if (!data.file_token) throw new Error('飞书没有返回 file_token');
  const record = {
    id: crypto.randomUUID(),
    userId: user.id,
    localPath: payload.sourcePath || '',
    fileName: payload.name,
    size: payload.size,
    token: data.file_token,
    url: data.url || '',
    uploadedAt: new Date().toISOString(),
    algorithm: 'AES-256-GCM/PBKDF2-SHA256',
    kind: payload.kind,
  };
  db.run(
    `INSERT OR REPLACE INTO records
      (id, user_id, local_path, file_name, size, token, url, uploaded_at, algorithm, kind)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [record.id, user.id, record.localPath, record.fileName, record.size, record.token, record.url, record.uploadedAt, record.algorithm, record.kind],
  );
  saveDatabase();
  return record;
}

async function downloadRecordToLocal(recordId, feishuPassphrase) {
  const user = requireUser();
  const localPassword = requireSessionPassword();
  const row = queryOne('SELECT * FROM records WHERE id = ? AND user_id = ?', [recordId, user.id]);
  if (!row) throw new Error('找不到这条同步记录');
  const record = normalizeRecord(row);
  const token = await refreshFeishuTokenIfNeeded();
  const response = await requestBuffer('GET', `${FEISHU_API}/open-apis/drive/v1/files/${encodeURIComponent(record.token)}/download`, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (response.status >= 400) {
    throw new Error(`下载飞书文件失败：HTTP ${response.status} ${response.body.toString('utf8').slice(0, 300)}`);
  }
  const payload = decryptVaultPayload(response.body, feishuPassphrase);
  const plainBytes = payload.kind === 'text'
    ? Buffer.from(payload.text || '', 'utf8')
    : Buffer.from(payload.contentBase64 || '', 'base64');
  const local = encryptForLocalUser(plainBytes, localPassword, user);
  const existing = queryOne('SELECT id FROM decrypted_items WHERE record_id = ? AND user_id = ?', [record.id, user.id]);
  const itemId = existing ? existing.id : crypto.randomUUID();
  db.run(
    `INSERT OR REPLACE INTO decrypted_items
      (id, user_id, record_id, kind, name, source_path, saved_path, content_ciphertext, content_iv, content_tag, size, downloaded_at)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT saved_path FROM decrypted_items WHERE id = ?), ''), ?, ?, ?, ?, ?)`,
    [
      itemId,
      user.id,
      record.id,
      payload.kind,
      payload.name || record.fileName,
      payload.sourcePath || record.localPath || '',
      itemId,
      local.ciphertext,
      local.iv,
      local.tag,
      plainBytes.length,
      new Date().toISOString(),
    ],
  );
  saveDatabase();
  return publicState();
}

function saveAiProfile(input) {
  const user = requireUser();
  const previous = queryOne('SELECT * FROM ai_profiles WHERE user_id = ?', [user.id]);
  const profile = {
    provider: String(input.provider || 'openai-compatible'),
    baseUrl: String(input.baseUrl || '').trim(),
    apiKey: input.apiKey === '********' ? (previous && previous.api_key ? previous.api_key : '') : String(input.apiKey || '').trim(),
    model: String(input.model || '').trim(),
    temperature: Number.isFinite(Number(input.temperature)) ? Number(input.temperature) : 0.2,
  };
  db.run(
    `INSERT OR REPLACE INTO ai_profiles (user_id, provider, base_url, api_key, model, temperature)
      VALUES (?, ?, ?, ?, ?, ?)`,
    [user.id, profile.provider, profile.baseUrl, profile.apiKey, profile.model, profile.temperature],
  );
  saveDatabase();
  return publicState();
}

function saveRemoteSources(table, sources) {
  const user = requireUser();
  const isVector = table === 'vector_sources';
  const previousRows = queryAll(`SELECT id, api_key FROM ${table} WHERE user_id = ?`, [user.id]);
  const previousKeys = new Map(previousRows.map((row) => [row.id, row.api_key || '']));
  db.run(`DELETE FROM ${table} WHERE user_id = ?`, [user.id]);
  for (const source of Array.isArray(sources) ? sources : []) {
    const endpoint = String(source.endpoint || '').trim();
    const name = String(source.name || '').trim();
    if (!name || !endpoint) continue;
    db.run(
      isVector
        ? `INSERT INTO vector_sources (id, user_id, name, endpoint, api_key, collection, enabled, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        : `INSERT INTO knowledge_sources (id, user_id, name, endpoint, api_key, enabled, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      isVector
        ? [
          source.id || crypto.randomUUID(),
          user.id,
          name,
          endpoint,
          source.apiKey === '********' ? (previousKeys.get(source.id) || '') : String(source.apiKey || '').trim(),
          String(source.collection || '').trim(),
          source.enabled === false ? 0 : 1,
          source.createdAt || new Date().toISOString(),
        ]
        : [
          source.id || crypto.randomUUID(),
          user.id,
          name,
          endpoint,
          source.apiKey === '********' ? (previousKeys.get(source.id) || '') : String(source.apiKey || '').trim(),
          source.enabled === false ? 0 : 1,
          source.createdAt || new Date().toISOString(),
        ],
    );
  }
  saveDatabase();
  return publicState();
}

function saveObsidianSources(sources) {
  const user = requireUser();
  const previousRows = queryAll('SELECT id, api_key FROM obsidian_sources WHERE user_id = ?', [user.id]);
  const previousKeys = new Map(previousRows.map((row) => [row.id, row.api_key || '']));
  db.run('DELETE FROM obsidian_sources WHERE user_id = ?', [user.id]);
  for (const source of Array.isArray(sources) ? sources : []) {
    const name = String(source.name || '').trim();
    const baseUrl = String(source.baseUrl || '').trim().replace(/\/$/, '');
    if (!name || !baseUrl) continue;
    db.run(
      `INSERT INTO obsidian_sources (id, user_id, name, base_url, api_key, insecure_tls, enabled, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        source.id || crypto.randomUUID(),
        user.id,
        name,
        baseUrl,
        source.apiKey === '********' ? (previousKeys.get(source.id) || '') : String(source.apiKey || '').trim(),
        source.insecureTls === false ? 0 : 1,
        source.enabled === false ? 0 : 1,
        source.createdAt || new Date().toISOString(),
      ],
    );
  }
  saveDatabase();
  return publicState();
}

function createLibraryItem(input) {
  const user = requireUser();
  const localPassword = requireSessionPassword();
  const kind = String(input.kind || 'text');
  const title = String(input.title || '').trim();
  const url = String(input.url || '').trim();
  const text = String(input.content || '').trim();
  if (!['text', 'secret', 'web', 'video'].includes(kind)) throw new Error('不支持的内容类型');
  if (!title) throw new Error('请输入标题');
  if ((kind === 'web' || kind === 'video') && !url) throw new Error('请输入链接');
  if ((kind === 'text' || kind === 'secret') && !text) throw new Error('请输入内容');
  const body = JSON.stringify({ kind, title, url, content: text });
  const bytes = Buffer.from(body, 'utf8');
  const local = encryptForLocalUser(bytes, localPassword, user);
  db.run(
    `INSERT INTO library_items
      (id, user_id, kind, title, url, content_ciphertext, content_iv, content_tag, size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), user.id, kind, title, url, local.ciphertext, local.iv, local.tag, bytes.length, new Date().toISOString()],
  );
  saveDatabase();
  return publicState();
}

function unlockLibraryItem(itemId, localPassword) {
  const user = requireUser();
  const lib = queryOne('SELECT * FROM library_items WHERE id = ? AND user_id = ?', [itemId, user.id]);
  if (lib) {
    const bytes = decryptForLocalUser(lib, localPassword, user);
    return { id: lib.id, name: lib.title, ...JSON.parse(bytes.toString('utf8')) };
  }
  const row = queryOne('SELECT * FROM decrypted_items WHERE id = ? AND user_id = ?', [itemId, user.id]);
  if (!row) throw new Error('找不到这条本地内容');
  const bytes = decryptForLocalUser(row, localPassword, user);
  if (row.kind !== 'text') throw new Error('这个条目是文件，请使用保存到本地');
  return { id: row.id, name: row.name, title: row.name, kind: 'text', content: bytes.toString('utf8') };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: options.cwd,
      timeout: options.timeout || 120000,
      maxBuffer: 1024 * 1024 * 8,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }, (error, stdout, stderr) => {
      const output = [stdout, stderr].filter(Boolean).join('\n').trim();
      if (error) {
        reject(new Error(output || error.message));
        return;
      }
      resolve(output || 'OK');
    });
  });
}

function saveProjectAccount(input) {
  const user = requireUser();
  const localPassword = requireSessionPassword();
  const provider = String(input.provider || 'github');
  const label = String(input.label || '').trim();
  const username = String(input.username || '').trim();
  const secret = String(input.secret || '');
  if (!label) throw new Error('请输入账号名称');
  if (!secret) throw new Error('请输入 token 或密码');
  const encrypted = encryptForLocalUser(Buffer.from(secret, 'utf8'), localPassword, user);
  db.run(
    `INSERT INTO project_accounts
      (id, user_id, provider, label, username, secret_ciphertext, secret_iv, secret_tag, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), user.id, provider, label, username, encrypted.ciphertext, encrypted.iv, encrypted.tag, new Date().toISOString()],
  );
  saveDatabase();
  return publicState();
}

function saveProjectRepository(input) {
  const user = requireUser();
  const tool = String(input.tool || 'git');
  const name = String(input.name || '').trim();
  const remoteUrl = String(input.remoteUrl || '').trim();
  const localPath = String(input.localPath || '').trim();
  const migrationDir = String(input.migrationDir || '').trim();
  if (!name) throw new Error('请输入项目名称');
  if (!remoteUrl) throw new Error('请输入仓库地址');
  if (!localPath) throw new Error('请选择或填写本地目录');
  db.run(
    `INSERT INTO project_repositories
      (id, user_id, account_id, tool, name, remote_url, local_path, migration_dir, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), user.id, input.accountId || '', tool, name, remoteUrl, localPath, migrationDir, new Date().toISOString()],
  );
  saveDatabase();
  return publicState();
}

function decryptProjectSecret(accountId) {
  if (!accountId) return '';
  const user = requireUser();
  const row = queryOne('SELECT * FROM project_accounts WHERE id = ? AND user_id = ?', [accountId, user.id]);
  if (!row) return '';
  return decryptForLocalUser({
    content_ciphertext: row.secret_ciphertext,
    content_iv: row.secret_iv,
    content_tag: row.secret_tag,
  }, requireSessionPassword(), user).toString('utf8');
}

function authRemoteUrl(remoteUrl, repo) {
  const token = decryptProjectSecret(repo.account_id);
  if (!token || !/^https?:\/\//i.test(remoteUrl)) return remoteUrl;
  const account = queryOne('SELECT * FROM project_accounts WHERE id = ?', [repo.account_id]);
  const url = new URL(remoteUrl);
  const username = account && account.username ? account.username : 'token';
  url.username = encodeURIComponent(username);
  url.password = encodeURIComponent(token);
  return url.toString();
}

async function runProjectAction(input) {
  const user = requireUser();
  const repo = queryOne('SELECT * FROM project_repositories WHERE id = ? AND user_id = ?', [String(input.repoId || ''), user.id]);
  if (!repo) throw new Error('找不到项目配置');
  const localPath = repo.local_path;
  const action = String(input.action || 'status');
  const isSvn = repo.tool === 'svn';
  if (action === 'clone') {
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    const targetExists = fs.existsSync(localPath);
    if (isSvn) {
      const secret = decryptProjectSecret(repo.account_id);
      const account = repo.account_id ? queryOne('SELECT * FROM project_accounts WHERE id = ?', [repo.account_id]) : null;
      const args = ['checkout', repo.remote_url, localPath];
      if (account && account.username) args.push('--username', account.username);
      if (secret) args.push('--password', secret, '--non-interactive', '--trust-server-cert');
      return { output: targetExists ? '本地目录已存在，未执行 checkout。' : await runCommand('svn', args), state: publicState() };
    }
    return { output: targetExists ? '本地目录已存在，未执行 clone。' : await runCommand('git', ['clone', authRemoteUrl(repo.remote_url, repo), localPath]), state: publicState() };
  }
  if (!fs.existsSync(localPath)) throw new Error('本地目录不存在，请先克隆/检出');
  if (isSvn) {
    const svnMap = {
      status: ['status'],
      update: ['update'],
      log: ['log', '-l', '20'],
      commit: ['commit', '-m', String(input.message || 'Update from VaultMind')],
    };
    return { output: await runCommand('svn', svnMap[action] || svnMap.status, { cwd: localPath }), state: publicState() };
  }
  if (action === 'commit') {
    await runCommand('git', ['add', '-A'], { cwd: localPath });
  return { output: await runCommand('git', ['commit', '-m', String(input.message || 'Update from VaultMind')], { cwd: localPath }), state: publicState() };
  }
  const gitMap = {
    status: ['status', '--short', '--branch'],
    update: ['pull', '--ff-only'],
    log: ['log', '--oneline', '--decorate', '-20'],
    push: ['push'],
  };
  return { output: await runCommand('git', gitMap[action] || gitMap.status, { cwd: localPath }), state: publicState() };
}

function extractEvidence(payload, sourceName, type) {
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.results)
      ? payload.results
      : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.documents)
          ? payload.documents
          : [];
  if (candidates.length === 0 && payload.text) {
    return [{ source: sourceName, type, title: sourceName, content: String(payload.text), score: null }];
  }
  return candidates.slice(0, 8).map((item, index) => ({
    source: sourceName,
    type,
    title: String(item.title || item.name || item.id || `${sourceName} #${index + 1}`),
    content: String(item.content || item.text || item.page_content || item.summary || JSON.stringify(item)).slice(0, 1800),
    score: typeof item.score === 'number' ? item.score : null,
  }));
}

async function callRetriever(source, question, type) {
  if (!source.endpoint) return [];
  const body = type === 'vector'
    ? { query: question, collection: source.collection || undefined, top_k: 8 }
    : { query: question, question, top_k: 8 };
  const payload = await requestAnyJson('POST', source.endpoint, {
    headers: source.api_key ? { Authorization: `Bearer ${source.api_key}` } : {},
    body,
  });
  return extractEvidence(payload, source.name, type);
}

async function callObsidianRetriever(source, question) {
  const payload = await requestAnyJson('POST', `${String(source.base_url).replace(/\/$/, '')}/search/simple/`, {
    insecureTls: Boolean(source.insecure_tls),
    headers: source.api_key ? { Authorization: `Bearer ${source.api_key}` } : {},
    body: { query: question, contextLength: 600 },
  });
  const results = Array.isArray(payload) ? payload : (Array.isArray(payload.results) ? payload.results : []);
  return results.slice(0, 8).map((item, index) => ({
    source: source.name,
    type: 'obsidian',
    title: String(item.filename || item.path || item.title || `Obsidian #${index + 1}`),
    content: String(item.context || item.content || item.text || JSON.stringify(item)).slice(0, 1800),
    score: typeof item.score === 'number' ? item.score : null,
  }));
}

async function synthesizeWithLlm(profile, question, evidence) {
  if (!profile || !profile.base_url || !profile.model) {
    return {
      answer: [
        '未配置可用的大模型，以下是自动检索到的证据摘要：',
        ...evidence.map((item, index) => `${index + 1}. [${item.source}] ${item.title}: ${item.content.slice(0, 240)}`),
      ].join('\n'),
      usedLlm: false,
    };
  }
  const endpoint = `${profile.base_url.replace(/\/$/, '')}/chat/completions`;
  const prompt = `你是个人知识库中心的检索助手。请基于证据回答用户问题；不要编造；引用证据来源名。\n\n问题：${question}\n\n证据：\n${evidence.map((item, index) => `[${index + 1}] 来源=${item.source}; 标题=${item.title}; 内容=${item.content}`).join('\n\n')}`;
  const result = await requestAnyJson('POST', endpoint, {
    headers: {
      ...(profile.api_key ? { Authorization: `Bearer ${profile.api_key}` } : {}),
    },
    body: {
      model: profile.model,
      temperature: profile.temperature,
      messages: [
        { role: 'system', content: '你是严谨、简洁、重视出处的个人知识库助手。' },
        { role: 'user', content: prompt },
      ],
    },
  });
  const content = result && result.choices && result.choices[0] && result.choices[0].message
    ? result.choices[0].message.content
    : '';
  return { answer: content || JSON.stringify(result), usedLlm: true };
}

async function queryKnowledgeCenter(question) {
  const user = requireUser();
  const cleanQuestion = String(question || '').trim();
  if (!cleanQuestion) throw new Error('请输入要检索的问题');
  const knowledgeSources = queryAll('SELECT * FROM knowledge_sources WHERE user_id = ? AND enabled = 1', [user.id]);
  const vectorSources = queryAll('SELECT * FROM vector_sources WHERE user_id = ? AND enabled = 1', [user.id]);
  const obsidianSources = queryAll('SELECT * FROM obsidian_sources WHERE user_id = ? AND enabled = 1', [user.id]);
  const aiProfile = queryOne('SELECT * FROM ai_profiles WHERE user_id = ?', [user.id]);
  const evidence = [];

  for (const source of knowledgeSources) {
    try {
      evidence.push(...await callRetriever(source, cleanQuestion, 'knowledge'));
    } catch (error) {
      evidence.push({ source: source.name, type: 'knowledge', title: '检索失败', content: String(error.message || error), score: null });
    }
  }
  for (const source of vectorSources) {
    try {
      evidence.push(...await callRetriever(source, cleanQuestion, 'vector'));
    } catch (error) {
      evidence.push({ source: source.name, type: 'vector', title: '检索失败', content: String(error.message || error), score: null });
    }
  }
  for (const source of obsidianSources) {
    try {
      evidence.push(...await callObsidianRetriever(source, cleanQuestion));
    } catch (error) {
      evidence.push({ source: source.name, type: 'obsidian', title: 'Obsidian 检索失败', content: String(error.message || error), score: null });
    }
  }

  if (evidence.length === 0) {
    throw new Error('没有启用的知识库或向量库，请先添加配置');
  }
  const synthesis = await synthesizeWithLlm(aiProfile, cleanQuestion, evidence);
  const log = {
    id: crypto.randomUUID(),
    userId: user.id,
    question: cleanQuestion,
    answer: synthesis.answer,
    evidence,
    createdAt: new Date().toISOString(),
  };
  db.run(
    'INSERT INTO query_logs (id, user_id, question, answer, evidence_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [log.id, user.id, log.question, log.answer, JSON.stringify(log.evidence), log.createdAt],
  );
  saveDatabase();
  return { ...log, state: publicState(), usedLlm: synthesis.usedLlm };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    title: 'VaultMind',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function registerHandlers() {
  ipcMain.handle('vault:getState', async () => {
    await ensureDatabase();
    restoreLocalSession();
    return publicState();
  });

  ipcMain.handle('vault:register', async (_event, input) => {
    await ensureDatabase();
    const email = String(input.email || '').trim().toLowerCase();
    const username = String(input.username || '').trim();
    const password = String(input.password || '');
    const phone = String(input.phone || '').trim();
    const recoveryEmail = String(input.recoveryEmail || email).trim().toLowerCase();
    if (!email.includes('@') && !/^\+?\d{6,}$/.test(email)) throw new Error('请输入有效手机或邮箱');
    if (!username) throw new Error('请输入用户名');
    if (password.length < 8) throw new Error('本地密码至少需要 8 个字符');
    if (queryOne('SELECT id FROM users WHERE email = ?', [email])) throw new Error('这个邮箱已注册');
    const salt = crypto.randomBytes(16).toString('base64');
    const recoveryCode = crypto.randomBytes(8).toString('hex').toUpperCase();
    const recoverySalt = crypto.randomBytes(16).toString('base64');
    const user = {
      id: crypto.randomUUID(),
      email,
      username,
      phone,
      recovery_email: recoveryEmail,
      password_salt: salt,
      password_hash: hashPassword(password, salt),
      recovery_code_salt: recoverySalt,
      recovery_code_hash: hashPassword(recoveryCode, recoverySalt),
      created_at: new Date().toISOString(),
    };
    db.run(
      `INSERT INTO users
        (id, email, username, phone, recovery_email, password_salt, password_hash, recovery_code_salt, recovery_code_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.email, user.username, user.phone, user.recovery_email, user.password_salt, user.password_hash, user.recovery_code_salt, user.recovery_code_hash, user.created_at],
    );
    saveDatabase();
    activeUser = user;
    activePassword = password;
    createLocalSession(user.id);
    return { ...publicState(), recoveryCode };
  });

  ipcMain.handle('vault:loginLocal', async (_event, input) => {
    await ensureDatabase();
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || hashPassword(password, user.password_salt) !== user.password_hash) {
      throw new Error('邮箱或密码不正确');
    }
    activeUser = user;
    activePassword = password;
    createLocalSession(user.id);
    return publicState();
  });

  ipcMain.handle('vault:logoutLocal', async () => {
    await ensureDatabase();
    clearLocalSession();
    activeUser = null;
    activePassword = '';
    return publicState();
  });

  ipcMain.handle('vault:updateRecovery', async (_event, input) => {
    await ensureDatabase();
    const user = requireUser();
    const phone = String(input.phone || '').trim();
    const recoveryEmail = String(input.recoveryEmail || '').trim().toLowerCase();
    if (recoveryEmail && !recoveryEmail.includes('@') && !/^\+?\d{6,}$/.test(recoveryEmail)) throw new Error('请输入有效恢复手机或邮箱');
    db.run('UPDATE users SET phone = ?, recovery_email = ? WHERE id = ?', [phone, recoveryEmail, user.id]);
    saveDatabase();
    activeUser = queryOne('SELECT * FROM users WHERE id = ?', [user.id]);
    return publicState();
  });

  ipcMain.handle('vault:resetPassword', async (_event, input) => {
    await ensureDatabase();
    const email = String(input.email || '').trim().toLowerCase();
    const recoveryCode = String(input.recoveryCode || '').trim().toUpperCase();
    const newPassword = String(input.newPassword || '');
    if (newPassword.length < 8) throw new Error('新密码至少需要 8 个字符');
    const user = queryOne('SELECT * FROM users WHERE email = ? OR recovery_email = ?', [email, email]);
    if (!user || !user.recovery_code_hash || hashPassword(recoveryCode, user.recovery_code_salt) !== user.recovery_code_hash) {
      throw new Error('恢复信息不正确');
    }
    const salt = crypto.randomBytes(16).toString('base64');
    db.run('UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?', [salt, hashPassword(newPassword, salt), user.id]);
    saveDatabase();
    return { ok: true };
  });

  ipcMain.handle('vault:saveSettings', async (_event, input) => {
    await ensureDatabase();
    requireUser();
    const previous = getSettings();
    const next = sanitizeSettings(input || {}, previous.appSecret);
    setStateValue('settings', next);
    return publicState();
  });

  ipcMain.handle('vault:login', async () => {
    await ensureDatabase();
    requireUser();
    const settings = getSettings();
    if (!settings.appId || !settings.appSecret) {
      throw new Error('请先填写飞书 App ID 和 App Secret');
    }
    if (pendingLogin) {
      pendingLogin.server.close();
      pendingLogin = null;
    }

    const stateValue = crypto.randomBytes(18).toString('hex');
    const redirectUri = `http://127.0.0.1:${settings.redirectPort}/feishu/oauth/callback`;
    await new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url || '/', redirectUri);
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');
          const error = url.searchParams.get('error');
          if (error) throw new Error(`飞书授权被取消：${error}`);
          if (!code || returnedState !== stateValue) throw new Error('飞书回调参数无效');
          setFeishuToken(await exchangeCodeForToken(settings, code));
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h2>飞书登录成功，可以回到 VaultMind。</h2>');
          server.close();
          pendingLogin = null;
          resolve();
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h2>飞书登录失败</h2><pre>${String(err)}</pre>`);
          server.close();
          pendingLogin = null;
          reject(err);
        }
      });
      server.listen(settings.redirectPort, '127.0.0.1', () => {
        pendingLogin = { server };
        const authUrl = new URL(FEISHU_AUTH);
        authUrl.searchParams.set('client_id', settings.appId);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', REQUIRED_SCOPES);
        authUrl.searchParams.set('state', stateValue);
        shell.openExternal(authUrl.toString()).catch(reject);
      });
      server.on('error', reject);
    });
    return publicState();
  });

  ipcMain.handle('vault:logout', async () => {
    await ensureDatabase();
    setFeishuToken(null);
    return publicState();
  });

  ipcMain.handle('vault:chooseFiles', async () => {
    await ensureDatabase();
    requireUser();
    return dialog.showOpenDialog(mainWindow, {
      title: '选择需要加密同步的文件',
      properties: ['openFile', 'multiSelections'],
    });
  });

  ipcMain.handle('vault:chooseDirectory', async () => {
    await ensureDatabase();
    requireUser();
    return dialog.showOpenDialog(mainWindow, {
      title: '选择目录',
      properties: ['openDirectory', 'createDirectory'],
    });
  });

  ipcMain.handle('vault:uploadFiles', async (_event, payload) => {
    await ensureDatabase();
    const filePaths = Array.isArray(payload && payload.filePaths) ? payload.filePaths : [];
    if (filePaths.length === 0) throw new Error('请选择至少一个本地文件');
    const records = [];
    for (const filePath of filePaths) {
      records.push(await uploadVaultPayload(payloadFromFile(filePath), String(payload.passphrase || '')));
    }
    return { state: publicState(), records };
  });

  ipcMain.handle('vault:uploadText', async (_event, payload) => {
    await ensureDatabase();
    const record = await uploadVaultPayload(payloadFromText(payload.name, payload.text), String(payload.passphrase || ''));
    return { state: publicState(), records: [record] };
  });

  ipcMain.handle('vault:downloadRecord', async (_event, payload) => {
    await ensureDatabase();
    return downloadRecordToLocal(String(payload.recordId || ''), String(payload.passphrase || ''));
  });

  ipcMain.handle('vault:unlockItem', async (_event, payload) => {
    await ensureDatabase();
    const item = unlockLibraryItem(String(payload.itemId || ''), String(payload.localPassword || ''));
    return { id: item.id, name: item.name || item.title, text: item.content || item.url || '' };
  });

  ipcMain.handle('vault:saveItemFile', async (_event, payload) => {
    await ensureDatabase();
    const user = requireUser();
    const row = queryOne('SELECT * FROM decrypted_items WHERE id = ? AND user_id = ?', [String(payload.itemId || ''), user.id]);
    if (!row) throw new Error('找不到这条本地文件');
    if (row.kind !== 'file') throw new Error('这个条目不是文件');
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '保存文件到本地',
      defaultPath: row.name,
    });
    if (result.canceled || !result.filePath) return publicState();
    const bytes = decryptForLocalUser(row, String(payload.localPassword || ''), user);
    fs.writeFileSync(result.filePath, bytes);
    db.run('UPDATE decrypted_items SET saved_path = ? WHERE id = ?', [result.filePath, row.id]);
    saveDatabase();
    return publicState();
  });

  ipcMain.handle('vault:forgetRecord', async (_event, recordId) => {
    await ensureDatabase();
    const user = requireUser();
    db.run('DELETE FROM records WHERE id = ? AND user_id = ?', [recordId, user.id]);
    db.run('DELETE FROM decrypted_items WHERE record_id = ? AND user_id = ?', [recordId, user.id]);
    saveDatabase();
    return publicState();
  });

  ipcMain.handle('vault:forgetItem', async (_event, itemId) => {
    await ensureDatabase();
    const user = requireUser();
    db.run('DELETE FROM decrypted_items WHERE id = ? AND user_id = ?', [itemId, user.id]);
    db.run('DELETE FROM library_items WHERE id = ? AND user_id = ?', [itemId, user.id]);
    saveDatabase();
    return publicState();
  });

  ipcMain.handle('vault:createLibraryItem', async (_event, payload) => {
    await ensureDatabase();
    return createLibraryItem(payload || {});
  });

  ipcMain.handle('vault:saveProjectAccount', async (_event, payload) => {
    await ensureDatabase();
    return saveProjectAccount(payload || {});
  });

  ipcMain.handle('vault:saveProjectRepository', async (_event, payload) => {
    await ensureDatabase();
    return saveProjectRepository(payload || {});
  });

  ipcMain.handle('vault:deleteProjectRepository', async (_event, repoId) => {
    await ensureDatabase();
    const user = requireUser();
    db.run('DELETE FROM project_repositories WHERE id = ? AND user_id = ?', [repoId, user.id]);
    saveDatabase();
    return publicState();
  });

  ipcMain.handle('vault:runProjectAction', async (_event, payload) => {
    await ensureDatabase();
    return runProjectAction(payload || {});
  });

  ipcMain.handle('vault:saveAiProfile', async (_event, input) => {
    await ensureDatabase();
    return saveAiProfile(input || {});
  });

  ipcMain.handle('vault:saveKnowledgeSources', async (_event, sources) => {
    await ensureDatabase();
    return saveRemoteSources('knowledge_sources', sources);
  });

  ipcMain.handle('vault:saveVectorSources', async (_event, sources) => {
    await ensureDatabase();
    return saveRemoteSources('vector_sources', sources);
  });

  ipcMain.handle('vault:saveObsidianSources', async (_event, sources) => {
    await ensureDatabase();
    return saveObsidianSources(sources);
  });

  ipcMain.handle('vault:queryKnowledgeCenter', async (_event, payload) => {
    await ensureDatabase();
    return queryKnowledgeCenter(payload && payload.question);
  });

  ipcMain.handle('vault:openExternal', (_event, url) => shell.openExternal(String(url)));
  ipcMain.handle('vault:showDatabase', async () => {
    await ensureDatabase();
    shell.showItemInFolder(databasePath());
  });
}

app.whenReady().then(async () => {
  await ensureDatabase();
  registerHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
