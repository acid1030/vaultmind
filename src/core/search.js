function parseTags(tagsValue) {
  if (!tagsValue) return '';
  if (Array.isArray(tagsValue)) return tagsValue.join(' ');
  try {
    const parsed = JSON.parse(tagsValue);
    return Array.isArray(parsed) ? parsed.join(' ') : String(tagsValue);
  } catch {
    return String(tagsValue);
  }
}

function indexAsset(db, {
  assetId,
  ownerUserId,
  scope,
  groupId,
  kind,
  sourceTable,
  title,
  tags,
}) {
  try {
    db.run('DELETE FROM asset_search WHERE asset_id = ?', [assetId]);
    db.run(
      `INSERT INTO asset_search (asset_id, owner_user_id, scope, group_id, kind, source_table, title, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        assetId,
        ownerUserId,
        scope || 'personal',
        groupId || '',
        kind || 'text',
        sourceTable || 'library_items',
        title || '',
        parseTags(tags),
      ],
    );
  } catch {
    // fts unavailable
  }
}

function removeAssetIndex(db, assetId) {
  try {
    db.run('DELETE FROM asset_search WHERE asset_id = ?', [assetId]);
  } catch {
    // ignore
  }
}

function searchLocalAssets(db, queryAll, userId, question, context) {
  const q = String(question || '').trim();
  if (!q) return [];
  const scope = context?.scope || 'personal';
  const groupId = context?.groupId || '';

  let ftsRows = [];
  try {
    const escaped = q.replace(/"/g, '""');
    if (scope === 'group' && groupId) {
      ftsRows = queryAll(
        `SELECT asset_id, title, kind, scope, group_id, source_table
         FROM asset_search
         WHERE asset_search MATCH ?
           AND scope = 'group' AND group_id = ?
         LIMIT 12`,
        [`"${escaped}"* OR ${escaped}`, groupId],
      );
    } else if (scope === 'all') {
      const groupIds = queryAll(
        `SELECT group_id FROM group_memberships WHERE user_id = ? AND status = 'active'`,
        [userId],
      ).map((r) => r.group_id);
      ftsRows = queryAll(
        `SELECT asset_id, title, kind, scope, group_id, source_table
         FROM asset_search
         WHERE asset_search MATCH ?
           AND (
             (scope = 'personal' AND owner_user_id = ?)
             ${groupIds.length ? `OR (scope = 'group' AND group_id IN (${groupIds.map(() => '?').join(',')}))` : ''}
           )
         LIMIT 12`,
        [`"${escaped}"* OR ${escaped}`, userId, ...groupIds],
      );
    } else {
      ftsRows = queryAll(
        `SELECT asset_id, title, kind, scope, group_id, source_table
         FROM asset_search
         WHERE asset_search MATCH ?
           AND scope = 'personal' AND owner_user_id = ?
         LIMIT 12`,
        [`"${escaped}"* OR ${escaped}`, userId],
      );
    }
  } catch {
    // fallback LIKE
    const like = `%${q}%`;
    if (scope === 'group' && groupId) {
      ftsRows = queryAll(
        `SELECT id AS asset_id, title, kind, scope, group_id, 'library_items' AS source_table
         FROM library_items WHERE group_id = ? AND title LIKE ? LIMIT 8`,
        [groupId, like],
      );
    } else {
      ftsRows = queryAll(
        `SELECT id AS asset_id, title, kind, scope, group_id, 'library_items' AS source_table
         FROM library_items WHERE user_id = ? AND (scope IS NULL OR scope = 'personal') AND title LIKE ? LIMIT 8`,
        [userId, like],
      );
    }
  }

  return ftsRows.map((row, index) => ({
    source: row.scope === 'group' ? `组内 · ${row.group_id?.slice(0, 8) || 'group'}` : '本地库',
    type: 'local',
    title: row.title || `条目 #${index + 1}`,
    content: `类型: ${row.kind || 'text'} · 表: ${row.source_table || 'library_items'} · 标题匹配`,
    score: 1 - index * 0.05,
    assetId: row.asset_id,
  }));
}

function reindexAllForUser(db, queryAll, userId) {
  const libs = queryAll('SELECT * FROM library_items WHERE user_id = ?', [userId]);
  for (const row of libs) {
    indexAsset(db, {
      assetId: row.id,
      ownerUserId: row.user_id,
      scope: row.scope || 'personal',
      groupId: row.group_id || '',
      kind: row.kind,
      sourceTable: 'library_items',
      title: row.title,
      tags: row.tags,
    });
  }
}

module.exports = {
  indexAsset,
  removeAssetIndex,
  searchLocalAssets,
  reindexAllForUser,
  parseTags,
};
