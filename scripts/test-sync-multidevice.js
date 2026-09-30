#!/usr/bin/env node
const assert = require('assert');
const manifestService = require('../src/core/manifest-sync');
const cloudAccount = require('../src/core/cloud-account');

const oldTime = '2026-08-30T08:00:00.000Z';
const newTime = '2026-08-31T08:00:00.000Z';
const base = {
  version: 3,
  scope: 'personal',
  groupId: null,
  vaultId: 'shared-vault',
  items: [],
  syncRecords: [],
  tombstones: [],
  updatedAt: oldTime,
};

const deviceA = {
  ...base,
  deviceId: 'device-a',
  items: [{ id: 'shared-item', title: 'A 创建', createdAt: oldTime, updatedAt: oldTime }],
};
const deviceB = {
  ...base,
  deviceId: 'device-b',
  items: [{ id: 'device-b-item', title: 'B 创建', createdAt: newTime, updatedAt: newTime }],
  updatedAt: newTime,
};
const firstMerge = manifestService.mergeManifests(deviceA, deviceB);
assert.deepEqual(firstMerge.items.map((item) => item.id).sort(), ['device-b-item', 'shared-item']);

const deviceAFile = manifestService.deviceManifestFileName('personal', '', 'shared-vault', 'device-a');
const deviceBFile = manifestService.deviceManifestFileName('personal', '', 'shared-vault', 'device-b');
assert.notEqual(deviceAFile, deviceBFile, '每台设备必须写入独立清单，避免并发覆盖');
assert.ok(manifestService.isManifestFileName(deviceAFile, 'personal', '', 'shared-vault'));
assert.ok(manifestService.isManifestFileName(deviceBFile, 'personal', '', 'shared-vault'));

const sameItemOnA = {
  ...deviceA,
  items: [{ id: 'shared-item', title: 'A 版本', createdAt: oldTime, updatedAt: oldTime }],
};
const sameItemOnB = {
  ...deviceB,
  items: [{ id: 'shared-item', title: 'B 较新版本', createdAt: oldTime, updatedAt: newTime }],
};
const newestMerge = manifestService.mergeManifests(sameItemOnA, sameItemOnB, { strategy: 'newest' });
assert.equal(newestMerge.items[0].title, 'B 较新版本');
assert.equal(newestMerge.newConflicts[0].resolution, 'newest-remote');

const localMerge = manifestService.mergeManifests(sameItemOnA, sameItemOnB, { strategy: 'local' });
assert.equal(localMerge.items[0].title, 'A 版本');
const cloudMerge = manifestService.mergeManifests(sameItemOnA, sameItemOnB, { strategy: 'cloud' });
assert.equal(cloudMerge.items[0].title, 'B 较新版本');
const manualMerge = manifestService.mergeManifests(sameItemOnA, sameItemOnB, { strategy: 'manual' });
assert.equal(manualMerge.items[0].title, 'A 版本');
assert.equal(manualMerge.newConflicts[0].resolution, 'pending');

const resolvedLocal = manifestService.mergeManifests({
  ...sameItemOnA,
  items: [{ ...sameItemOnA.items[0], updatedAt: '2026-09-01T08:00:00.000Z' }],
}, sameItemOnB, { strategy: 'manual' });
assert.equal(resolvedLocal.newConflicts[0].resolution, 'manual-local-newer', '手动采用本机后不应再次阻塞上传');

const deletedOnB = {
  ...deviceB,
  tombstones: [{ id: 'delete-shared', assetId: 'shared-item', entityType: 'item', deletedAt: newTime, deviceId: 'device-b' }],
};
const afterDelete = manifestService.mergeManifests(deviceA, deletedOnB);
assert.ok(!afterDelete.items.some((item) => item.id === 'shared-item'), 'B 删除后 A 不得恢复旧条目');
assert.equal(afterDelete.tombstones.length, 1);

const profileA = cloudAccount.createProfile({
  vaultId: 'shared-vault', email: 'owner@example.com', username: 'Owner',
  device: { id: 'device-a', name: 'Office Mac', platform: 'darwin-arm64' },
});
const profileAB = cloudAccount.mergeDevice(profileA, { id: 'device-b', name: 'Laptop', platform: 'win32-x64' });
assert.equal(profileAB.vaultId, 'shared-vault');
assert.deepEqual(profileAB.devices.map((device) => device.id).sort(), ['device-a', 'device-b']);
const recoveredProfile = cloudAccount.mergeKnownDevices(profileA, profileAB.devices);
assert.deepEqual(recoveredProfile.devices.map((device) => device.id).sort(), ['device-a', 'device-b']);

console.log('Multi-device sync tests passed.');
