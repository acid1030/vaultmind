const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { execFile } = require('child_process');
const initSqlJs = require('sql.js');
const { migrateSchema } = require('./core/schema');
const groupService = require('./core/groups');
const searchService = require('./core/search');
const extractContent = require('./core/extract-content');
const manifestService = require('./core/manifest-sync');
const groupCrypto = require('./core/group-crypto');
const feishuDrive = require('./core/feishu-drive');
const feishuWiki = require('./core/feishu-wiki');
const knowledgeHints = require('./core/knowledge-hints');
const vectorSearch = require('./core/vector-search');
const gitProject = require('./core/git-project');

const DEFAULT_SETTINGS = {
  appId: '',
  appSecret: '',
  feishuPassphrase: '',
  folderToken: 'root',
  redirectPort: 37891,
  feishuAutoSync: false,
  localVectorSearch: false,
  localVectorModel: 'Xenova/all-MiniLM-L6-v2',
};

const VAULT_VERSION = 2;
const KEY_ITERATIONS = 210000;
const LOCAL_KEY_ITERATIONS = 180000;
const LOCAL_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FEISHU_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FEISHU_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_WECHAT_SCAN_FILES = 200;
const MAX_WECHAT_SCAN_DEPTH = 8;
const WECHAT_ATTACHMENT_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md',
  '.html', '.htm', '.drawio', '.csv', '.json', '.xml',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.dmg', '.exe', '.msi', '.apk',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic',
  '.mp4', '.mov', '.m4v', '.avi', '.mkv',
  '.mp3', '.m4a', '.wav', '.aac',
]);
const FEISHU_API = 'https://open.feishu.cn';
const FEISHU_AUTH = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize';
const REQUIRED_SCOPES = [
  'drive:drive',
  'drive:drive:readonly',
  'auth:user.id:read',
  'wiki:wiki:readonly',
].join(' ');

let mainWindow = null;
let pendingLogin = null;
let feishuAuthWindow = null;
let SQL = null;
let db = null;
let activeUser = null;
let activePassword = '';
let activeContext = { scope: 'personal', groupId: '' };

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
  migrateSchema(db);
  saveDatabase();
  return db;
}

function getContext() {
  if (!activeUser) return { scope: 'personal', groupId: '', groupName: '' };
  const stored = getStateValue(`context:${activeUser.id}`, null);
  if (stored && stored.scope === 'group' && stored.groupId) {
    const g = queryOne('SELECT * FROM groups WHERE id = ?', [stored.groupId]);
    const member = queryOne(
      'SELECT 1 FROM group_memberships WHERE group_id = ? AND user_id = ? AND status = ?',
      [stored.groupId, activeUser.id, 'active'],
    );
    if (g && member) {
      return { scope: 'group', groupId: stored.groupId, groupName: g.name };
    }
  }
  return { scope: 'personal', groupId: '', groupName: '' };
}

function setContext(input) {
  const user = requireUser();
  const scope = input.scope === 'group' ? 'group' : 'personal';
  const groupId = scope === 'group' ? String(input.groupId || '') : '';
  if (scope === 'group') {
    groupService.requireGroupAccess(db, queryOne, groupId, user.id);
  }
  activeContext = scope === 'group'
    ? { scope: 'group', groupId, groupName: queryOne('SELECT name FROM groups WHERE id = ?', [groupId])?.name || '' }
    : { scope: 'personal', groupId: '', groupName: '' };
  setStateValue(`context:${user.id}`, activeContext);
  return activeContext;
}

function resolveScopeFromInput(input) {
  const ctx = getContext();
  const scope = input?.scope === 'group' || (input?.groupId && !input?.forcePersonal)
    ? 'group'
    : (input?.scope === 'personal' ? 'personal' : ctx.scope);
  const groupId = scope === 'group' ? String(input?.groupId || ctx.groupId || '') : '';
  if (scope === 'group' && !groupId) throw new Error('请选择用户组');
  return { scope, groupId };
}

function encryptContent(bytes, scope, groupId, user, password) {
  if (scope === 'group') {
    const gk = groupService.getGroupKeyForUser(db, queryOne, groupId, user.id, user, password);
    return groupCrypto.encryptWithGroupKey(bytes, gk);
  }
  return encryptForLocalUser(bytes, password, user);
}

