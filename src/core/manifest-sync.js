const crypto = require('crypto');

const MANIFEST_VERSION = 1;

function buildManifestEntries(db, queryAll, userId, scope, groupId) {
  const library = scope === 'group' && groupId
    ? queryAll('SELECT * FROM library_items WHERE scope = ? AND group_id = ? ORDER BY created_at DESC', ['group', groupId])
    : queryAll(
      `SELECT * FROM library_items WHERE user_id = ? AND (scope IS NULL OR scope = 'personal') ORDER BY created_at DESC`,
      [userId],
    );
  const records = scope === 'group' && groupId
    ? queryAll('SELECT * FROM records WHERE scope = ? AND group_id = ? ORDER BY uploaded_at DESC', ['group', groupId])
    : queryAll(
      `SELECT * FROM records WHERE user_id = ? AND (scope IS NULL OR scope = 'personal') ORDER BY uploaded_at DESC`,
      [userId],
    );

  return {
    version: MANIFEST_VERSION,
    scope,
    groupId: groupId || null,
    userId,
    updatedAt: new Date().toISOString(),
    items: library.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      url: row.url || '',
      size: row.size,
      tags: row.tags || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
      source: 'library_items',
      remoteOnly: Boolean(row.remote_only),
    })),
    syncRecords: records.map((row) => ({
      id: row.id,
      fileName: row.file_name,
      kind: row.kind,
      size: row.size,
      token: row.token,
      url: row.url || '',
      uploadedAt: row.uploaded_at,
      assetId: row.asset_id || '',
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
  if (payload.kind !== 'manifest' && !payload.text) {
    throw new Error('不是有效的 manifest 文件');
  }
  return JSON.parse(payload.text || '{}');
}

function manifestFileName(scope, groupId, userId) {
  if (scope === 'group' && groupId) {
    return `vaultmind-group-${groupId}.axonvault`;
  }
  return `vaultmind-user-${userId}.axonvault`;
}

function mergeManifests(local, remote) {
  if (!remote || !remote.items) return local;
  const itemMap = new Map((local.items || []).map((i) => [i.id, i]));
  for (const remoteItem of remote.items || []) {
    const existing = itemMap.get(remoteItem.id);
    if (!existing) {
      itemMap.set(remoteItem.id, remoteItem);
      continue;
    }
    const remoteTime = Date.parse(remoteItem.updatedAt || remoteItem.createdAt || 0);
    const localTime = Date.parse(existing.updatedAt || existing.createdAt || 0);
    if (remoteTime >= localTime) itemMap.set(remoteItem.id, { ...existing, ...remoteItem });
  }

  const recordMap = new Map((local.syncRecords || []).map((r) => [r.id, r]));
  for (const remoteRecord of remote.syncRecords || []) {
    const existing = recordMap.get(remoteRecord.id);
    if (!existing) {
      recordMap.set(remoteRecord.id, remoteRecord);
      continue;
    }
    const remoteTime = Date.parse(remoteRecord.uploadedAt || 0);
    const localTime = Date.parse(existing.uploadedAt || 0);
    if (remoteTime >= localTime) recordMap.set(remoteRecord.id, { ...existing, ...remoteRecord });
  }

  return {
    ...local,
    items: [...itemMap.values()],
    syncRecords: [...recordMap.values()],
    updatedAt: new Date().toISOString(),
    mergedFrom: remote.updatedAt,
  };
}

function applyManifestToDatabase(db, queryOne, queryAll, saveDatabase, user, scope, groupId, manifest, deps) {
  const { indexAsset, encryptContent, requireSessionPassword } = deps;
  const password = requireSessionPassword();
  const now = new Date().toISOString();
  let addedItems = 0;
  let addedRecords = 0;
  let updatedItems = 0;

  const placeholderBody = JSON.stringify({ kind: 'text', title: '待下载', url: '', content: '' });
  const placeholderEnc = encryptContent(Buffer.from(placeholderBody, 'utf8'), scope, groupId || null, user, password);

  for (const item of manifest.items || []) {
    const existing = queryOne('SELECT id FROM library_items WHERE id = ?', [item.id]);
    if (existing) {
      db.run(
        `UPDATE library_items SET title = ?, url = ?, tags = ?, updated_at = ?, remote_only = ?
         WHERE id = ?`,
        [item.title, item.url || '', item.tags || '', item.updatedAt || now, item.remoteOnly ? 1 : 0, item.id],
      );
      updatedItems += 1;
      indexAsset(db, {
        assetId: item.id,
        ownerUserId: user.id,
        scope,
        groupId: scope === 'group' ? groupId : '',
        kind: item.kind,
        sourceTable: 'library_items',
        title: item.title,
        tags: item.tags,
      });
      continue;
    }
    db.run(
      `INSERT INTO library_items
        (id, user_id, kind, title, url, content_ciphertext, content_iv, content_tag, size, created_at, scope, group_id, created_by, tags, updated_at, remote_only)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        user.id,
        item.kind || 'text',
        item.title || '未命名',
        item.url || '',
        placeholderEnc.ciphertext,
        placeholderEnc.iv,
        placeholderEnc.tag,
        item.size || 0,
        item.createdAt || now,
        scope,
        scope === 'group' ? groupId : null,
        user.id,
        item.tags || '',
        item.updatedAt || now,
        item.remoteOnly ? 1 : 1,
      ],
    );
    addedItems += 1;
    indexAsset(db, {
      assetId: item.id,
      ownerUserId: user.id,
      scope,
      groupId: scope === 'group' ? groupId : '',
      kind: item.kind,
      sourceTable: 'library_items',
      title: item.title,
      tags: item.tags,
    });
  }

  for (const rec of manifest.syncRecords || []) {
    const existing = queryOne('SELECT id FROM records WHERE id = ?', [rec.id]);
    if (existing) {
      db.run(
        `UPDATE records SET file_name = ?, size = ?, token = ?, url = ?, uploaded_at = ?, kind = ?, asset_id = ?
         WHERE id = ?`,
        [rec.fileName, rec.size, rec.token, rec.url || '', rec.uploadedAt, rec.kind, rec.assetId || '', rec.id],
      );
      continue;
    }
    db.run(
      `INSERT INTO records
        (id, user_id, local_path, file_name, size, token, url, uploaded_at, algorithm, kind, scope, group_id, created_by, asset_id)
       VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rec.id,
        user.id,
        rec.fileName,
        rec.size,
        rec.token,
        rec.url || '',
        rec.uploadedAt || now,
        'AES-256-GCM/PBKDF2-SHA256',
        rec.kind || 'file',
        scope,
        scope === 'group' ? groupId : null,
        user.id,
        rec.assetId || '',
      ],
    );
    addedRecords += 1;
  }

  saveDatabase();
  return { addedItems, addedRecords, updatedItems };
}

module.exports = {
  MANIFEST_VERSION,
  buildManifestEntries,
  encryptManifest,
  decryptManifest,
  manifestFileName,
  mergeManifests,
  applyManifestToDatabase,
};
