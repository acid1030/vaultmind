const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { safeStorage } = require('electron');

const LOCAL_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const db = require('./db');
const cryptoSvc = require('./crypto');

function sessionTokenPath(app) {
  return path.join(app.getPath('userData'), 'local-session-token');
}

function sessionPasswordPath(app) {
  return path.join(app.getPath('userData'), 'local-session-password');
}

function persistSessionPassword(app, password) {
  if (!safeStorage.isEncryptionAvailable()) return;
  const encrypted = safeStorage.encryptString(String(password || ''));
  fs.writeFileSync(sessionPasswordPath(app), encrypted, { mode: 0o600 });
}

function restoreSessionPassword(app) {
  if (!safeStorage.isEncryptionAvailable()) return '';
  try {
    const encrypted = fs.readFileSync(sessionPasswordPath(app));
    return safeStorage.decryptString(encrypted);
  } catch {
    return '';
  }
}

function createLocalSession(app, userId, password = '') {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + LOCAL_SESSION_TTL_MS;
  const { queryOne, getDb, saveDatabase } = db;
  getDb().run('DELETE FROM local_sessions WHERE user_id = ?', [userId]);
  getDb().run(
    'INSERT INTO local_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    [cryptoSvc.hashSessionToken(token), userId, expiresAt, new Date().toISOString()],
  );
  fs.writeFileSync(sessionTokenPath(app), token, { mode: 0o600 });
  if (password) persistSessionPassword(app, password);
  saveDatabase(app);
}

function clearLocalSession(app) {
  const { getDb, saveDatabase } = db;
  try {
    const token = fs.readFileSync(sessionTokenPath(app), 'utf8').trim();
    if (token) getDb().run('DELETE FROM local_sessions WHERE token_hash = ?', [cryptoSvc.hashSessionToken(token)]);
  } catch {
    // no session file
  }
  try { fs.rmSync(sessionTokenPath(app), { force: true }); } catch { /* ignore */ }
  try { fs.rmSync(sessionPasswordPath(app), { force: true }); } catch { /* ignore */ }
  saveDatabase(app);
}

function restoreLocalSession(app) {
  const { getDb, queryOne, setActiveUser, setActivePassword, saveDatabase } = db;
  if (db.getActiveUser()) return;
  try {
    const token = fs.readFileSync(sessionTokenPath(app), 'utf8').trim();
    if (!token) return;
    const row = queryOne('SELECT * FROM local_sessions WHERE token_hash = ?', [cryptoSvc.hashSessionToken(token)]);
    if (!row || Number(row.expires_at) < Date.now()) {
      clearLocalSession(app);
      return;
    }
    setActiveUser(queryOne('SELECT * FROM users WHERE id = ?', [row.user_id]));
    setActivePassword(restoreSessionPassword(app));
    getDb().run('UPDATE local_sessions SET expires_at = ? WHERE token_hash = ?', [Date.now() + LOCAL_SESSION_TTL_MS, cryptoSvc.hashSessionToken(token)]);
    saveDatabase(app);
  } catch {
    // ignore missing/invalid session
  }
}

module.exports = {
  LOCAL_SESSION_TTL_MS,
  sessionTokenPath,
  sessionPasswordPath,
  createLocalSession,
  clearLocalSession,
  restoreLocalSession,
};