function decryptContent(item, user, password) {
  const scope = item.scope || 'personal';
  if (scope === 'group' && item.group_id) {
    const gk = groupService.getGroupKeyForUser(db, queryOne, item.group_id, user.id, user, password);
    return groupCrypto.decryptWithGroupKey(item, gk);
  }
  return decryptForLocalUser(item, password, user);
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

function sessionPasswordPath() {
  return path.join(app.getPath('userData'), 'local-session-password');
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function persistSessionPassword(password) {
  if (!safeStorage.isEncryptionAvailable()) return;
  const encrypted = safeStorage.encryptString(String(password || ''));
  fs.writeFileSync(sessionPasswordPath(), encrypted, { mode: 0o600 });
}

function restoreSessionPassword() {
  if (!safeStorage.isEncryptionAvailable()) return '';
  try {
    const encrypted = fs.readFileSync(sessionPasswordPath());
    return safeStorage.decryptString(encrypted);
  } catch {
    return '';
  }
}

function createLocalSession(userId, password = '') {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + LOCAL_SESSION_TTL_MS;
  db.run('DELETE FROM local_sessions WHERE user_id = ?', [userId]);
  db.run(
    'INSERT INTO local_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    [hashSessionToken(token), userId, expiresAt, new Date().toISOString()],
  );
  fs.writeFileSync(sessionTokenPath(), token, { mode: 0o600 });
  if (password) persistSessionPassword(password);
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
  try {
    fs.rmSync(sessionPasswordPath(), { force: true });
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
    const restoredPassword = restoreSessionPassword();
    if (!restoredPassword) {
      // 密码缓存丢失，强制重新登录，避免进入「已登录但无法解密」的异常状态
      clearLocalSession();
      return;
    }
    activeUser = queryOne('SELECT * FROM users WHERE id = ?', [row.user_id]);
    activePassword = restoredPassword;
    db.run('UPDATE local_sessions SET expires_at = ? WHERE token_hash = ?', [Date.now() + LOCAL_SESSION_TTL_MS, hashSessionToken(token)]);
    saveDatabase();
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

function hasUsableFeishuToken(token) {
  if (!token) return false;
  if (token.accessToken && Number(token.expiresAt || 0) > Date.now()) return true;
  if (token.refreshToken && (!token.refreshExpiresAt || Number(token.refreshExpiresAt) > Date.now())) return true;
  return false;
}

function itemsForContext(userId, context) {
  const libs = context.scope === 'group' && context.groupId
    ? queryAll(
      'SELECT * FROM library_items WHERE scope = ? AND group_id = ? ORDER BY created_at DESC',
      ['group', context.groupId],
    )
    : queryAll(
      `SELECT * FROM library_items WHERE user_id = ? AND (scope IS NULL OR scope = 'personal')
       ORDER BY created_at DESC`,
      [userId],
    );
  const decrypted = context.scope === 'personal'
    ? queryAll('SELECT * FROM decrypted_items WHERE user_id = ? AND (scope IS NULL OR scope = ?) ORDER BY downloaded_at DESC', [userId, 'personal']).map(maskItem)
    : queryAll('SELECT * FROM decrypted_items WHERE scope = ? AND group_id = ? ORDER BY downloaded_at DESC', ['group', context.groupId]).map(maskItem);
  return [...libs.map(maskLibraryItem), ...decrypted];
}

function recordsForContext(userId, context) {
  if (context.scope === 'group' && context.groupId) {
    return queryAll(
      'SELECT * FROM records WHERE scope = ? AND group_id = ? ORDER BY uploaded_at DESC',
      ['group', context.groupId],
    ).map(normalizeRecord);
  }
  return queryAll(
    `SELECT * FROM records WHERE user_id = ? AND (scope IS NULL OR scope = 'personal') ORDER BY uploaded_at DESC`,
    [userId],
  ).map(normalizeRecord);
}

function projectsForContext(userId, context) {
  if (context.scope === 'group' && context.groupId) {
    return {
      accounts: queryAll(
        'SELECT * FROM project_accounts WHERE scope = ? AND group_id = ? ORDER BY created_at DESC',
        ['group', context.groupId],
      ).map(normalizeProjectAccount),
      repositories: queryAll(
        'SELECT * FROM project_repositories WHERE scope = ? AND group_id = ? ORDER BY created_at DESC',
        ['group', context.groupId],
      ).map(normalizeProjectRepository),
    };
  }
  return {
    accounts: queryAll(
      `SELECT * FROM project_accounts WHERE user_id = ? AND (scope IS NULL OR scope = 'personal') ORDER BY created_at DESC`,
      [userId],
    ).map(normalizeProjectAccount),
    repositories: queryAll(
      `SELECT * FROM project_repositories WHERE user_id = ? AND (scope IS NULL OR scope = 'personal') ORDER BY created_at DESC`,
      [userId],
    ).map(normalizeProjectRepository),
  };
}

function publicState() {
  const settings = getSettings();
  let token = getFeishuToken();
  if (token && !hasUsableFeishuToken(token)) {
    setFeishuToken(null);
    token = null;
  }
  const context = activeUser ? getContext() : { scope: 'personal', groupId: '', groupName: '' };
  activeContext = context;
  const user = activeUser ? {
    id: activeUser.id,
    email: activeUser.email,
    username: activeUser.username,
    phone: activeUser.phone || '',
    recoveryEmail: activeUser.recovery_email || '',
  } : null;
  const records = activeUser ? recordsForContext(activeUser.id, context) : [];
  const libraryItems = activeUser ? itemsForContext(activeUser.id, context) : [];
  const groups = activeUser
    ? groupService.getUserGroups(db, queryAll, activeUser.id).map(groupService.normalizeGroup)
    : [];
  const aiProfile = activeUser ? normalizeAiProfile(getAiProfileRow(activeUser.id)) : null;
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
  const projectData = activeUser ? projectsForContext(activeUser.id, context) : { accounts: [], repositories: [] };
  const pendingInvites = activeUser ? groupService.listPendingInvites(db, queryAll, activeUser) : [];
  const manifestMeta = activeUser
    ? getManifestMeta(context.scope, context.groupId, activeUser.id)
    : null;
  const feishuWikiSettings = getFeishuWikiSettings();
  const obsidianConfigured = activeUser
    ? queryAll('SELECT id FROM obsidian_sources WHERE user_id = ? LIMIT 1', [activeUser.id]).length > 0
    : false;
  const obsidianEnabled = activeUser
    ? queryAll('SELECT id FROM obsidian_sources WHERE user_id = ? AND enabled = 1 LIMIT 1', [activeUser.id]).length > 0
    : false;
  return {
    auth: {
      hasUsers: Boolean(queryOne('SELECT id FROM users LIMIT 1')),
      isLoggedIn: Boolean(activeUser),
      user,
    },
    settings: {
      ...settings,
      appSecret: settings.appSecret ? '********' : '',
      feishuPassphrase: settings.feishuPassphrase ? '********' : '',
      hasFeishuPassphrase: Boolean(settings.feishuPassphrase),
    },
    isFeishuLoggedIn: hasUsableFeishuToken(token),
    feishuUser: token && token.user,
    context,
    groups,
    pendingInvites,
    manifestMeta,
    records,
    items: libraryItems,
    knowledgeCenter: {
      aiProfile,
      knowledgeSources,
      vectorSources,
      obsidianSources,
      queryLogs,
      feishuWiki: {
        enabled: feishuWikiSettings.enabled,
        spaceId: feishuWikiSettings.spaceId || '',
        available: Boolean(token && token.accessToken),
      },
      obsidian: {
        configured: obsidianConfigured,
        enabled: obsidianEnabled,
        localRestUrl: knowledgeHints.OBSIDIAN_LOCAL_URL,
      },
    },
    projects: projectData,
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
    scope: row.scope || 'personal',
    groupId: row.group_id || '',
    tags: row.tags || '',
    maskedText: ['text', 'web', 'video', 'secret'].includes(row.kind) ? '*'.repeat(Math.max(8, Math.min(size, 80))) : '',
    localOnly: true,
    remoteOnly: Boolean(row.remote_only),
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

function getAiProfileRow(userId) {
  const own = queryOne('SELECT * FROM ai_profiles WHERE user_id = ?', [userId]);
  if (own) return own;
  // 当前用户未配置时，回退到数据库中任意一份可用配置（全局共享）
  return queryOne('SELECT * FROM ai_profiles WHERE base_url IS NOT NULL AND base_url <> \'\' AND model IS NOT NULL AND model <> \'\' ORDER BY rowid DESC LIMIT 1');
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
    scope: row.scope || 'personal',
    groupId: row.group_id || '',
    assetId: row.asset_id || '',
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
    scope: row.scope || 'personal',
    groupId: row.group_id || '',
    maskedText: row.kind === 'text' ? '*'.repeat(Math.max(8, Math.min(size, 80))) : '',
  };
}

function sanitizeSettings(input, previousSecret = '', previousFeishuPassphrase = '') {
  const redirectPort = Number(input.redirectPort || DEFAULT_SETTINGS.redirectPort);
  return {
    appId: String(input.appId || '').trim(),
    appSecret: input.appSecret === undefined || input.appSecret === '********'
      ? previousSecret
      : String(input.appSecret || '').trim(),
    feishuPassphrase: input.feishuPassphrase === undefined || input.feishuPassphrase === '********'
      ? previousFeishuPassphrase
      : String(input.feishuPassphrase || ''),
    folderToken: String(input.folderToken || 'root').trim() || 'root',
    redirectPort: Number.isFinite(redirectPort) && redirectPort > 0 ? Math.floor(redirectPort) : DEFAULT_SETTINGS.redirectPort,
    feishuAutoSync: Boolean(input.feishuAutoSync),
    localVectorSearch: Boolean(input.localVectorSearch),
    localVectorModel: String(input.localVectorModel || DEFAULT_SETTINGS.localVectorModel).trim() || DEFAULT_SETTINGS.localVectorModel,
  };
}

function configuredFeishuPassphrase(inputPassphrase = '') {
  const input = String(inputPassphrase || '');
  const passphrase = input && input !== '********' ? input : String(getSettings().feishuPassphrase || '');
  if (passphrase.length < 8) throw new Error('请先在「配置 → 飞书同步」设置至少 8 位的飞书加密口令');
  return passphrase;
}

function isLocalVectorSearchEnabled() {
  const settings = getSettings();
  return Boolean(settings.localVectorSearch);
}

function currentVectorModel() {
  const settings = getSettings();
  return String(settings.localVectorModel || DEFAULT_SETTINGS.localVectorModel).trim() || DEFAULT_SETTINGS.localVectorModel;
}

async function maybeIndexVector(payload) {
  if (!isLocalVectorSearchEnabled()) return { skipped: true };
  try {
    return await vectorSearch.indexVector(db, {
      ...payload,
      modelName: currentVectorModel(),
    });
  } catch (error) {
    console.error('向量索引失败:', error.message || error);
    return { error: String(error.message || error) };
  }
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
    if (String(response.msg || '').toLowerCase().includes('parent node not exist')) {
      throw new Error('飞书文件夹 Token 不存在或当前应用无权访问。请在「配置 → 飞书同步」把文件夹 Token 改为 root，或填入有效的 fldcn... 文件夹 Token 后重新保存。');
    }
    if (response.code === 1061002 && String(response.msg || '').toLowerCase().includes('params')) {
      throw new Error('飞书上传参数错误：请确认文件未超过 20MB，且飞书文件夹 Token 有访问权限。');
    }
    throw new Error(response.msg || `${fallback}: Feishu code ${response.code}`);
  }
  if (response.data && typeof response.data === 'object') return response.data;
  return response;
}

function isFeishuFolderTokenError(error) {
  const message = String(error && error.message ? error.message : error).toLowerCase();
  return message.includes('文件夹 token 不存在')
    || message.includes('parent node not exist')
    || message.includes('parent node')
    || message.includes('no permission')
    || message.includes('permission');
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
    throw new Error('当前版本单个文件限制约 12MB，避免加密后超过飞书直传限制');
  }
  return {
    kind: 'file',
    name: path.basename(filePath),
    sourcePath: filePath,
    size: input.length,
    contentBase64: input.toString('base64'),
  };
}

function scanWechatAttachments(rootDir) {
  const root = path.resolve(String(rootDir || ''));
  if (!root || !fs.existsSync(root)) throw new Error('微信附件目录不存在');
  const files = [];
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length) {
    const { dir, depth } = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < MAX_WECHAT_SCAN_DEPTH && !entry.name.startsWith('.')) {
          stack.push({ dir: fullPath, depth: depth + 1 });
        }
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!WECHAT_ATTACHMENT_EXTENSIONS.has(ext)) continue;
      let stat = null;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }
      if (!stat.size || stat.size > MAX_FILE_BYTES) continue;
      files.push({
        path: fullPath,
        name: entry.name,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        relativePath: path.relative(root, fullPath),
      });
    }
  }
  return files
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
    .slice(0, MAX_WECHAT_SCAN_FILES);
}

function findWechatAttachmentRoots() {
  const home = app.getPath('home');
  const baseCandidates = [
    path.join(home, 'Library', 'Containers', 'com.tencent.xinWeChat', 'Data', 'Library', 'Application Support', 'com.tencent.xinWeChat'),
    path.join(home, 'Library', 'Containers', 'com.tencent.xinWeChat', 'Data', 'Documents', 'xwechat_files'),
    path.join(home, 'Library', 'Containers', 'com.tencent.xinWeChat', 'Data', 'Documents', 'app_data', 'ilink', 'wechat'),
    path.join(home, 'Library', 'Application Support', 'com.tencent.xinWeChat'),
    path.join(home, 'Documents', 'WeChat Files'),
  ];
  const roots = [];
  const seen = new Set();
  const addRoot = (dir) => {
    const resolved = path.resolve(dir);
    if (!seen.has(resolved) && fs.existsSync(resolved)) {
      seen.add(resolved);
      roots.push(resolved);
    }
  };
  const maybeAttachmentDir = (dir, name) => ['FileStorage', 'MsgAttach', 'MessageTemp', 'FileTemp'].includes(name)
    || (name === 'file' && path.basename(path.dirname(dir)) === 'msg');
  for (const base of baseCandidates) {
    if (!fs.existsSync(base)) continue;
    const stack = [{ dir: base, depth: 0 }];
    while (stack.length) {
      const { dir, depth } = stack.pop();
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        const fullPath = path.join(dir, entry.name);
        if (maybeAttachmentDir(fullPath, entry.name)) {
          addRoot(fullPath);
          continue;
        }
        if (depth < 5) stack.push({ dir: fullPath, depth: depth + 1 });
      }
    }
  }
  return roots;
}

function scanDefaultWechatAttachments() {
  const roots = findWechatAttachmentRoots();
  const seen = new Set();
  const files = [];
  for (const root of roots) {
    for (const file of scanWechatAttachments(root)) {
      if (seen.has(file.path)) continue;
      seen.add(file.path);
      files.push({ ...file, scanRoot: root });
    }
  }
  return {
    roots,
    files: files
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
      .slice(0, MAX_WECHAT_SCAN_FILES),
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
  const redirectUri = feishuRedirectUri(settings);
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
    refreshExpiresAt: Date.now() + FEISHU_REFRESH_TTL_MS,
    scope: tokenData.scope,
    user,
  };
}

async function refreshFeishuTokenIfNeeded(options = {}) {
  const settings = getSettings();
  const token = getFeishuToken();
  if (!token || !token.accessToken) throw new Error('请先登录飞书账号');
  if (!options.force && Date.now() < Number(token.expiresAt || 0)) return token;
  if (!token.refreshToken) {
    setFeishuToken(null);
    throw new Error('飞书登录已过期，请重新登录飞书账号。');
  }
  if (token.refreshExpiresAt && Date.now() > token.refreshExpiresAt) {
    setFeishuToken(null);
    throw new Error('飞书登录已超过 30 天，请重新登录飞书账号。');
  }

  let data;
  try {
    const refreshed = await requestJson('POST', `${FEISHU_API}/open-apis/authen/v2/oauth/token`, {
      body: {
        grant_type: 'refresh_token',
        client_id: settings.appId,
        client_secret: settings.appSecret,
        refresh_token: token.refreshToken,
      },
    });
    data = ensureFeishuPayload(refreshed, '刷新飞书登录失败');
  } catch (error) {
    setFeishuToken(null);
    throw new Error(`飞书登录已失效，请在顶栏重新登录飞书账号。${error.message || error}`);
  }
  if (!data.access_token) throw new Error('飞书没有返回新的 access_token');
  const next = {
    ...token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || token.refreshToken,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 7200) - 60) * 1000,
    refreshExpiresAt: data.refresh_token ? Date.now() + FEISHU_REFRESH_TTL_MS : (token.refreshExpiresAt || Date.now() + FEISHU_REFRESH_TTL_MS),
    scope: data.scope || token.scope,
  };
  setFeishuToken(next);
  return next;
}

