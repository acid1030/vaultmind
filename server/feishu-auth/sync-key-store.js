'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

function createSyncKeyStore(directory, tokenKey, appId) {
  const key = Buffer.from(crypto.hkdfSync('sha256', tokenKey, '', 'mizhan sync key storage v1', 32));

  function recordPath(openId) {
    const id = crypto.createHash('sha256').update(JSON.stringify([appId, openId])).digest('hex');
    return path.join(directory, id);
  }

  async function read(openId) {
    const file = recordPath(openId);
    let bytes;
    try {
      bytes = await fs.readFile(file);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(path.basename(file)));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]));
  }

  async function enroll(openId, record) {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const file = recordPath(openId);
    const temporary = file + '.' + crypto.randomUUID();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(path.basename(file)));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(record)), cipher.final()]);
    await fs.writeFile(temporary, Buffer.concat([iv, cipher.getAuthTag(), encrypted]), { flag: 'wx', mode: 0o600 });
    try {
      await fs.link(temporary, file);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    } finally {
      await fs.unlink(temporary);
    }
    const saved = await read(openId);
    return saved?.vaultId === record.vaultId && saved?.passphrase === record.passphrase;
  }

  return { read, enroll };
}

function verifyAccountProfile(bytes, passphrase, vaultId) {
  const envelope = JSON.parse(bytes.toString('utf8'));
  if (envelope.version !== 2 || envelope.kdf?.iterations !== 210000) throw Error('Unsupported account file');
  const key = crypto.pbkdf2Sync(passphrase, Buffer.from(envelope.kdf.salt, 'base64'), 210000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const payload = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]));
  const profile = JSON.parse(payload.text);
  if (payload.kind !== 'account-profile' || profile.kind !== 'account-profile' || profile.vaultId !== vaultId) {
    throw Error('Account file does not match');
  }
}

module.exports = { createSyncKeyStore, verifyAccountProfile };
