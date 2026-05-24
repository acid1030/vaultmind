const crypto = require('crypto');

const LOCAL_KEY_ITERATIONS = 180000;

function deriveContentKey(password, saltBase64) {
  return crypto.pbkdf2Sync(password, Buffer.from(saltBase64, 'base64'), LOCAL_KEY_ITERATIONS, 32, 'sha256');
}

function generateGroupKey() {
  return crypto.randomBytes(32);
}

function wrapGroupKey(groupKey, user, password) {
  const iv = crypto.randomBytes(12);
  const key = deriveContentKey(password, user.password_salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(groupKey), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

function unwrapGroupKey(wrapped, user, password) {
  const key = deriveContentKey(password, user.password_salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(wrapped.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(wrapped.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(wrapped.ciphertext, 'base64')),
    decipher.final(),
  ]);
}

function encryptWithGroupKey(bytes, groupKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', groupKey, iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

function decryptWithGroupKey(item, groupKey) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', groupKey, Buffer.from(item.content_iv || item.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(item.content_tag || item.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(item.content_ciphertext || item.ciphertext, 'base64')),
    decipher.final(),
  ]);
}

module.exports = {
  generateGroupKey,
  wrapGroupKey,
  unwrapGroupKey,
  encryptWithGroupKey,
  decryptWithGroupKey,
};