function isFeishuTokenExpiredError(error) {
  const message = String(error && error.message ? error.message : error).toLowerCase();
  return message.includes('authentication token expired')
    || message.includes('access token expired')
    || message.includes('token expired');
}

async function uploadAllToFeishu(fields, file, fallback) {
  const multipart = buildMultipart(fields, file);
  async function attempt(token) {
    const response = await requestBuffer('POST', `${FEISHU_API}/open-apis/drive/v1/files/upload_all`, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': `multipart/form-data; boundary=${multipart.boundary}`,
      },
      body: multipart.body,
    });
    return ensureFeishuPayload(JSON.parse(response.body.toString('utf8')), fallback);
  }

  try {
    return await attempt(await refreshFeishuTokenIfNeeded());
  } catch (error) {
    if (!isFeishuTokenExpiredError(error)) throw error;
    return attempt(await refreshFeishuTokenIfNeeded({ force: true }));
  }
}

function manifestStateKey(scope, groupId, userId) {
  return `manifest:${scope}:${groupId || userId}`;
}

function getManifestMeta(scope, groupId, userId) {
  return getStateValue(manifestStateKey(scope, groupId, userId), null);
}

function getFeishuWikiSettings() {
  const stored = getStateValue('feishuWiki', {});
  return {
    enabled: stored.enabled !== false,
    spaceId: String(stored.spaceId || '').trim(),
  };
}

function saveFeishuWikiSettings(input) {
  const user = requireUser();
  const previous = getFeishuWikiSettings();
  const next = {
    enabled: input.enabled === false ? false : true,
    spaceId: input.spaceId === undefined ? previous.spaceId : String(input.spaceId || '').trim(),
  };
  setStateValue('feishuWiki', next);
  saveDatabase();
  return publicState();
}

async function callFeishuWikiRetriever(question) {
  const settings = getFeishuWikiSettings();
  if (!settings.enabled) return [];
  const token = await refreshFeishuTokenIfNeeded();
  const body = {
    query: feishuWiki.truncateQuery(question),
    page_size: 12,
  };
  if (settings.spaceId) body.space_id = settings.spaceId;
  const response = await requestJson('POST', `${FEISHU_API}/open-apis/wiki/v2/nodes/search`, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
    body,
  });
  return feishuWiki.parseSearchResponse(ensureFeishuPayload(response, '搜索飞书知识库失败'));
}

async function listFeishuFolderFiles(folderToken) {
  const token = await refreshFeishuTokenIfNeeded();
  const response = await requestJson(
    'GET',
    `${FEISHU_API}/open-apis/drive/v1/files?folder_token=${encodeURIComponent(folderToken)}&page_size=200`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } },
  );
  return feishuDrive.parseListFilesResponse(ensureFeishuPayload(response, '列出飞书文件失败'));
}

async function getFeishuRootFolderToken() {
  const token = await refreshFeishuTokenIfNeeded();
  const response = await requestJson(
    'GET',
    `${FEISHU_API}/open-apis/drive/explorer/v2/root_folder/meta`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } },
  );
  const data = ensureFeishuPayload(response, '获取飞书根目录失败');
  if (!data.token) throw new Error('飞书没有返回根目录 token');
  return data.token;
}

async function resolveWritableFeishuFolder(preferredToken) {
  const folderToken = String(preferredToken || 'root').trim() || 'root';
  const rootToken = await getFeishuRootFolderToken();
  if (folderToken === 'root') return rootToken;
  try {
    await listFeishuFolderFiles(folderToken);
    return folderToken;
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    if (message.includes('文件夹 Token 不存在') || message.toLowerCase().includes('parent node not exist')) {
      return rootToken;
    }
    throw error;
  }
}

