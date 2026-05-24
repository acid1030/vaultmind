const crypto = require('crypto');

const INVITE_ITERATIONS = 120000;
const APP_INVITE_SALT = Buffer.from('VaultMind-GroupInvite-v1', 'utf8');

function deriveInviteKey(email, groupId) {
  const material = `${String(email).trim().toLowerCase()}|${groupId}`;
  return crypto.pbkdf2Sync(material, APP_INVITE_SALT, INVITE_ITERATIONS, 32, 'sha256');
}

function sealGroupKeyForInvite(groupKey, email, groupId) {
  const key = deriveInviteKey(email, groupId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(groupKey), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

function openGroupKeyFromInvite(sealed, email, groupId) {
  const key = deriveInviteKey(email, groupId);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
    decipher.final(),
  ]);
}

module.exports = {
  deriveInviteKey,
  sealGroupKeyForInvite,
  openGroupKeyFromInvite,
};
