const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { migrateSchema } = require('../core/schema');

let SQL = null;
let db = null;

let activeUser = null;
let activePassword = '';
let activeContext = { scope: 'personal', groupId: '', groupName: '' };
let mainWindow = null;
let pendingLogin = null;

function setMainWindow(win) { mainWindow = win; }
function getMainWindow() { return mainWindow; }
function setPendingLogin(login) { pendingLogin = login; }
function getPendingLogin() { return pendingLogin; }

function databasePath(app) {
  return path.join(app.getPath('userData'), 'secure-vault.sqlite');
}

async function ensureDatabase(app) {
  if (db) return db;
  SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file),
  });
  const target = databasePath(app);
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
  saveDatabase(app);
  return db;
}

function ensureColumn(table, column, type) {
  try {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch {
    // column already exists
  }
}

function saveDatabase(app) {
  if (!db) return;
  fs.mkdirSync(path.dirname(databasePath(app)), { recursive: true });
  fs.writeFileSync(databasePath(app), Buffer.from(db.export()));
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

function getDb() { return db; }
function getActiveUser() { return activeUser; }
function setActiveUser(user) { activeUser = user; }
function getActivePassword() { return activePassword; }
function setActivePassword(pw) { activePassword = pw; }
function getActiveContext() { return activeContext; }
function setActiveContext(ctx) { activeContext = ctx; }

function requireUser() {
  if (!activeUser) throw new Error('请先登录本地账号');
  return activeUser;
}

function requireSessionPassword() {
  if (!activePassword) throw new Error('请重新登录本地账号');
  return activePassword;
}

module.exports = {
  ensureDatabase,
  saveDatabase,
  queryOne,
  queryAll,
  setStateValue,
  getStateValue,
  ensureColumn,
  databasePath,
  getDb,
  getActiveUser,
  setActiveUser,
  getActivePassword,
  setActivePassword,
  getActiveContext,
  setActiveContext,
  requireUser,
  requireSessionPassword,
  setMainWindow,
  getMainWindow,
  setPendingLogin,
  getPendingLogin,
};