async function saveSyncRecord(user, input) {
  const now = input.uploadedAt || new Date().toISOString();
  const record = {
    id: input.id || crypto.randomUUID(),
    userId: user.id,
    localPath: input.localPath || '',
    fileName: input.fileName,
    size: Number(input.size || 0),
    token: input.token,
    url: input.url || '',
    uploadedAt: now,
    algorithm: input.algorithm || 'AES-256-GCM/PBKDF2-SHA256',
    kind: input.kind || 'text',
    scope: input.scope || 'personal',
    groupId: input.scope === 'group' ? (input.groupId || null) : null,
    assetId: input.assetId || null,
  };
  db.run(
    `INSERT OR REPLACE INTO records
      (id, user_id, local_path, file_name, size, token, url, uploaded_at, algorithm, kind, scope, group_id, created_by, asset_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id, record.userId, record.localPath, record.fileName, record.size, record.token, record.url,
      record.uploadedAt, record.algorithm, record.kind, record.scope, record.groupId, user.id, record.assetId,
    ],
  );
  let content = '';
  if (input.contentBase64) {
    try {
      content = await extractContent.extractTextFromBuffer(Buffer.from(input.contentBase64, 'base64'), record.fileName);
    } catch {
      // ignore extraction failures
    }
  } else if (record.localPath && record.kind === 'file') {
    content = await extractContent.extractTextFromFile(record.localPath);
  }
  searchService.indexAsset(db, {
    assetId: record.id,
    ownerUserId: record.userId,
    scope: record.scope,
    groupId: record.groupId || '',
    kind: record.kind,
    sourceTable: 'records',
    title: record.fileName,
    tags: record.localPath || '',
    content,
  });
  await maybeIndexVector({
    assetId: record.id,
    ownerUserId: record.userId,
    scope: record.scope,
    groupId: record.groupId || '',
    text: `${record.fileName}\n${content}`,
  });
  saveDatabase();
  return record;
}

async function downloadFeishuFileBuffer(fileToken) {
  const token = await refreshFeishuTokenIfNeeded();
  const response = await requestBuffer(
    'GET',
    `${FEISHU_API}/open-apis/drive/v1/files/${encodeURIComponent(fileToken)}/download`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } },
  );
  if (response.status >= 400) {
    throw new Error(`下载飞书文件失败：HTTP ${response.status}`);
  }
  return response.body;
}

async function deleteFeishuFile(fileToken) {
  const token = await refreshFeishuTokenIfNeeded();
  const response = await requestJson(
    'DELETE',
    `${FEISHU_API}/open-apis/drive/v1/files/${encodeURIComponent(fileToken)}`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } },
  );
  ensureFeishuPayload(response, '删除飞书测试文件失败');
}

async function testFeishuSync(input = {}) {
  const user = requireUser();
  const previous = getSettings();
  const settings = sanitizeSettings({
    appId: input.appId || previous.appId,
    appSecret: input.appSecret || previous.appSecret,
    feishuPassphrase: input.feishuPassphrase || input.passphrase || previous.feishuPassphrase,
    folderToken: input.folderToken || previous.folderToken,
    redirectPort: previous.redirectPort,
  }, previous.appSecret, previous.feishuPassphrase);
  if (!settings.appId || !settings.appSecret) {
    throw new Error('请先填写飞书 App ID 和 App Secret');
  }
  const feishuToken = getFeishuToken();
  if (!feishuToken || !feishuToken.accessToken) {
    throw new Error('请先登录飞书后再测试同步');
  }
  const passphrase = configuredFeishuPassphrase(settings.feishuPassphrase || input.passphrase);

  const scopeMeta = resolveScopeFromInput(input);
  const preferredParentNode = scopeMeta.scope === 'group'
    ? (queryOne('SELECT feishu_folder_token FROM groups WHERE id = ?', [scopeMeta.groupId])?.feishu_folder_token
      || settings.folderToken
      || 'root')
    : (settings.folderToken || 'root');
  const parentNode = await resolveWritableFeishuFolder(preferredParentNode);

  await listFeishuFolderFiles(parentNode);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const testName = `vaultmind-sync-test-${stamp}`;
  const testPayload = payloadFromText(
    testName,
    `VaultMind 飞书同步连通性测试\n时间: ${new Date().toISOString()}\n账号: ${user.email || user.username || user.id}\n`,
  );
  const uploaded = await uploadVaultPayload(testPayload, passphrase, scopeMeta, {
    skipRecord: true,
    parentNode,
  });
  const buffer = await downloadFeishuFileBuffer(uploaded.fileToken);
  const decrypted = decryptVaultPayload(buffer, passphrase);
  if (!decrypted.text || !String(decrypted.text).includes('VaultMind')) {
    throw new Error('上传成功但回读解密校验失败，请检查加密口令');
  }

  let cleanedUp = false;
  try {
    await deleteFeishuFile(uploaded.fileToken);
    cleanedUp = true;
  } catch {
    cleanedUp = false;
  }

  return {
    ok: true,
    message: cleanedUp
      ? '飞书同步测试通过：已上传测试文本、回读解密成功，并已删除云端测试文件。'
      : '飞书同步测试通过：已上传并回读解密成功（云端测试文件未自动删除，可在飞书云盘中手动移除）。',
    folderToken: parentNode,
    fileToken: uploaded.fileToken,
    url: uploaded.url || '',
    fileName: uploaded.fileName,
    feishuUser: feishuToken.user && feishuToken.user.name ? feishuToken.user.name : '',
    cleanedUp,
  };
}

async function resolveManifestFileToken(scope, groupId, userId, fileName) {
  const meta = getManifestMeta(scope, groupId, userId);
  if (meta && meta.fileToken) return meta.fileToken;
  const settings = getSettings();
  const preferredParentNode = scope === 'group'
    ? (queryOne('SELECT feishu_folder_token FROM groups WHERE id = ?', [groupId])?.feishu_folder_token || settings.folderToken || 'root')
    : (settings.folderToken || 'root');
  const parentNode = await resolveWritableFeishuFolder(preferredParentNode);
  const files = await listFeishuFolderFiles(parentNode);
  const found = feishuDrive.findManifestFile(files, fileName);
  return found ? found.token : null;
}

async function pushManifestToFeishu(payload) {
  const user = requireUser();
  const passphrase = configuredFeishuPassphrase(payload.passphrase);
  const { scope, groupId } = resolveScopeFromInput(payload || {});
  const manifest = manifestService.buildManifestEntries(db, queryAll, user.id, scope, groupId);
  const encrypted = manifestService.encryptManifest(manifest, passphrase, encryptVaultPayload);
  const fileName = manifestService.manifestFileName(scope, groupId, user.id);
  const settings = getSettings();
  const preferredParentNode = scope === 'group'
    ? (queryOne('SELECT feishu_folder_token FROM groups WHERE id = ?', [groupId])?.feishu_folder_token || settings.folderToken || 'root')
    : (settings.folderToken || 'root');
  const parentNode = await resolveWritableFeishuFolder(preferredParentNode);
  const data = await uploadAllToFeishu({
    file_name: fileName,
    parent_type: 'explorer',
    parent_node: parentNode,
    size: String(encrypted.length),
  }, { name: fileName, bytes: encrypted }, '同步 manifest 失败');
  setStateValue(manifestStateKey(scope, groupId, user.id), {
    fileToken: data.file_token,
    url: data.url || '',
    syncedAt: new Date().toISOString(),
  });
  await saveSyncRecord(user, {
    fileName,
    size: encrypted.length,
    token: data.file_token,
    url: data.url || '',
    kind: 'text',
    scope,
    groupId,
    assetId: manifestStateKey(scope, groupId, user.id),
  });
  saveDatabase();
  return { ok: true, fileToken: data.file_token };
}

async function pullManifestFromFeishu(payload) {
  const user = requireUser();
  requireSessionPassword();
  const passphrase = configuredFeishuPassphrase(payload.passphrase);
  const { scope, groupId } = resolveScopeFromInput(payload || {});
  const fileName = manifestService.manifestFileName(scope, groupId, user.id);
  const fileToken = await resolveManifestFileToken(scope, groupId, user.id, fileName);
  if (!fileToken) throw new Error('云端未找到目录清单，请先执行「上传目录清单」');
  const buffer = await downloadFeishuFileBuffer(fileToken);
  const remote = manifestService.decryptManifest(buffer, passphrase, decryptVaultPayload);
  const local = manifestService.buildManifestEntries(db, queryAll, user.id, scope, groupId);
  const merged = manifestService.mergeManifests(local, remote);
  const stats = manifestService.applyManifestToDatabase(db, queryOne, queryAll, saveDatabase, user, scope, groupId, merged, {
    indexAsset: searchService.indexAsset,
    encryptContent,
    requireSessionPassword,
  });
  setStateValue(manifestStateKey(scope, groupId, user.id), {
    ...(getManifestMeta(scope, groupId, user.id) || {}),
    fileToken,
    pulledAt: new Date().toISOString(),
  });
  saveDatabase();
  return { stats, mergedAt: merged.updatedAt };
}

async function fullSyncManifest(payload) {
  const result = { pull: null, push: null, pullError: null, pushError: null };
  try {
    result.pull = await pullManifestFromFeishu(payload);
  } catch (error) {
    result.pullError = String(error.message || error);
  }
  try {
    result.push = await pushManifestToFeishu(payload);
  } catch (error) {
    result.pushError = String(error.message || error);
  }
  if (result.pullError && result.pushError) {
    throw new Error(`同步失败：拉取 ${result.pullError}；上传 ${result.pushError}`);
  }
  return { ...result, state: publicState() };
}

function afterAuthSuccess(user, password) {
  const accepted = groupService.processPendingInvitesForUser(db, saveDatabase, queryOne, queryAll, user, password);
  searchService.reindexAllForUser(db, queryAll, user.id);
  saveDatabase();
  return accepted;
}

async function uploadVaultPayload(payload, passphrase, scopeMeta = {}, options = {}) {
  const user = requireUser();
  const settings = getSettings();
  const { scope, groupId } = scopeMeta.scope ? scopeMeta : resolveScopeFromInput(scopeMeta);
  if (scope === 'group') {
    groupService.requireGroupAccess(db, queryOne, groupId, user.id, ['owner', 'admin', 'member']);
  }
  const encrypted = encryptVaultPayload(payload, passphrase);
  if (encrypted.length > MAX_FEISHU_UPLOAD_BYTES) {
    throw new Error(`文件「${payload.name}」加密后超过飞书直传 20MB 限制，请选择更小的文件或拆分后再同步。`);
  }
  const uploadName = `${payload.name}.axonvault`;
  const preferredParentNode = options.parentNode || (scope === 'group'
    ? (queryOne('SELECT feishu_folder_token FROM groups WHERE id = ?', [groupId])?.feishu_folder_token || settings.folderToken || 'root')
    : (settings.folderToken || 'root'));
  const parentNode = await resolveWritableFeishuFolder(preferredParentNode);
  let finalParentNode = parentNode;
  let data;
  try {
    data = await uploadAllToFeishu({
      file_name: uploadName,
      parent_type: 'explorer',
      parent_node: finalParentNode,
      size: String(encrypted.length),
    }, { name: uploadName, bytes: encrypted }, '上传到飞书失败');
  } catch (error) {
    if (finalParentNode === 'root' || !isFeishuFolderTokenError(error)) throw error;
    finalParentNode = await resolveWritableFeishuFolder('root');
    if (scope !== 'group') {
      setStateValue('settings', { ...settings, folderToken: 'root' });
    }
    data = await uploadAllToFeishu({
      file_name: uploadName,
      parent_type: 'explorer',
      parent_node: finalParentNode,
      size: String(encrypted.length),
    }, { name: uploadName, bytes: encrypted }, '上传到飞书失败');
  }
  if (!data.file_token) throw new Error('飞书没有返回 file_token');
  if (options.skipRecord) {
    return {
      fileToken: data.file_token,
      url: data.url || '',
      fileName: uploadName,
      parentNode: finalParentNode,
    };
  }
  return saveSyncRecord(user, {
    localPath: payload.sourcePath || '',
    fileName: payload.name,
    size: payload.size,
    token: data.file_token,
    url: data.url || '',
    kind: payload.kind,
    scope,
    groupId,
    assetId: payload.assetId || null,
    contentBase64: payload.contentBase64 || '',
  });
}

function sendUploadProgress(event, payload) {
  if (!event || !event.sender || event.sender.isDestroyed()) return;
  event.sender.send('vault:uploadProgress', payload);
}

async function openPathOrThrow(targetPath) {
  const cleanPath = String(targetPath || '').trim();
  if (!cleanPath || !fs.existsSync(cleanPath)) return false;
  const error = await shell.openPath(cleanPath);
  if (error) throw new Error(`打开文件失败：${error}`);
  return true;
}

async function openAsset(input = {}) {
  const user = requireUser();
  const assetId = String(input.assetId || '').trim();
  const sourceTable = String(input.sourceTable || '').trim();
  if (!assetId) throw new Error('缺少要打开的文件标识');

  if (sourceTable === 'records' || !sourceTable) {
    const record = queryOne('SELECT * FROM records WHERE id = ?', [assetId]);
    if (record) {
      if (record.user_id !== user.id && record.scope !== 'group') throw new Error('无权打开该文件');
      if (await openPathOrThrow(record.local_path)) return { opened: true, target: record.local_path };
      if (record.url) {
        await shell.openExternal(record.url);
        return { opened: true, target: record.url };
      }
      if (record.token) {
        const url = `https://open.feishu.cn/file/${record.token}`;
        await shell.openExternal(url);
        return { opened: true, target: url };
      }
    }
  }

  if (sourceTable === 'decrypted_items' || !sourceTable) {
    const item = queryOne('SELECT * FROM decrypted_items WHERE id = ?', [assetId]);
    if (item) {
      if (item.user_id !== user.id && item.scope !== 'group') throw new Error('无权打开该文件');
      if (await openPathOrThrow(item.source_path)) return { opened: true, target: item.source_path };
      if (await openPathOrThrow(item.saved_path)) return { opened: true, target: item.saved_path };
      throw new Error('本地文件路径不存在，请先从飞书取回或重新选择文件');
    }
  }

  if (sourceTable === 'library_items' || !sourceTable) {
    const item = queryOne('SELECT * FROM library_items WHERE id = ?', [assetId]);
    if (item) {
      if (item.user_id !== user.id && item.scope !== 'group') throw new Error('无权打开该条目');
      if (item.url) {
        await shell.openExternal(item.url);
        return { opened: true, target: item.url };
      }
      throw new Error('该条目没有可打开的本地文件或链接');
    }
  }

  throw new Error('未找到可打开的匹配文件');
}

