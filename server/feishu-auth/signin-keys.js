'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function createSigninKeyStore({ directory, tokenKey, appId }) {
  function location(openId) {
    if (!openId || typeof openId !== 'string') throw Error('Missing Feishu identity');
    const subject = `${appId}:${openId}`;
    const id = crypto.createHash('sha256').update(subject).digest('hex');
    return { file: path.join(directory, `${id}.json`), subject };
  }
  function read(openId) {
    const { file, subject } = location(openId);
    let record;
    try { record = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (record.version !== 1) throw Error('Unsupported sign-in key version');
    const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey, Buffer.from(record.iv, 'base64'));
    decipher.setAAD(Buffer.from(subject));
    decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  }
  function create(openId, legacyPassphrase) {
    if (legacyPassphrase !== undefined && (typeof legacyPassphrase !== 'string' || legacyPassphrase.length < 8 || legacyPassphrase.length > 1024)) throw Error('Invalid legacy key');
    const existing = read(openId);
    if (existing !== null) {
      if (legacyPassphrase !== undefined && existing !== legacyPassphrase) throw Error('Sign-in key already exists');
      return existing;
    }
    const { file, subject } = location(openId);
    const passphrase = legacyPassphrase === undefined ? crypto.randomBytes(32).toString('base64url') : legacyPassphrase;
    const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', tokenKey, iv);
    cipher.setAAD(Buffer.from(subject));
    const ciphertext = Buffer.concat([cipher.update(passphrase, 'utf8'), cipher.final()]);
    const record = JSON.stringify({ version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') });
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const temporary = `${file}.${crypto.randomBytes(12).toString('hex')}.tmp`;
    try {
      fs.writeFileSync(temporary, record, { mode: 0o600, flag: 'wx' });
      try { fs.linkSync(temporary, file); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    } finally { fs.rmSync(temporary, { force: true }); }
    const saved = read(openId);
    if (legacyPassphrase !== undefined && saved !== legacyPassphrase) throw Error('Sign-in key already exists');
    return saved;
  }
  return { read, create };
}
module.exports = { createSigninKeyStore };
