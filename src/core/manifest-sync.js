const crypto = require('crypto');

const MANIFEST_VERSION = 3;
const CONFLICT_STRATEGIES = new Set(['newest', 'local', 'cloud', 'manual']);

function timestamp(value) {
  const parsed = Date.parse(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildManifestEntries(db, queryAll, userId, scope, groupId, metadata = {}) {
  const library = scope === 'group' && groupId
    ? queryAll('SELECT * FROM library_items WHERE scope = ? AND group_id = ? ORDER BY created_at DESC', ['group', groupId])
    : queryAll(`SELECT * FROM library_items WHERE user_id = ? AND (scope IS NULL OR scope = 'personal') ORDER BY created_at DESC`, [userId]);
  const records = scope === 'group' && groupId
    ? queryAll('SELECT * FROM records WHERE scope = ? AND group_id = ? ORDER BY uploaded_at DESC', ['group', groupId])
    : queryAll(`SELECT * FROM records WHERE user_id = ? AND (scope IS NULL OR scope = 'personal') ORDER BY uploaded_at DESC`, [userId]);
  const tombstones = scope === 'group' && groupId
    ? queryAll('SELECT * FROM sync_tombstones WHERE scope = ? AND group_id = ? ORDER BY deleted_at DESC', ['group', groupId])
    : queryAll(`SELECT * FROM sync_tombstones WHERE user_id = ? AND (scope IS NULL OR scope = 'personal') ORDER BY deleted_at DESC`, [userId]);

  return {
    version: MANIFEST_VERSION,
    revision: crypto.randomUUID(),
    scope,
    groupId: groupId || null,
    userId,
    vaultId: metadata.vaultId || '',
    deviceId: metadata.deviceId || '',
    updatedAt: new Date().toISOString(),
    items: library.map((row) => ({
      id: row.id, kind: row.kind, title: row.title, url: row.url || '', size: row.size,
      tags: row.tags || '', createdAt: row.created_at, updatedAt: row.updated_at || row.created_at,
      source: 'library_items', remoteOnly: Boolean(row.remote_only),
    })),
    syncRecords: records.map((row) => ({
      id: row.id, fileName: row.file_name, kind: row.kind, size: row.size, token: row.token,
      url: row.url || '', uploadedAt: row.uploaded_at, assetId: row.asset_id || '',
    })),
    tombstones: tombstones.map((row) => ({
      id: row.id, assetId: row.asset_id, entityType: row.entity_type,
      deletedAt: row.deleted_at, deviceId: row.device_id || '',
    })),
  };
}

function encryptManifest(manifest, passphrase, encryptVaultPayload) {
  return encryptVaultPayload({
    kind: 'manifest',
    name: manifest.scope === 'group' ? `group-${manifest.groupId}-manifest` : 'personal-manifest',
    sourcePath: '',
    size: Buffer.byteLength(JSON.stringify(manifest), 'utf8'),
    text: JSON.stringify(manifest),
  }, passphrase);
}

function decryptManifest(buffer, passphrase, decryptVaultPayload) {
  const payload = decryptVaultPayload(buffer, passphrase);
  if (payload.kind !== 'manifest' && !payload.text) throw new Error('不是有效的 manifest 文件');
  return JSON.parse(payload.text || '{}');
}

function manifestFileName(scope, groupId, accountId) {
  if (scope === 'group' && groupId) return `vaultmind-group-${groupId}.axonvault`;
  return `vaultmind-vault-${accountId}.axonvault`;
}

function deviceManifestFileName(scope, groupId, accountId, deviceId) {
  const canonical = manifestFileName(scope, groupId, accountId).replace(/\.axonvault$/, '');
  const safeDeviceId = String(deviceId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'unknown';
  return `${canonical}-device-${safeDeviceId}.axonvault`;
}

function isManifestFileName(name, scope, groupId, accountId) {
  const canonical = manifestFileName(scope, groupId, accountId);
  const prefix = canonical.replace(/\.axonvault$/, '-device-');
  return name === canonical || (name.startsWith(prefix) && name.endsWith('.axonvault'));
}

function legacyManifestFileName(userId) {
  return `vaultmind-user-${userId}.axonvault`;
}

function comparableEntity(item, dateField) {
  if (dateField === 'updatedAt') {
    return JSON.stringify({ kind: item.kind, title: item.title, url: item.url || '', size: item.size || 0, tags: item.tags || '' });
  }
  return JSON.stringify({ fileName: item.fileName, kind: item.kind, size: item.size || 0, token: item.token || '', url: item.url || '', assetId: item.assetId || '' });
}

function normalizeConflictStrategy(strategy) {
  return CONFLICT_STRATEGIES.has(strategy) ? strategy : 'newest';
}

function mergeLatest(localValues, remoteValues, dateField, entityType, conflicts, options = {}) {
  const strategy = normalizeConflictStrategy(options.strategy);
  const remoteDeviceId = String(options.remoteDeviceId || '');
  const map = new Map((localValues || []).map((item) => [item.id, { ...item, _syncSource: item._syncSource || 'local' }]));
  for (const remoteItem of remoteValues || []) {
    const existing = map.get(remoteItem.id);
    if (!existing) {
      map.set(remoteItem.id, { ...remoteItem, _syncSource: 'remote' });
      continue;
    }
    const remoteTime = timestamp(remoteItem[dateField]);
    const localTime = timestamp(existing[dateField]);
    const localComparable = comparableEntity(existing, dateField);
    const remoteComparable = comparableEntity(remoteItem, dateField);
    if (localComparable === remoteComparable) {
      if (remoteTime > localTime) map.set(remoteItem.id, { ...existing, ...remoteItem, _syncSource: 'remote' });
      continue;
    }

    let chosen = 'local';
    let resolution = 'local-preserved';
    if (strategy === 'cloud') {
      chosen = 'remote';
      resolution = 'cloud-preferred';
    } else if (strategy === 'manual') {
      if (localTime > remoteTime) {
        resolution = 'manual-local-newer';
      } else {
        resolution = 'pending';
      }
    } else if (strategy === 'newest') {
      if (remoteTime > localTime || (remoteTime === localTime && remoteComparable > localComparable)) chosen = 'remote';
      resolution = chosen === 'remote' ? 'newest-remote' : 'newest-local';
    }
    if (chosen === 'remote') map.set(remoteItem.id, { ...existing, ...remoteItem, _syncSource: 'remote' });

    conflicts.push({
      id: `${entityType}:${remoteItem.id}:${existing[dateField] || 'unknown'}:${remoteItem[dateField] || 'unknown'}`,
      entityType,
      assetId: remoteItem.id,
      detectedAt: new Date().toISOString(),
      resolution,
      strategy,
      localChangedAt: existing[dateField] || '',
      remoteChangedAt: remoteItem[dateField] || '',
      remoteDeviceId,
      localValue: { ...existing, _syncSource: undefined },
      remoteValue: remoteItem,
    });
  }
  return [...map.values()];
}

function mergeTombstones(localValues, remoteValues) {
  const map = new Map();
  for (const stone of [...(localValues || []), ...(remoteValues || [])]) {
    const key = `${stone.entityType}:${stone.assetId}`;
    const existing = map.get(key);
    if (!existing || timestamp(stone.deletedAt) >= timestamp(existing.deletedAt)) map.set(key, stone);
  }
  return [...map.values()];
}

function mergeManifests(local, remote, options = {}) {
  if (!remote || !Array.isArray(remote.items)) return local;
  if (local.vaultId && remote.vaultId && local.vaultId !== remote.vaultId) {
    throw new Error('云端清单属于另一个 AxonMind 账号，已拒绝合并');
  }
  const detectedConflicts = [];
  const mergeOptions = { strategy: normalizeConflictStrategy(options.strategy), remoteDeviceId: remote.deviceId || '' };
  let items = mergeLatest(local.items, remote.items, 'updatedAt', 'item', detectedConflicts, mergeOptions);
  let syncRecords = mergeLatest(local.syncRecords, remote.syncRecords, 'uploadedAt', 'record', detectedConflicts, mergeOptions);
  let tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  const liveTimes = new Map([
    ...items.map((item) => [`item:${item.id}`, timestamp(item.updatedAt || item.createdAt)]),
    ...syncRecords.map((item) => [`record:${item.id}`, timestamp(item.uploadedAt)]),
  ]);
  tombstones = tombstones.filter((stone) => {
    const liveTime = liveTimes.get(`${stone.entityType}:${stone.assetId}`);
    return liveTime === undefined || timestamp(stone.deletedAt) >= liveTime;
  });
  const deleted = new Map(tombstones.map((stone) => [`${stone.entityType}:${stone.assetId}`, timestamp(stone.deletedAt)]));
  items = items.filter((item) => (deleted.get(`item:${item.id}`) || 0) < timestamp(item.updatedAt || item.createdAt));
  syncRecords = syncRecords.filter((item) => (deleted.get(`record:${item.id}`) || 0) < timestamp(item.uploadedAt));
  const conflictMap = new Map([...(local.conflicts || []), ...(remote.conflicts || []), ...detectedConflicts].map((item) => [item.id, item]));
  return {
    ...local,
    version: MANIFEST_VERSION,
    vaultId: local.vaultId || remote.vaultId || '',
    revision: crypto.randomUUID(),
    items,
    syncRecords,
    tombstones,
    conflicts: [...conflictMap.values()].slice(-100),
    newConflicts: detectedConflicts,
    updatedAt: new Date().toISOString(),
    mergedFrom: remote.updatedAt,
  };
}

function applyManifestToDatabase(db, queryOne, queryAll, saveDatabase, user, scope, groupId, manifest, deps) {
  const {
    indexAsset, removeAssetIndex = () => {}, removeVector = () => {}, encryptContent,
    requireSessionPassword, vaultId = '',
  } = deps;
  const password = requireSessionPassword();
  const now = new Date().toISOString();
  let addedItems = 0;
  let addedRecords = 0;
  let updatedItems = 0;
  let deletedItems = 0;
  let deletedRecords = 0;

  for (const stone of manifest.tombstones || []) {
    const entityType = stone.entityType === 'record' ? 'record' : 'item';
    const id = String(stone.assetId || '');
    if (!id) continue;
    const local = entityType === 'record'
      ? queryOne('SELECT uploaded_at AS changed_at FROM records WHERE id = ?', [id])
      : queryOne('SELECT COALESCE(updated_at, created_at) AS changed_at FROM library_items WHERE id = ?', [id]);
    if (local && timestamp(stone.deletedAt) >= timestamp(local.changed_at)) {
      if (entityType === 'record') {
        db.run('DELETE FROM records WHERE id = ?', [id]);
        db.run('DELETE FROM decrypted_items WHERE record_id = ?', [id]);
        deletedRecords += 1;
      } else {
        db.run('DELETE FROM library_items WHERE id = ?', [id]);
        db.run('DELETE FROM decrypted_items WHERE id = ?', [id]);
        deletedItems += 1;
      }
      removeAssetIndex(db, id);
      removeVector(db, id);
    }
    db.run(
      `INSERT OR REPLACE INTO sync_tombstones
       (id, user_id, vault_id, asset_id, entity_type, scope, group_id, deleted_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [stone.id || `${entityType}:${id}`, user.id, vaultId || manifest.vaultId || '', id, entityType,
        scope, scope === 'group' ? groupId : null, stone.deletedAt || now, stone.deviceId || ''],
    );
  }

  const deletedKeys = new Set((manifest.tombstones || []).map((stone) => `${stone.entityType}:${stone.assetId}`));
  const placeholderBody = JSON.stringify({ kind: 'text', title: '待下载', url: '', content: '' });
  const placeholderEnc = encryptContent(Buffer.from(placeholderBody, 'utf8'), scope, groupId || null, user, password);
  for (const item of manifest.items || []) {
    if (deletedKeys.has(`item:${item.id}`)) continue;
    const existing = queryOne('SELECT id, COALESCE(updated_at, created_at) AS changed_at, remote_only FROM library_items WHERE id = ?', [item.id]);
    if (existing) {
      const remoteSelected = item._syncSource === 'remote';
      db.run('UPDATE library_items SET title = ?, url = ?, tags = ?, updated_at = ?, remote_only = ? WHERE id = ?',
        [item.title, item.url || '', item.tags || '', item.updatedAt || now, remoteSelected ? 1 : Number(existing.remote_only || 0), item.id]);
      updatedItems += 1;
      indexAsset(db, { assetId: item.id, ownerUserId: user.id, scope, groupId: scope === 'group' ? groupId : '',
        kind: item.kind, sourceTable: 'library_items', title: item.title, tags: item.tags });
      continue;
    }
    db.run(
      `INSERT INTO library_items
       (id, user_id, kind, title, url, content_ciphertext, content_iv, content_tag, size, created_at, scope, group_id, created_by, tags, updated_at, remote_only)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.id, user.id, item.kind || 'text', item.title || '未命名', item.url || '', placeholderEnc.ciphertext,
        placeholderEnc.iv, placeholderEnc.tag, item.size || 0, item.createdAt || now, scope,
        scope === 'group' ? groupId : null, user.id, item.tags || '', item.updatedAt || now, 1],
    );
    addedItems += 1;
    indexAsset(db, { assetId: item.id, ownerUserId: user.id, scope, groupId: scope === 'group' ? groupId : '',
      kind: item.kind, sourceTable: 'library_items', title: item.title, tags: item.tags });
  }
  for (const rec of manifest.syncRecords || []) {
    if (deletedKeys.has(`record:${rec.id}`)) continue;
    const existing = queryOne('SELECT id FROM records WHERE id = ?', [rec.id]);
    if (existing) {
      db.run('UPDATE records SET file_name = ?, size = ?, token = ?, url = ?, uploaded_at = ?, kind = ?, asset_id = ? WHERE id = ?',
        [rec.fileName, rec.size, rec.token, rec.url || '', rec.uploadedAt, rec.kind, rec.assetId || '', rec.id]);
    } else {
      db.run(
        `INSERT INTO records
         (id, user_id, local_path, file_name, size, token, url, uploaded_at, algorithm, kind, scope, group_id, created_by, asset_id)
         VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [rec.id, user.id, rec.fileName, rec.size, rec.token, rec.url || '', rec.uploadedAt || now,
          'AES-256-GCM/PBKDF2-SHA256', rec.kind || 'file', scope, scope === 'group' ? groupId : null, user.id, rec.assetId || ''],
      );
      addedRecords += 1;
    }
    if (rec.assetId) {
      const stale = queryAll('SELECT id FROM records WHERE asset_id = ? AND id != ? AND uploaded_at <= ?', [rec.assetId, rec.id, rec.uploadedAt || now]);
      for (const row of stale) removeAssetIndex(db, row.id);
      db.run('DELETE FROM records WHERE asset_id = ? AND id != ? AND uploaded_at <= ?', [rec.assetId, rec.id, rec.uploadedAt || now]);
    }
  }
  saveDatabase();
  return { addedItems, addedRecords, updatedItems, deletedItems, deletedRecords };
}

module.exports = {
  MANIFEST_VERSION,
  buildManifestEntries,
  encryptManifest,
  decryptManifest,
  manifestFileName,
  deviceManifestFileName,
  isManifestFileName,
  legacyManifestFileName,
  normalizeConflictStrategy,
  mergeManifests,
  applyManifestToDatabase,
};