async function downloadRecordToLocal(recordId, feishuPassphrase) {
  const user = requireUser();
  const localPassword = requireSessionPassword();
  const row = queryOne('SELECT * FROM records WHERE id = ?', [recordId]);
  if (!row) throw new Error('找不到这条同步记录');
  if (row.scope === 'group') {
    groupService.requireGroupAccess(db, queryOne, row.group_id, user.id);
  } else if (row.user_id !== user.id) {
    throw new Error('找不到这条同步记录');
  }
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
  const scope = record.scope || 'personal';
  const groupId = record.groupId || record.group_id || null;
  const local = encryptContent(plainBytes, scope, groupId, user, localPassword);
  const existing = queryOne('SELECT id FROM decrypted_items WHERE record_id = ? AND user_id = ?', [record.id, user.id]);
  const itemId = existing ? existing.id : crypto.randomUUID();
  db.run(
    `INSERT OR REPLACE INTO decrypted_items
      (id, user_id, record_id, kind, name, source_path, saved_path, content_ciphertext, content_iv, content_tag, size, downloaded_at, scope, group_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT saved_path FROM decrypted_items WHERE id = ?), ''), ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      scope,
      groupId,
      user.id,
    ],
  );
  let fileContent = '';
  if (payload.kind === 'file') {
    try {
      fileContent = await extractContent.extractTextFromBuffer(plainBytes, payload.name || record.fileName);
    } catch {
      // ignore extraction failures
    }
  }
  searchService.indexAsset(db, {
    assetId: itemId,
    ownerUserId: user.id,
    scope,
    groupId: groupId || '',
    kind: payload.kind,
    sourceTable: 'decrypted_items',
    title: payload.name || record.fileName,
    tags: '',
    content: fileContent,
  });
  await maybeIndexVector({
    assetId: itemId,
    ownerUserId: user.id,
    scope,
    groupId: groupId || '',
    text: `${payload.name || record.fileName}\n${fileContent}`,
  });
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

function llmHeaders(profile) {
  if (profile.provider === 'claude') {
    return {
      ...(profile.apiKey ? { 'x-api-key': profile.apiKey } : {}),
      'anthropic-version': '2023-06-01',
    };
  }
  return profile.apiKey ? { Authorization: `Bearer ${profile.apiKey}` } : {};
}

async function listLlmModels(input) {
  const profile = {
    provider: String(input.provider || 'openai'),
    baseUrl: String(input.baseUrl || '').trim(),
    apiKey: input.apiKey === '********' ? '' : String(input.apiKey || '').trim(),
  };
  if (!profile.baseUrl) throw new Error('请先填写模型 Base URL');
  const endpoint = `${profile.baseUrl.replace(/\/$/, '')}/models`;
  const payload = await requestAnyJson('GET', endpoint, {
    headers: llmHeaders(profile),
  });
  const rawModels = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload.models) ? payload.models : []);
  const models = rawModels
    .map((item) => (typeof item === 'string' ? item : item.id || item.name || item.model))
    .filter(Boolean)
    .map(String);
  if (!models.length) throw new Error('远程接口没有返回可识别的模型列表');
  return { models: [...new Set(models)] };
}

async function testLlmProfile(input) {
  const profile = {
    provider: String(input.provider || 'openai'),
    base_url: String(input.baseUrl || '').trim(),
    api_key: input.apiKey === '********' ? '' : String(input.apiKey || '').trim(),
    model: String(input.model || '').trim(),
    temperature: Number.isFinite(Number(input.temperature)) ? Number(input.temperature) : 0.2,
  };
  if (!profile.base_url) throw new Error('请先填写模型 Base URL');
  if (!profile.model) throw new Error('请先选择模型');
  const result = await synthesizeWithLlm(profile, '请只回复“连接成功”。', [{
    source: 'VaultMind',
    title: '模型连接测试',
    content: '这是一次最小化模型连通性测试。',
  }]);
  return { ok: true, reply: String(result.answer || '').slice(0, 240) };
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

async function createLibraryItem(input) {
  const user = requireUser();
  const localPassword = requireSessionPassword();
  const { scope, groupId } = resolveScopeFromInput(input);
  if (scope === 'group') {
    groupService.requireGroupAccess(db, queryOne, groupId, user.id, ['owner', 'admin', 'member']);
  }
  const kind = String(input.kind || 'text');
  const title = String(input.title || '').trim();
  const url = String(input.url || '').trim();
  const text = String(input.content || '').trim();
  const tags = JSON.stringify(Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(/[,，\s]+/).filter(Boolean));
  if (!['text', 'secret', 'web', 'video'].includes(kind)) throw new Error('不支持的内容类型');
  if (!title) throw new Error('请输入标题');
  if ((kind === 'web' || kind === 'video') && !url) throw new Error('请输入链接');
  if ((kind === 'text' || kind === 'secret') && !text) throw new Error('请输入内容');
  const body = JSON.stringify({ kind, title, url, content: text });
  const bytes = Buffer.from(body, 'utf8');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const local = encryptContent(bytes, scope, groupId, user, localPassword);
  db.run(
    `INSERT INTO library_items
      (id, user_id, kind, title, url, content_ciphertext, content_iv, content_tag, size, created_at, scope, group_id, created_by, tags, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, user.id, kind, title, url, local.ciphertext, local.iv, local.tag, bytes.length, now, scope, scope === 'group' ? groupId : null, user.id, tags, now],
  );
  searchService.indexAsset(db, {
    assetId: id,
    ownerUserId: user.id,
    scope,
    groupId: scope === 'group' ? groupId : '',
    kind,
    sourceTable: 'library_items',
    title,
    tags,
    content: text,
  });
  await maybeIndexVector({
    assetId: id,
    ownerUserId: user.id,
    scope,
    groupId: scope === 'group' ? groupId : '',
    text: `${title}\n${text}`,
  });
  saveDatabase();
  return publicState();
}

function unlockLibraryItem(itemId) {
  const user = requireUser();
  const localPassword = requireSessionPassword();
  const lib = queryOne('SELECT * FROM library_items WHERE id = ?', [itemId]);
  if (lib) {
    if (lib.scope === 'group') {
      groupService.requireGroupAccess(db, queryOne, lib.group_id, user.id);
    } else if (lib.user_id !== user.id) {
      throw new Error('找不到这条本地内容');
    }
    const bytes = decryptContent(lib, user, localPassword);
    return { id: lib.id, name: lib.title, ...JSON.parse(bytes.toString('utf8')) };
  }
  const row = queryOne('SELECT * FROM decrypted_items WHERE id = ?', [itemId]);
  if (!row) throw new Error('找不到这条本地内容');
  if (row.scope === 'group') {
    groupService.requireGroupAccess(db, queryOne, row.group_id, user.id);
  } else if (row.user_id !== user.id) {
    throw new Error('找不到这条本地内容');
  }
  const bytes = decryptContent(row, user, localPassword);
  if (row.kind !== 'text') throw new Error('这个条目是文件，请使用保存到本地');
  return { id: row.id, name: row.name, title: row.name, kind: 'text', content: bytes.toString('utf8') };
}

function openLibraryItem(itemId) {
  const user = requireUser();
  const localPassword = requireSessionPassword();
  const lib = queryOne('SELECT * FROM library_items WHERE id = ?', [itemId]);
  if (lib) {
    if (lib.scope === 'group') {
      groupService.requireGroupAccess(db, queryOne, lib.group_id, user.id);
    } else if (lib.user_id !== user.id) {
      throw new Error('找不到这条本地内容');
    }
    const bytes = decryptContent(lib, user, localPassword);
    const parsed = JSON.parse(bytes.toString('utf8'));
    return { id: lib.id, name: lib.title, kind: lib.kind, ...parsed, viewable: true };
  }
  const row = queryOne('SELECT * FROM decrypted_items WHERE id = ?', [itemId]);
  if (!row) throw new Error('找不到这条本地内容');
  if (row.scope === 'group') {
    groupService.requireGroupAccess(db, queryOne, row.group_id, user.id);
  } else if (row.user_id !== user.id) {
    throw new Error('找不到这条本地内容');
  }
  const bytes = decryptContent(row, user, localPassword);
  if (row.kind === 'file') {
    const tempDir = path.join(app.getPath('temp'), 'vaultmind-previews');
    fs.mkdirSync(tempDir, { recursive: true });
    const ext = path.extname(row.name || '') || '';
    const tempPath = path.join(tempDir, `${crypto.randomUUID()}${ext}`);
    fs.writeFileSync(tempPath, bytes);
    const error = shell.openPath(tempPath);
    if (error && error !== '') {
      throw new Error(`无法打开文件：${error}`);
    }
    return { id: row.id, name: row.name, kind: row.kind, opened: true, path: tempPath };
  }
  return { id: row.id, name: row.name, kind: row.kind || 'text', title: row.name, content: bytes.toString('utf8'), viewable: true };
}

