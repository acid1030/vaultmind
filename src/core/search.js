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

function tokenizeQuery(question) {
  const raw = String(question || '').trim().toLowerCase();
  if (!raw) return [];
  const parts = new Set();
  for (const seg of raw.split(/[\s,，。；;、?？!！:：/\\|]+/)) {
    if (seg.length >= 2) parts.add(seg);
    if (seg.length >= 4) {
      for (let i = 0; i <= seg.length - 2; i += 1) {
        parts.add(seg.slice(i, i + 2));
      }
    }
  }
  for (const seg of raw.match(/[\u4e00-\u9fff]{2,}/g) || []) {
    parts.add(seg);
    if (seg.length > 4) {
      for (let i = 0; i <= seg.length - 2; i += 2) {
        parts.add(seg.slice(i, i + 2));
      }
    }
  }
  for (const seg of raw.match(/[a-z0-9_./-]{3,}/gi) || []) parts.add(seg);
  return [...parts].slice(0, 12);
}

function buildFtsQuery(terms) {
  if (!terms.length) return '';
  return terms
    .map((t) => `"${t.replace(/"/g, '""')}"*`)
    .join(' OR ');
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

function scopeSql(context, userId, alias = '') {
  const p = alias ? `${alias}.` : '';
  const scope = context?.scope || 'personal';
  const groupId = context?.groupId || '';
  if (scope === 'group' && groupId) {
    return {
      clause: `${p}scope = 'group' AND ${p}group_id = ?`,
      params: [groupId],
    };
  }
  if (scope === 'all') {
    return {
      clause: `(
        (${p}scope = 'personal' AND ${p}user_id = ?)
        OR (${p}scope = 'group' AND ${p}group_id IN (
          SELECT group_id FROM group_memberships WHERE user_id = ? AND status = 'active'
        ))
      )`,
      params: [userId, userId],
    };
  }
  return {
    clause: `${p}user_id = ? AND (${p}scope IS NULL OR ${p}scope = 'personal')`,
    params: [userId],
  };
}

function likeSearchTables(db, queryAll, userId, context, terms) {
  const rows = [];
  const seen = new Set();
  const patterns = terms.length ? terms.map((t) => `%${t}%`) : [];
  const fullLike = `%${String(context._rawQuery || '').trim()}%`;

  const pushRow = (row, sourceTable) => {
    const id = row.asset_id || row.id;
    if (!id || seen.has(id)) return;
    seen.add(id);
    rows.push({ ...row, asset_id: id, source_table: sourceTable });
  };

  const matchClause = (alias, fields) => {
    if (!patterns.length) {
      return { sql: `(${fields.map((f) => `${alias}.${f} LIKE ?`).join(' OR ')})`, params: [fullLike] };
    }
    const chunks = [];
    const params = [];
    for (const p of patterns) {
      chunks.push(`(${fields.map((f) => `${alias}.${f} LIKE ?`).join(' OR ')})`);
      for (let i = 0; i < fields.length; i += 1) params.push(p);
    }
    return { sql: chunks.join(' OR '), params };
  };

  const libScope = scopeSql(context, userId, 'li');
  const libMatch = matchClause('li', ['title', 'tags', 'url']);
  const libRows = queryAll(
    `SELECT li.id AS asset_id, li.title, li.kind, li.scope, li.group_id
     FROM library_items li
     WHERE ${libScope.clause} AND (${libMatch.sql})
     ORDER BY li.created_at DESC LIMIT 12`,
    [...libScope.params, ...libMatch.params],
  );
  for (const row of libRows) pushRow(row, 'library_items');

  const decScope = scopeSql(context, userId, 'di');
  const decMatch = matchClause('di', ['name', 'source_path', 'saved_path']);
  try {
    const decRows = queryAll(
      `SELECT di.id AS asset_id, di.name AS title, di.kind, di.scope, di.group_id
       FROM decrypted_items di
       WHERE ${decScope.clause} AND (${decMatch.sql})
       ORDER BY di.downloaded_at DESC LIMIT 8`,
      [...decScope.params, ...decMatch.params],
    );
    for (const row of decRows) pushRow(row, 'decrypted_items');
  } catch {
    // ignore
  }

  const recScope = scopeSql(context, userId, 'r');
  const recMatch = matchClause('r', ['file_name', 'local_path']);
  const recRows = queryAll(
    `SELECT r.id AS asset_id, r.file_name AS title, r.kind, r.scope, r.group_id
     FROM records r
     WHERE ${recScope.clause} AND (${recMatch.sql})
     ORDER BY r.uploaded_at DESC LIMIT 8`,
    [...recScope.params, ...recMatch.params],
  );
  for (const row of recRows) pushRow(row, 'records');

  return rows;
}

function ftsSearch(db, queryAll, userId, context, ftsQuery) {
  if (!ftsQuery) return [];
  try {
    if (context.scope === 'group' && context.groupId) {
      return queryAll(
        `SELECT asset_id, title, kind, scope, group_id, source_table
         FROM asset_search WHERE asset_search MATCH ? AND scope = 'group' AND group_id = ?
         LIMIT 12`,
        [ftsQuery, context.groupId],
      );
    }
    if (context.scope === 'all') {
      const groupIds = queryAll(
        'SELECT group_id FROM group_memberships WHERE user_id = ? AND status = ?',
        [userId, 'active'],
      ).map((r) => r.group_id);
      if (!groupIds.length) {
        return queryAll(
          `SELECT asset_id, title, kind, scope, group_id, source_table
           FROM asset_search WHERE asset_search MATCH ? AND scope = 'personal' AND owner_user_id = ?
           LIMIT 12`,
          [ftsQuery, userId],
        );
      }
      return queryAll(
        `SELECT asset_id, title, kind, scope, group_id, source_table
         FROM asset_search
         WHERE asset_search MATCH ?
           AND (
             (scope = 'personal' AND owner_user_id = ?)
             OR (scope = 'group' AND group_id IN (${groupIds.map(() => '?').join(',')}))
           )
         LIMIT 12`,
        [ftsQuery, userId, ...groupIds],
      );
    }
    return queryAll(
      `SELECT asset_id, title, kind, scope, group_id, source_table
       FROM asset_search WHERE asset_search MATCH ? AND scope = 'personal' AND owner_user_id = ?
       LIMIT 12`,
      [ftsQuery, userId],
    );
  } catch {
    return [];
  }
}

function listRecentAssets(db, queryAll, userId, context, limit = 8) {
  const rows = [];
  const libScope = scopeSql(context, userId, 'li');
  rows.push(...queryAll(
    `SELECT li.id AS asset_id, li.title, li.kind, li.scope, li.group_id, 'library_items' AS source_table
     FROM library_items li WHERE ${libScope.clause}
     ORDER BY li.created_at DESC LIMIT ?`,
    [...libScope.params, limit],
  ));
  return rows;
}

function rowsToEvidence(rows, question) {
  return rows.map((row, index) => ({
    source: row.scope === 'group' ? '组内库' : '本地库',
    type: 'local',
    title: row.title || `条目 #${index + 1}`,
    content: [
      `类型: ${row.kind || 'text'}`,
      `来源: ${row.source_table || 'library_items'}`,
      row.title ? `标题: ${row.title}` : '',
      `（与问题「${question.slice(0, 80)}」相关或最近条目）`,
    ].filter(Boolean).join(' · '),
    score: 1 - index * 0.04,
    assetId: row.asset_id,
    sourceTable: row.source_table || 'library_items',
  }));
}

function searchLocalAssets(db, queryAll, userId, question, context) {
  const q = String(question || '').trim();
  if (!q) return [];
  const ctx = { ...context, _rawQuery: q };
  const terms = tokenizeQuery(q);
  const ftsQuery = buildFtsQuery(terms);

  const seen = new Set();
  const merged = [];

  const addRows = (rows) => {
    for (const row of rows) {
      const id = row.asset_id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(row);
    }
  };

  addRows(ftsSearch(db, queryAll, userId, ctx, ftsQuery));
  if (merged.length < 5) {
    addRows(likeSearchTables(db, queryAll, userId, ctx, terms.length ? terms : [q]));
  }
  if (merged.length === 0) {
    addRows(listRecentAssets(db, queryAll, userId, ctx, 10));
  }

  return rowsToEvidence(merged.slice(0, 12), q);
}

function reindexAllForUser(db, queryAll, userId) {
  const personalLibs = queryAll(
    `SELECT * FROM library_items WHERE user_id = ? AND (scope IS NULL OR scope = 'personal')`,
    [userId],
  );
  const groupLibs = queryAll(
    `SELECT li.* FROM library_items li
     INNER JOIN group_memberships gm ON gm.group_id = li.group_id AND gm.user_id = ? AND gm.status = 'active'
     WHERE li.scope = 'group'`,
    [userId],
  );
  const decrypted = queryAll(
    `SELECT di.* FROM decrypted_items di
     WHERE di.user_id = ?
        OR (di.scope = 'group' AND di.group_id IN (
          SELECT group_id FROM group_memberships WHERE user_id = ? AND status = 'active'
        ))`,
    [userId, userId],
  );
  const records = queryAll(
    `SELECT r.* FROM records r
     WHERE r.user_id = ?
        OR (r.scope = 'group' AND r.group_id IN (
          SELECT group_id FROM group_memberships WHERE user_id = ? AND status = 'active'
        ))`,
    [userId, userId],
  );

  for (const row of [...personalLibs, ...groupLibs]) {
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
  for (const row of decrypted) {
    indexAsset(db, {
      assetId: row.id,
      ownerUserId: row.user_id,
      scope: row.scope || 'personal',
      groupId: row.group_id || '',
      kind: row.kind,
      sourceTable: 'decrypted_items',
      title: row.name,
      tags: row.source_path || '',
    });
  }
  for (const row of records) {
    indexAsset(db, {
      assetId: row.id,
      ownerUserId: row.user_id,
      scope: row.scope || 'personal',
      groupId: row.group_id || '',
      kind: row.kind,
      sourceTable: 'records',
      title: row.file_name,
      tags: row.local_path || '',
    });
  }
}

function ensureSearchIndex(db, queryAll, userId) {
  try {
    const count = queryAll('SELECT COUNT(*) AS c FROM asset_search WHERE owner_user_id = ?', [userId]);
    if (!count[0] || Number(count[0].c) === 0) {
      reindexAllForUser(db, queryAll, userId);
    }
  } catch {
    reindexAllForUser(db, queryAll, userId);
  }
}

module.exports = {
  indexAsset,
  removeAssetIndex,
  searchLocalAssets,
  reindexAllForUser,
  ensureSearchIndex,
  tokenizeQuery,
  parseTags,
};
