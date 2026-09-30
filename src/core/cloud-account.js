const crypto = require('crypto');

const PROFILE_VERSION = 1;

function hashFeishuOpenId(openId) {
  const value = String(openId || '').trim();
  if (!value) throw new Error('飞书账号缺少 openId，请重新登录飞书');
  return crypto.createHash('sha256').update(value).digest('hex');
}

function accountFileName(openId) {
  return `vaultmind-account-${hashFeishuOpenId(openId).slice(0, 24)}.axonvault`;
}

function normalizeDevice(device, now = new Date().toISOString()) {
  return {
    id: String(device?.id || '').trim(),
    name: String(device?.name || '未命名设备').trim() || '未命名设备',
    platform: String(device?.platform || 'unknown').trim() || 'unknown',
    status: device?.status === 'revoked' ? 'revoked' : 'active',
    createdAt: String(device?.createdAt || now),
    lastSeenAt: String(device?.lastSeenAt || now),
  };
}

function createProfile({ vaultId, email, username, device, createdAt }) {
  const now = new Date().toISOString();
  if (!vaultId) throw new Error('缺少云端账号 ID');
  const current = normalizeDevice(device, now);
  if (!current.id) throw new Error('缺少设备 ID');
  return {
    version: PROFILE_VERSION,
    kind: 'account-profile',
    vaultId: String(vaultId),
    email: String(email || '').trim().toLowerCase(),
    username: String(username || '').trim(),
    createdAt: String(createdAt || now),
    updatedAt: now,
    devices: [current],
  };
}

function mergeDevice(profile, device) {
  if (!profile || profile.kind !== 'account-profile' || !profile.vaultId) {
    throw new Error('云端账号文件无效');
  }
  const now = new Date().toISOString();
  const current = normalizeDevice(device, now);
  if (!current.id) throw new Error('缺少设备 ID');
  const map = new Map((profile.devices || []).map((item) => {
    const normalized = normalizeDevice(item, now);
    return [normalized.id, normalized];
  }));
  const previous = map.get(current.id);
  map.set(current.id, {
    ...previous,
    ...current,
    createdAt: previous?.createdAt || current.createdAt,
    status: 'active',
    lastSeenAt: now,
  });
  return {
    ...profile,
    version: PROFILE_VERSION,
    kind: 'account-profile',
    updatedAt: now,
    devices: [...map.values()].sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt)),
  };
}

function mergeKnownDevices(profile, devices = []) {
  if (!profile || profile.kind !== 'account-profile' || !profile.vaultId) {
    throw new Error('云端账号文件无效');
  }
  const now = new Date().toISOString();
  const map = new Map((profile.devices || []).map((item) => {
    const normalized = normalizeDevice(item, now);
    return [normalized.id, normalized];
  }));
  for (const device of devices) {
    const incoming = normalizeDevice(device, now);
    if (!incoming.id) continue;
    const previous = map.get(incoming.id);
    if (!previous || Date.parse(incoming.lastSeenAt) > Date.parse(previous.lastSeenAt)) {
      map.set(incoming.id, {
        ...previous,
        ...incoming,
        createdAt: previous?.createdAt || incoming.createdAt,
      });
    }
  }
  return {
    ...profile,
    version: PROFILE_VERSION,
    kind: 'account-profile',
    devices: [...map.values()].sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt)),
  };
}

function encryptProfile(profile, passphrase, encryptVaultPayload) {
  return encryptVaultPayload({
    kind: 'account-profile',
    name: `account-${profile.vaultId}`,
    sourcePath: '',
    size: Buffer.byteLength(JSON.stringify(profile), 'utf8'),
    text: JSON.stringify(profile),
  }, passphrase);
}

function decryptProfile(buffer, passphrase, decryptVaultPayload) {
  const payload = decryptVaultPayload(buffer, passphrase);
  const profile = JSON.parse(payload.text || '{}');
  if (payload.kind !== 'account-profile' || profile.kind !== 'account-profile' || !profile.vaultId) {
    throw new Error('不是有效的 AxonMind 云端账号文件');
  }
  return profile;
}

module.exports = {
  PROFILE_VERSION,
  hashFeishuOpenId,
  accountFileName,
  createProfile,
  mergeDevice,
  mergeKnownDevices,
  encryptProfile,
  decryptProfile,
};