function changeLocalPassword(input) {
  const user = requireUser();
  const currentPassword = String(input.currentPassword || '');
  const newPassword = String(input.newPassword || '');
  if (newPassword.length < 8) throw new Error('新密码至少需要 8 个字符');
  if (!activePassword) throw new Error('请重新登录本地账号后再修改密码');
  if (currentPassword !== activePassword || hashPassword(currentPassword, user.password_salt) !== user.password_hash) {
    throw new Error('当前本地密码不正确');
  }

  const nextSalt = crypto.randomBytes(16).toString('base64');
  const nextUser = { ...user, password_salt: nextSalt };
  const personalLibraries = queryAll(
    `SELECT * FROM library_items WHERE user_id = ? AND (scope IS NULL OR scope = 'personal')`,
    [user.id],
  ).map((row) => ({
    id: row.id,
    encrypted: encryptForLocalUser(decryptForLocalUser(row, currentPassword, user), newPassword, nextUser),
  }));
  const personalFiles = queryAll(
    `SELECT * FROM decrypted_items WHERE user_id = ? AND (scope IS NULL OR scope = 'personal')`,
    [user.id],
  ).map((row) => ({
    id: row.id,
    encrypted: encryptForLocalUser(decryptForLocalUser(row, currentPassword, user), newPassword, nextUser),
  }));
  const personalAccounts = queryAll(
    `SELECT * FROM project_accounts WHERE user_id = ? AND (scope IS NULL OR scope = 'personal')`,
    [user.id],
  ).map((row) => {
    const secretRow = {
      content_ciphertext: row.secret_ciphertext,
      content_iv: row.secret_iv,
      content_tag: row.secret_tag,
    };
    return {
      id: row.id,
      encrypted: encryptForLocalUser(decryptForLocalUser(secretRow, currentPassword, user), newPassword, nextUser),
    };
  });
  const wrappedGroupKeys = queryAll('SELECT * FROM group_member_keys WHERE user_id = ?', [user.id])
    .map((row) => {
      const groupKey = groupCrypto.unwrapGroupKey({
        ciphertext: row.wrapped_key_ciphertext,
        iv: row.wrapped_key_iv,
        tag: row.wrapped_key_tag,
      }, user, currentPassword);
      return {
        groupId: row.group_id,
        keyVersion: row.key_version,
        wrapped: groupCrypto.wrapGroupKey(groupKey, nextUser, newPassword),
      };
    });

  db.run('BEGIN');
  try {
    db.run(
      'UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?',
      [nextSalt, hashPassword(newPassword, nextSalt), user.id],
    );
    for (const row of personalLibraries) {
      db.run(
        'UPDATE library_items SET content_ciphertext = ?, content_iv = ?, content_tag = ? WHERE id = ?',
        [row.encrypted.ciphertext, row.encrypted.iv, row.encrypted.tag, row.id],
      );
    }
    for (const row of personalFiles) {
      db.run(
        'UPDATE decrypted_items SET content_ciphertext = ?, content_iv = ?, content_tag = ? WHERE id = ?',
        [row.encrypted.ciphertext, row.encrypted.iv, row.encrypted.tag, row.id],
      );
    }
    for (const row of personalAccounts) {
      db.run(
        'UPDATE project_accounts SET secret_ciphertext = ?, secret_iv = ?, secret_tag = ? WHERE id = ?',
        [row.encrypted.ciphertext, row.encrypted.iv, row.encrypted.tag, row.id],
      );
    }
    for (const row of wrappedGroupKeys) {
      db.run(
        `UPDATE group_member_keys
         SET wrapped_key_ciphertext = ?, wrapped_key_iv = ?, wrapped_key_tag = ?
         WHERE group_id = ? AND user_id = ? AND key_version = ?`,
        [row.wrapped.ciphertext, row.wrapped.iv, row.wrapped.tag, row.groupId, user.id, row.keyVersion],
      );
    }
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
  saveDatabase();
  activeUser = queryOne('SELECT * FROM users WHERE id = ?', [user.id]);
  activePassword = newPassword;
  createLocalSession(user.id, newPassword);
  return publicState();
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
  const { scope, groupId } = resolveScopeFromInput(input);
  if (scope === 'group') {
    groupService.requireGroupAccess(db, queryOne, groupId, user.id, ['owner', 'admin', 'member']);
  }
  const provider = String(input.provider || 'github');
  const label = String(input.label || '').trim();
  const username = String(input.username || '').trim();
  const secret = String(input.secret || '');
  if (!label) throw new Error('请输入账号名称');
  if (!secret) throw new Error('请输入 token 或密码');
  const encrypted = encryptContent(Buffer.from(secret, 'utf8'), scope, groupId, user, localPassword);
  db.run(
    `INSERT INTO project_accounts
      (id, user_id, provider, label, username, secret_ciphertext, secret_iv, secret_tag, created_at, scope, group_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), user.id, provider, label, username, encrypted.ciphertext, encrypted.iv, encrypted.tag, new Date().toISOString(), scope, scope === 'group' ? groupId : null, user.id],
  );
  saveDatabase();
  return publicState();
}

function saveProjectRepository(input) {
  const user = requireUser();
  const { scope, groupId } = resolveScopeFromInput(input);
  if (scope === 'group') {
    groupService.requireGroupAccess(db, queryOne, groupId, user.id, ['owner', 'admin', 'member']);
  }
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
      (id, user_id, account_id, tool, name, remote_url, local_path, migration_dir, created_at, scope, group_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), user.id, input.accountId || '', tool, name, remoteUrl, localPath, migrationDir, new Date().toISOString(), scope, scope === 'group' ? groupId : null, user.id],
  );
  saveDatabase();
  return publicState();
}

function decryptProjectSecret(accountId) {
  if (!accountId) return '';
  const user = requireUser();
  const row = queryOne('SELECT * FROM project_accounts WHERE id = ?', [accountId]);
  if (!row) return '';
  const password = requireSessionPassword();
  if (row.scope === 'group') {
    groupService.requireGroupAccess(db, queryOne, row.group_id, user.id);
  } else if (row.user_id !== user.id) {
    return '';
  }
  return decryptContent({
    scope: row.scope,
    group_id: row.group_id,
    content_ciphertext: row.secret_ciphertext,
    content_iv: row.secret_iv,
    content_tag: row.secret_tag,
  }, user, password).toString('utf8');
}

function authRemoteUrl(remoteUrl, repo) {
  const account = repo.account_id
    ? queryOne('SELECT * FROM project_accounts WHERE id = ?', [repo.account_id])
    : null;
  return gitProject.authRemoteUrl(
    remoteUrl,
    account && account.username ? account.username : '',
    decryptProjectSecret(repo.account_id),
  );
}

async function projectRepoPayload(row) {
  const account = row.account_id
    ? queryOne('SELECT * FROM project_accounts WHERE id = ?', [row.account_id])
    : null;
  return {
    localPath: row.local_path,
    local_path: row.local_path,
    remoteUrl: row.remote_url,
    remote_url: row.remote_url,
    accountUsername: account && account.username ? account.username : '',
    secret: decryptProjectSecret(row.account_id),
  };
}

async function enrichProjectRepositories(rows) {
  const enriched = [];
  for (const row of rows) {
    const repo = normalizeProjectRepository(row);
    const payload = await projectRepoPayload(row);
    const status = await gitProject.inspectRepo(payload.localPath, repo.tool);
    enriched.push({ ...repo, status });
  }
  return enriched;
}

async function runProjectAction(input) {
  const user = requireUser();
  const repo = queryOne('SELECT * FROM project_repositories WHERE id = ?', [String(input.repoId || '')]);
  if (!repo) throw new Error('找不到项目配置');
  if (repo.scope === 'group') {
    groupService.requireGroupAccess(db, queryOne, repo.group_id, user.id);
  } else if (repo.user_id !== user.id) {
    throw new Error('找不到项目配置');
  }
  const action = String(input.action || 'status');
  const payload = await projectRepoPayload(repo);

  if (action === 'open') {
    const error = await shell.openPath(payload.localPath);
    if (error) throw new Error(`打开目录失败：${error}`);
    return { output: `已打开：${payload.localPath}`, state: publicState() };
  }

  const output = repo.tool === 'svn'
    ? await gitProject.runSvnAction(payload, action, input)
    : await gitProject.runGitAction(payload, action, input);
  return { output, state: publicState() };
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
  if (profile.provider === 'claude') {
    const prompt = `请基于证据回答用户问题；不要编造；引用证据来源名。\n\n问题：${question}\n\n证据：\n${evidence.map((item, index) => `[${index + 1}] 来源=${item.source}; 标题=${item.title}; 内容=${item.content}`).join('\n\n')}`;
    const result = await requestAnyJson('POST', `${profile.base_url.replace(/\/$/, '')}/messages`, {
      headers: llmHeaders({
        provider: profile.provider,
        apiKey: profile.api_key,
      }),
      body: {
        model: profile.model,
        max_tokens: 1600,
        temperature: profile.temperature,
        system: '你是严谨、简洁、重视出处的个人知识库助手。',
        messages: [{ role: 'user', content: prompt }],
      },
    });
    const content = Array.isArray(result.content)
      ? result.content.map((item) => item.text || '').join('\n').trim()
      : '';
    return { answer: content || JSON.stringify(result), usedLlm: true };
  }
  const endpoint = `${profile.base_url.replace(/\/$/, '')}/chat/completions`;
  const prompt = `你是个人知识库中心的检索助手。请基于证据回答用户问题；不要编造；引用证据来源名。\n\n问题：${question}\n\n证据：\n${evidence.map((item, index) => `[${index + 1}] 来源=${item.source}; 标题=${item.title}; 内容=${item.content}`).join('\n\n')}`;
  const result = await requestAnyJson('POST', endpoint, {
    headers: llmHeaders({
      provider: profile.provider,
      apiKey: profile.api_key,
    }),
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

async function queryKnowledgeCenter(question, options = {}) {
  const user = requireUser();
  const cleanQuestion = String(question || '').trim();
  if (!cleanQuestion) throw new Error('请输入要检索的问题');
  const context = options.context || getContext();
  const includePersonal = options.includePersonal !== false && context.scope !== 'group';
  const searchContext = options.searchScope === 'all'
    ? { scope: 'all', groupId: '' }
    : context;
  const knowledgeSources = includePersonal
    ? queryAll('SELECT * FROM knowledge_sources WHERE user_id = ? AND enabled = 1', [user.id])
    : [];
  const vectorSources = includePersonal
    ? queryAll('SELECT * FROM vector_sources WHERE user_id = ? AND enabled = 1', [user.id])
    : [];
  const obsidianSources = includePersonal
    ? queryAll('SELECT * FROM obsidian_sources WHERE user_id = ? AND enabled = 1', [user.id])
    : [];
  const aiProfile = getAiProfileRow(user.id);
  searchService.ensureSearchIndex(db, queryAll, user.id, {
    decryptLibraryItem: (row) => decryptContent(row, user, requireSessionPassword()),
  });
  saveDatabase();
  const vectorOptions = {
    enabled: isLocalVectorSearchEnabled(),
    modelName: currentVectorModel(),
  };
  const evidence = [...await searchService.searchLocalAssets(db, queryAll, user.id, cleanQuestion, searchContext, vectorOptions)];
  const setupHints = [];

  const feishuToken = getFeishuToken();
  if (feishuToken && feishuToken.accessToken && getFeishuWikiSettings().enabled) {
    try {
      evidence.push(...await callFeishuWikiRetriever(cleanQuestion));
    } catch (error) {
      const message = String(error.message || error);
      if (message.includes('wiki') || message.includes('权限') || message.includes('scope')) {
        setupHints.push(knowledgeHints.feishuWikiScopeHint(message));
      } else {
        evidence.push({
          source: '飞书知识库',
          type: 'feishu_wiki',
          title: '飞书 Wiki 检索失败',
          content: message,
          score: null,
        });
      }
    }
  } else if (
    includePersonal
    && !knowledgeSources.length
    && !vectorSources.length
    && !obsidianSources.length
  ) {
    setupHints.push(knowledgeHints.feishuWikiLoginHint());
  }

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
  if (obsidianSources.length) {
    for (const source of obsidianSources) {
      try {
        evidence.push(...await callObsidianRetriever(source, cleanQuestion));
      } catch (error) {
        evidence.push({ source: source.name, type: 'obsidian', title: 'Obsidian 检索失败', content: String(error.message || error), score: null });
      }
    }
  } else if (includePersonal) {
    setupHints.push(knowledgeHints.obsidianSetupHint());
  }

  const hasRemote = Boolean(feishuToken && feishuToken.accessToken && getFeishuWikiSettings().enabled)
    || knowledgeSources.length + vectorSources.length + obsidianSources.length > 0;
  const actionableEvidence = evidence.filter((item) => !item.isHint);
  if (actionableEvidence.length === 0 && setupHints.length === 0) {
    throw new Error(
      hasRemote
        ? '没有匹配内容。请尝试更短的关键词，或检查飞书/远程知识库是否可用。'
        : '内容库为空。请先在「添加」中保存条目，或登录飞书启用「飞书知识库」检索（配置 → 飞书知识库）。',
    );
  }
  const allEvidence = [...actionableEvidence, ...setupHints];
  const synthesis = await synthesizeWithLlm(aiProfile, cleanQuestion, allEvidence);
  const log = {
    id: crypto.randomUUID(),
    userId: user.id,
    question: cleanQuestion,
    answer: synthesis.answer,
    evidence: allEvidence,
    setupHints,
    createdAt: new Date().toISOString(),
  };
  db.run(
    'INSERT INTO query_logs (id, user_id, question, answer, evidence_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [log.id, user.id, log.question, log.answer, JSON.stringify(log.evidence), log.createdAt],
  );
  saveDatabase();
  return { ...log, state: publicState(), usedLlm: synthesis.usedLlm, setupHints };
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'assets', 'app-icon.png');
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 1280,
    minHeight: 780,
    title: 'VaultMind',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(iconPath);
  }

  // In development, load the Vite dev server; otherwise load the built renderer.
  const isDev = process.env.NODE_ENV === 'development' && !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }
}

function closeHttpServer(server) {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    if (!server.listening) {
      resolve();
      return;
    }
    server.close(() => resolve());
  });
}

async function cancelPendingFeishuLoginAsync(reason = '飞书登录已取消') {
  if (!pendingLogin) return;
  const { server, reject } = pendingLogin;
  pendingLogin = null;
  await closeHttpServer(server);
  if (typeof reject === 'function') {
    try {
      reject(new Error(reason));
    } catch {
      // Promise may already be settled.
    }
  }
}

function cancelPendingFeishuLogin(reason = '飞书登录已取消') {
  cancelPendingFeishuLoginAsync(reason).catch(() => {});
}

function feishuRedirectUri(settings) {
  return `http://127.0.0.1:${settings.redirectPort}/feishu/oauth/callback`;
}

function feishuSafeSettingsUrl(appId) {
  return `https://open.feishu.cn/app/${encodeURIComponent(appId)}/safe`;
}

function openFeishuAuthInBrowser(authUrl) {
  shell.openExternal(authUrl);
}

async function handleFeishuLogin() {
  await ensureDatabase();
  requireUser();
  const settings = getSettings();
  if (!settings.appId || !settings.appSecret) {
    throw new Error('请先填写飞书 App ID 和 App Secret');
  }
  await cancelPendingFeishuLoginAsync('准备新的飞书登录');

  const stateValue = crypto.randomBytes(18).toString('hex');
  const redirectUri = feishuRedirectUri(settings);
  await new Promise((resolve, reject) => {
    let loginTimeout = null;
    const finish = (fn) => {
      if (loginTimeout) clearTimeout(loginTimeout);
      fn();
    };
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
        res.end(oauthSuccessHtml());
        server.close();
        pendingLogin = null;
        finish(resolve);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h2>飞书登录失败</h2><pre>${String(err)}</pre>`);
        server.close();
        pendingLogin = null;
        finish(() => reject(err));
      }
    });
    server.listen(settings.redirectPort, '127.0.0.1', () => {
      pendingLogin = { server, reject };
      loginTimeout = setTimeout(() => {
        server.close();
        pendingLogin = null;
        reject(new Error('飞书登录超时（10 分钟）。若浏览器报 20029，请先在开放平台配置重定向 URL。'));
      }, 10 * 60 * 1000);
      const authUrl = new URL(FEISHU_AUTH);
      authUrl.searchParams.set('client_id', settings.appId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', REQUIRED_SCOPES);
      authUrl.searchParams.set('state', stateValue);
      openFeishuAuthInBrowser(authUrl.toString());
    });
    server.on('error', (err) => {
      pendingLogin = null;
      if (err && err.code === 'EADDRINUSE') {
        reject(new Error(
          `OAuth 回调端口 ${settings.redirectPort} 已被占用（可能上次登录未结束或开了多个 VaultMind）。`
          + ' 请完全退出应用后重试；或在终端执行：'
          + `lsof -ti :${settings.redirectPort} | xargs kill -9`,
        ));
        return;
      }
      reject(err);
    });
  });
  return publicState();
}

function oauthSuccessHtml() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>飞书登录成功</title></head>
<body style="font-family:system-ui,sans-serif;padding:32px;line-height:1.6">
<h2>飞书登录成功</h2>
<p>可以<strong>关闭此浏览器标签页</strong>，回到 VaultMind。顶栏应显示飞书用户名。</p>
</body></html>`;
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
    createLocalSession(user.id, password);
    const acceptedInvites = afterAuthSuccess(user, password);
    return { ...publicState(), recoveryCode, acceptedInvites };
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
    createLocalSession(user.id, password);
    const acceptedInvites = afterAuthSuccess(user, password);
    return { ...publicState(), acceptedInvites };
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

  ipcMain.handle('vault:changeLocalPassword', async (_event, input) => {
    await ensureDatabase();
    return changeLocalPassword(input || {});
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
    const encryptedData = queryOne(
      `SELECT
        (SELECT COUNT(*) FROM library_items WHERE user_id = ?) +
        (SELECT COUNT(*) FROM decrypted_items WHERE user_id = ?) +
        (SELECT COUNT(*) FROM project_accounts WHERE user_id = ?) +
        (SELECT COUNT(*) FROM group_member_keys WHERE user_id = ?) AS total`,
      [user.id, user.id, user.id, user.id],
    );
    if (Number(encryptedData?.total || 0) > 0) {
      throw new Error('该账号已有加密内容，无法在不知道旧密码的情况下安全重置。请用旧密码登录后在「配置 → 账户恢复」中修改本地密码。');
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
    const next = sanitizeSettings(input || {}, previous.appSecret, previous.feishuPassphrase);
    setStateValue('settings', next);
    return publicState();
  });

  ipcMain.handle('vault:saveLocalVectorSettings', async (_event, input) => {
    await ensureDatabase();
    requireUser();
    const previous = getSettings();
    setStateValue('settings', {
      ...previous,
      localVectorSearch: Boolean(input?.localVectorSearch),
      localVectorModel: String(input?.localVectorModel || DEFAULT_SETTINGS.localVectorModel).trim() || DEFAULT_SETTINGS.localVectorModel,
    });
    return publicState();
  });

  ipcMain.handle('vault:testFeishuSync', async (_event, input) => {
    await ensureDatabase();
    return testFeishuSync(input || {});
  });

  ipcMain.handle('vault:openFeishuRedirectSettings', async () => {
    await ensureDatabase();
    const settings = getSettings();
    if (!settings.appId) throw new Error('请先填写并保存飞书 App ID');
    const redirectUri = feishuRedirectUri(settings);
    await shell.openExternal(feishuSafeSettingsUrl(settings.appId));
    return { redirectUri, appId: settings.appId, settingsUrl: feishuSafeSettingsUrl(settings.appId) };
  });

  ipcMain.handle('vault:login', handleFeishuLogin);
  ipcMain.handle('vault:loginFeishu', handleFeishuLogin);

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

  ipcMain.handle('vault:chooseWechatAttachments', async () => {
    await ensureDatabase();
    requireUser();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择微信附件目录（WeChat Files / FileStorage / MsgAttach）',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const rootDir = result.filePaths[0];
    return {
      canceled: false,
      rootDir,
      files: scanWechatAttachments(rootDir),
    };
  });

  ipcMain.handle('vault:scanWechatAttachments', async () => {
    await ensureDatabase();
    requireUser();
    const result = scanDefaultWechatAttachments();
    return {
      canceled: false,
      ...result,
    };
  });

  ipcMain.handle('vault:uploadFiles', async (event, payload) => {
    await ensureDatabase();
    const filePaths = Array.isArray(payload && payload.filePaths) ? payload.filePaths : [];
    if (filePaths.length === 0) throw new Error('请选择至少一个本地文件');
    const scopeMeta = resolveScopeFromInput(payload || {});
    const uploadId = String(payload && payload.uploadId ? payload.uploadId : crypto.randomUUID());
    const total = filePaths.length;
    const records = [];
    const failures = [];
    sendUploadProgress(event, {
      uploadId,
      phase: 'start',
      total,
      completed: 0,
      processed: 0,
      failed: 0,
      current: '',
    });
    for (let index = 0; index < filePaths.length; index += 1) {
      const filePath = filePaths[index];
      const fileName = path.basename(filePath);
      sendUploadProgress(event, {
        uploadId,
        phase: 'file-start',
        total,
        completed: records.length,
        processed: index,
        failed: failures.length,
        current: fileName,
        index,
      });
      try {
        const record = await uploadVaultPayload(payloadFromFile(filePath), configuredFeishuPassphrase(payload.passphrase), scopeMeta);
        records.push(record);
        sendUploadProgress(event, {
          uploadId,
          phase: 'file-done',
          total,
          completed: records.length,
          processed: index + 1,
          failed: failures.length,
          current: fileName,
          index,
        });
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        failures.push({ path: filePath, fileName, message });
        sendUploadProgress(event, {
          uploadId,
          phase: 'file-error',
          total,
          completed: records.length,
          processed: index + 1,
          failed: failures.length,
          current: fileName,
          index,
          message,
        });
      }
    }
    sendUploadProgress(event, {
      uploadId,
      phase: 'complete',
      total,
      completed: records.length,
      processed: total,
      failed: failures.length,
      current: '',
    });
    return { state: publicState(), records, failures };
  });

  ipcMain.handle('vault:uploadText', async (_event, payload) => {
    await ensureDatabase();
    const scopeMeta = resolveScopeFromInput(payload || {});
    const record = await uploadVaultPayload(payloadFromText(payload.name, payload.text), configuredFeishuPassphrase(payload.passphrase), scopeMeta);
    return { state: publicState(), records: [record] };
  });

  ipcMain.handle('vault:downloadRecord', async (_event, payload) => {
    await ensureDatabase();
    return downloadRecordToLocal(String(payload.recordId || ''), configuredFeishuPassphrase(payload.passphrase));
  });
  ipcMain.handle('vault:openAsset', async (_event, payload) => {
    await ensureDatabase();
    return openAsset(payload || {});
  });

  ipcMain.handle('vault:unlockItem', async (_event, payload) => {
    await ensureDatabase();
    const item = unlockLibraryItem(String(payload.itemId || ''));
    return { id: item.id, name: item.name || item.title, text: item.content || item.url || '' };
  });

  ipcMain.handle('vault:openItem', async (_event, payload) => {
    await ensureDatabase();
    return openLibraryItem(String(payload.itemId || ''));
  });

  ipcMain.handle('vault:saveItemFile', async (_event, payload) => {
    await ensureDatabase();
    const user = requireUser();
    const row = queryOne('SELECT * FROM decrypted_items WHERE id = ?', [String(payload.itemId || '')]);
    if (!row) throw new Error('找不到这条本地文件');
    if (row.scope === 'group') {
      groupService.requireGroupAccess(db, queryOne, row.group_id, user.id);
    } else if (row.user_id !== user.id) {
      throw new Error('找不到这条本地文件');
    }
    if (row.kind !== 'file') throw new Error('这个条目不是文件');
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '保存文件到本地',
      defaultPath: row.name,
    });
    if (result.canceled || !result.filePath) return publicState();
    const bytes = decryptContent(row, user, requireSessionPassword());
    fs.writeFileSync(result.filePath, bytes);
    db.run('UPDATE decrypted_items SET saved_path = ? WHERE id = ?', [result.filePath, row.id]);
    saveDatabase();
    return publicState();
  });

  ipcMain.handle('vault:forgetRecord', async (_event, recordId) => {
    await ensureDatabase();
    const user = requireUser();
    const row = queryOne('SELECT * FROM records WHERE id = ?', [recordId]);
    if (row) {
      if (row.scope === 'group') {
        groupService.requireGroupAccess(db, queryOne, row.group_id, user.id, ['owner', 'admin', 'member']);
      } else if (row.user_id !== user.id) {
        throw new Error('无权移除此记录');
      }
    }
    db.run('DELETE FROM records WHERE id = ?', [recordId]);
    db.run('DELETE FROM decrypted_items WHERE record_id = ?', [recordId]);
    vectorSearch.removeVector(db, recordId);
    saveDatabase();
    return publicState();
  });

  ipcMain.handle('vault:forgetItem', async (_event, itemId) => {
    await ensureDatabase();
    const user = requireUser();
    const id = String(itemId || '');
    const lib = queryOne('SELECT * FROM library_items WHERE id = ?', [id]);
    const decrypted = queryOne('SELECT * FROM decrypted_items WHERE id = ?', [id]);
    const row = lib || decrypted;
    if (!row) throw new Error('找不到这条本地内容');
    if (row.scope === 'group') {
      groupService.requireGroupAccess(db, queryOne, row.group_id, user.id, ['owner', 'admin', 'member']);
    } else if (row.user_id !== user.id) {
      throw new Error('找不到这条本地内容');
    }
    db.run('DELETE FROM decrypted_items WHERE id = ?', [id]);
    db.run('DELETE FROM library_items WHERE id = ?', [id]);
    searchService.removeAssetIndex(db, id);
    vectorSearch.removeVector(db, id);
    saveDatabase();
    return publicState();
  });

  ipcMain.handle('vault:createLibraryItem', async (_event, payload) => {
    await ensureDatabase();
    const result = await createLibraryItem(payload || {});
    const settings = getSettings();
    if (settings.feishuAutoSync && ['text', 'secret', 'web', 'video'].includes(String(payload?.kind || 'text'))) {
      try {
        const scopeMeta = resolveScopeFromInput(payload || {});
        const passphrase = configuredFeishuPassphrase(settings.feishuPassphrase);
        const text = String(payload?.content || '').trim();
        const title = String(payload?.title || '').trim() || '未命名条目';
        if (text) {
          await uploadVaultPayload(payloadFromText(title, text), passphrase, scopeMeta);
        }
      } catch (syncError) {
        console.error('自动同步到飞书失败:', syncError.message || syncError);
      }
    }
    return result;
  });

  ipcMain.handle('vault:saveProjectAccount', async (_event, payload) => {
    await ensureDatabase();
    return saveProjectAccount(payload || {});
  });

  ipcMain.handle('vault:saveProjectRepository', async (_event, payload) => {
    await ensureDatabase();
    return saveProjectRepository(payload || {});
  });

  ipcMain.handle('vault:getProjectsDetail', async () => {
    await ensureDatabase();
    const user = requireUser();
    const context = getContext();
    const data = projectsForContext(user.id, context);
    const accounts = data.accounts;
    const repositories = await enrichProjectRepositories(
      context.scope === 'group'
        ? queryAll('SELECT * FROM project_repositories WHERE scope = ? AND group_id = ? ORDER BY created_at DESC', ['group', context.groupId])
        : queryAll(
          `SELECT * FROM project_repositories WHERE user_id = ? AND (scope IS NULL OR scope = 'personal') ORDER BY created_at DESC`,
          [user.id],
        ),
    );
    return { accounts, repositories, state: publicState() };
  });

  ipcMain.handle('vault:deleteProjectRepository', async (_event, repoId) => {
    await ensureDatabase();
    const user = requireUser();
    const id = String(repoId || '');
    const repo = queryOne('SELECT * FROM project_repositories WHERE id = ?', [id]);
    if (!repo) throw new Error('找不到项目配置');
    if (repo.scope === 'group') {
      groupService.requireGroupAccess(db, queryOne, repo.group_id, user.id, ['owner', 'admin', 'member']);
    } else if (repo.user_id !== user.id) {
      throw new Error('找不到项目配置');
    }
    db.run('DELETE FROM project_repositories WHERE id = ?', [id]);
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

  ipcMain.handle('vault:listModels', async (_event, input) => {
    await ensureDatabase();
    const user = requireUser();
    const previous = queryOne('SELECT api_key FROM ai_profiles WHERE user_id = ?', [user.id]);
    const payload = {
      ...(input || {}),
      apiKey: input && input.apiKey === '********' ? (previous && previous.api_key ? previous.api_key : '') : input?.apiKey,
    };
    return listLlmModels(payload);
  });

  ipcMain.handle('vault:testModel', async (_event, input) => {
    await ensureDatabase();
    const user = requireUser();
    const previous = queryOne('SELECT api_key FROM ai_profiles WHERE user_id = ?', [user.id]);
    const payload = {
      ...(input || {}),
      apiKey: input && input.apiKey === '********' ? (previous && previous.api_key ? previous.api_key : '') : input?.apiKey,
    };
    return testLlmProfile(payload);
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

  ipcMain.handle('vault:saveFeishuWikiSettings', async (_event, input) => {
    await ensureDatabase();
    return saveFeishuWikiSettings(input || {});
  });

  ipcMain.handle('vault:queryKnowledgeCenter', async (_event, payload) => {
    await ensureDatabase();
    return queryKnowledgeCenter(payload && payload.question, payload || {});
  });

  ipcMain.handle('vault:setContext', async (_event, input) => {
    await ensureDatabase();
    requireUser();
    setContext(input || {});
    return publicState();
  });

  ipcMain.handle('vault:createGroup', async (_event, input) => {
    await ensureDatabase();
    const user = requireUser();
    const password = requireSessionPassword();
    groupService.createGroup(db, saveDatabase, queryOne, user, password, input || {});
    return publicState();
  });

  ipcMain.handle('vault:inviteToGroup', async (_event, input) => {
    await ensureDatabase();
    const user = requireUser();
    const password = requireSessionPassword();
    const result = groupService.inviteToGroup(db, saveDatabase, queryOne, queryAll, user, password, input || {});
    return { ...result, state: publicState() };
  });

  ipcMain.handle('vault:leaveGroup', async (_event, groupId) => {
    await ensureDatabase();
    groupService.leaveGroup(db, saveDatabase, queryOne, queryAll, requireUser(), String(groupId || ''));
    if (getContext().groupId === groupId) setContext({ scope: 'personal' });
    return publicState();
  });

  ipcMain.handle('vault:removeGroupMember', async (_event, payload) => {
    await ensureDatabase();
    const user = requireUser();
    const password = requireSessionPassword();
    groupService.removeGroupMember(db, saveDatabase, queryOne, queryAll, user, password, payload || {});
    return publicState();
  });

  ipcMain.handle('vault:rotateGroupKey', async (_event, groupId) => {
    await ensureDatabase();
    const user = requireUser();
    const password = requireSessionPassword();
    const result = groupService.rotateGroupKey(db, saveDatabase, queryOne, queryAll, user, password, String(groupId || ''));
    return { ...result, state: publicState() };
  });

  ipcMain.handle('vault:updateMemberRole', async (_event, payload) => {
    await ensureDatabase();
    groupService.updateMemberRole(db, saveDatabase, queryOne, requireUser(), payload || {});
    return publicState();
  });

  ipcMain.handle('vault:transferGroupOwnership', async (_event, payload) => {
    await ensureDatabase();
    groupService.transferOwnership(db, saveDatabase, queryOne, requireUser(), payload || {});
    return publicState();
  });

  ipcMain.handle('vault:acceptPendingInvites', async () => {
    await ensureDatabase();
    const user = requireUser();
    const password = requireSessionPassword();
    const accepted = groupService.processPendingInvitesForUser(db, saveDatabase, queryOne, queryAll, user, password);
    return { accepted, state: publicState() };
  });

  ipcMain.handle('vault:listGroupMembers', async (_event, groupId) => {
    await ensureDatabase();
    const user = requireUser();
    return groupService.listGroupMembers(db, queryAll, queryOne, String(groupId || ''), user.id);
  });

  ipcMain.handle('vault:search', async (_event, payload) => {
    await ensureDatabase();
    const user = requireUser();
    const q = String(payload?.query || '').trim();
    if (!q) return { results: [], state: publicState() };
    const context = payload?.searchScope === 'all'
      ? { scope: 'all', groupId: '' }
      : (payload?.context || getContext());
    const vectorOptions = {
      enabled: isLocalVectorSearchEnabled(),
      modelName: currentVectorModel(),
    };
    const results = await searchService.searchLocalAssets(db, queryAll, user.id, q, context, vectorOptions);
    return { results, state: publicState() };
  });

  ipcMain.handle('vault:reindexSearch', async () => {
    await ensureDatabase();
    const user = requireUser();
    searchService.reindexAllForUser(db, queryAll, user.id);
    saveDatabase();
    return publicState();
  });

  ipcMain.handle('vault:copyItemToGroup', async (_event, payload) => {
    await ensureDatabase();
    const user = requireUser();
    const password = requireSessionPassword();
    const itemId = String(payload?.itemId || '');
    const groupId = String(payload?.groupId || '');
    groupService.requireGroupAccess(db, queryOne, groupId, user.id, ['owner', 'admin', 'member']);
    const lib = queryOne('SELECT * FROM library_items WHERE id = ?', [itemId]);
    if (!lib || lib.scope !== 'personal' || lib.user_id !== user.id) {
      throw new Error('只能复制自己的个人库条目到组');
    }
    const bytes = decryptContent(lib, user, password);
    await createLibraryItem({
      kind: lib.kind,
      title: `${lib.title} (组副本)`,
      url: lib.url || '',
      content: JSON.parse(bytes.toString('utf8')).content || '',
      scope: 'group',
      groupId,
      tags: lib.tags,
    });
    return publicState();
  });

  ipcMain.handle('vault:syncManifest', async (_event, payload) => {
    await ensureDatabase();
    requireUser();
    const push = await pushManifestToFeishu(payload || {});
    return { ok: true, fileToken: push.fileToken, state: publicState() };
  });

  ipcMain.handle('vault:pullManifest', async (_event, payload) => {
    await ensureDatabase();
    const result = await pullManifestFromFeishu(payload || {});
    return { ...result, state: publicState() };
  });

  ipcMain.handle('vault:fullSync', async (_event, payload) => {
    await ensureDatabase();
    return fullSyncManifest(payload || {});
  });

  ipcMain.handle('vault:openExternal', (_event, url) => shell.openExternal(String(url)));
  ipcMain.handle('vault:showDatabase', async () => {
    await ensureDatabase();
    shell.showItemInFolder(databasePath());
  });
}

app.on('before-quit', () => {
  cancelPendingFeishuLogin('应用正在退出');
});

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
