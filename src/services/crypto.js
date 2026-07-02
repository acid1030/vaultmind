const crypto = require('crypto');

const VAULT_VERSION = 2;
const KEY_ITERATIONS = 210000;
const LOCAL_KEY_ITERATIONS = 180000;

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, Buffer.from(salt, 'base64'), LOCAL_KEY_ITERATIONS, 32, 'sha256').toString('base64');
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

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  VAULT_VERSION,
  KEY_ITERATIONS,
  LOCAL_KEY_ITERATIONS,
  hashPassword,
  deriveContentKey,
  encryptForLocalUser,
  decryptForLocalUser,
  deriveVaultKey,
  encryptVaultPayload,
  decryptVaultPayload,
  hashSessionToken,
};
