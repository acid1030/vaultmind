const vectorSearch = require('./vector-search');

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
  content,
}) {
  const payload = [
    assetId,
    ownerUserId,
    scope || 'personal',
    groupId || '',
    kind || 'text',
    sourceTable || 'library_items',
    title || '',
    parseTags(tags),
    String(content || '').slice(0, 50000),
  ];
  try {
    db.run('DELETE FROM asset_search WHERE asset_id = ?', [assetId]);
    db.run(
      `INSERT INTO asset_search (asset_id, owner_user_id, scope, group_id, kind, source_table, title, tags, content)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      payload,
    );
  } catch {
    // fts unavailable
  }
  try {
    db.run('DELETE FROM asset_search_fallback WHERE asset_id = ?', [assetId]);
    db.run(
      `INSERT INTO asset_search_fallback (asset_id, owner_user_id, scope, group_id, kind, source_table, title, tags, content)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      payload,
    );
  } catch {
    // ignore
  }
}

function removeAssetIndex(db, assetId) {
  try {
    db.run('DELETE FROM asset_search WHERE asset_id = ?', [assetId]);
  } catch {
    // ignore
  }
  try {
    db.run('DELETE FROM asset_search_fallback WHERE asset_id = ?', [assetId]);
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

  // 从备用索引表 content 中 LIKE 匹配（兼容无 FTS5 的 sql.js）
  try {
    const asScope = scopeSql(context, userId, 'idx');
    const asMatch = matchClause('idx', ['title', 'tags', 'content']);
    const asRows = queryAll(
      `SELECT idx.asset_id, idx.title, idx.kind, idx.scope, idx.group_id, idx.source_table
       FROM asset_search_fallback idx
       WHERE ${asScope.clause} AND (${asMatch.sql})
       LIMIT 8`,
      [...asScope.params, ...asMatch.params],
    );
    for (const row of asRows) pushRow(row, row.source_table);
  } catch {
    // fallback content 搜索失败则忽略
  }

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
             OR (scope = 'group' AND group_id IN (${groupIds.map(() => '?').join(',')})
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
    // FTS5 不可用，使用普通表 LIKE 回退
    try {
      const terms = tokenizeQuery(context._rawQuery || '');
      return likeSearchFallback(db, queryAll, userId, context, terms.length ? terms : [context._rawQuery || '']);
    } catch {
      return [];
    }
  }
}

function likeSearchFallback(db, queryAll, userId, context, terms) {
  const patterns = terms.map((t) => `%${t}%`);
  const fullLike = `%${String(context._rawQuery || '').trim()}%`;
  const matchClause = (alias) => {
    const fields = ['title', 'tags', 'content'];
    if (!terms.length) {
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
  try {
    const m = matchClause('idx');
    if (context.scope === 'group' && context.groupId) {
      return queryAll(
        `SELECT asset_id, title, kind, scope, group_id, source_table
         FROM asset_search_fallback idx
         WHERE scope = 'group' AND group_id = ? AND (${m.sql})
         LIMIT 12`,
        [context.groupId, ...m.params],
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
           FROM asset_search_fallback idx
           WHERE scope = 'personal' AND owner_user_id = ? AND (${m.sql})
           LIMIT 12`,
          [userId, ...m.params],
        );
      }
      return queryAll(
        `SELECT asset_id, title, kind, scope, group_id, source_table
         FROM asset_search_fallback idx
         WHERE (${m.sql})
          AND (
            (scope = 'personal' AND owner_user_id = ?)
            OR (scope = 'group' AND group_id IN (${groupIds.map(() => '?').join(',')})))
         LIMIT 12`,
        [...m.params, userId, ...groupIds],
      );
    }
    return queryAll(
      `SELECT asset_id, title, kind, scope, group_id, source_table
       FROM asset_search_fallback idx
       WHERE scope = 'personal' AND owner_user_id = ? AND (${m.sql})
       LIMIT 12`,
      [userId, ...m.params],
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

function extractSnippet(content, terms, maxLength = 2000) {
  const text = String(content || '');
  if (!text) return '';
  if (!terms.length) return text.slice(0, maxLength);
  const lower = text.toLowerCase();
  let bestPos = -1;
  for (const term of terms) {
    const pos = lower.indexOf(term.toLowerCase());
    if (pos !== -1) {
      bestPos = pos;
      break;
    }
  }
  if (bestPos === -1) return text.slice(0, maxLength);
  const half = Math.floor(maxLength / 2);
  const start = Math.max(0, bestPos - half);
  const end = Math.min(text.length, start + maxLength);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = `…${snippet}`;
  if (end < text.length) snippet = `${snippet}…`;
  return snippet;
}

function rowsToEvidence(rows, question, terms = []) {
  return rows.map((row, index) => {
    const snippet = extractSnippet(row.content, terms, 2000);
    const metaParts = [
      `类型: ${row.kind || 'text'}`,
      `来源: ${row.source_table || 'library_items'}`,
      row.title ? `标题: ${row.title}` : '',
    ].filter(Boolean);
    const content = snippet
      ? `${metaParts.join(' · ')}\n内容片段：${snippet}`
      : [
        ...metaParts,
        `（与问题「${question.slice(0, 80)}」相关或最近条目）`,
      ].join(' · ');
    return {
      source: row.scope === 'group' ? '组内库' : '本地库',
      type: 'local',
      title: row.title || `条目 #${index + 1}`,
      content,
      score: 1 - index * 0.04,
      assetId: row.asset_id,
      sourceTable: row.source_table || 'library_items',
    };
  });
}

function attachContentFromIndex(db, queryAll, rows) {
  if (!rows.length) return rows;
  try {
    const ids = rows.map((r) => r.asset_id).filter(Boolean);
    if (!ids.length) return rows;
    const placeholders = ids.map(() => '?').join(',');
    const indexed = queryAll(
      `SELECT asset_id, content FROM asset_search_fallback WHERE asset_id IN (${placeholders})`,
      ids,
    );
    const map = new Map(indexed.map((r) => [r.asset_id, r.content]));
    return rows.map((row) => ({ ...row, content: row.content || map.get(row.asset_id) || '' }));
  } catch {
    return rows;
  }
}

async function searchLocalAssets(db, queryAll, userId, question, context, vectorOptions = {}) {
  const q = String(question || '').trim();
  if (!q) return [];
  const ctx = { ...context, _rawQuery: q };
  const terms = tokenizeQuery(q);
  const ftsQuery = buildFtsQuery(terms);

  const seen = new Set();
  const merged = [];

  const addRows = (rows, source = '') => {
    for (const row of rows) {
      const id = row.asset_id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push({ ...row, vectorScore: source === 'vector' ? row.score : undefined });
    }
  };

  addRows(ftsSearch(db, queryAll, userId, ctx, ftsQuery));
  if (merged.length < 5) {
    addRows(likeSearchTables(db, queryAll, userId, ctx, terms.length ? terms : [q]));
  }

  // 融合本地向量语义搜索
  if (vectorOptions.enabled) {
    try {
      const vectorRows = await vectorSearch.searchVectors(
        db, queryAll, userId, q, ctx, 5, vectorOptions.modelName,
      );
      addRows(vectorRows.map((r) => ({
        asset_id: r.asset_id,
        title: r.title,
        kind: r.kind,
        scope: r.scope,
        group_id: r.group_id,
        source_table: r.source_table || 'library_items',
        content: r.content,
        score: r.score,
      })), 'vector');
    } catch {
      // ignore vector search errors
    }
  }

  if (merged.length === 0) {
    addRows(listRecentAssets(db, queryAll, userId, ctx, 10));
  }

  // 向量命中的条目排到前面
  merged.sort((a, b) => {
    const vsA = a.vectorScore || 0;
    const vsB = b.vectorScore || 0;
    if (vsA && vsB) return vsB - vsA;
    if (vsA) return -1;
    if (vsB) return 1;
    return 0;
  });

  const withContent = attachContentFromIndex(db, queryAll, merged.slice(0, 12));
  return rowsToEvidence(withContent, q, terms.length ? terms : [q]);
}

function reindexAllForUser(db, queryAll, userId, decryptors = {}) {
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
    let content = '';
    if (decryptors.decryptLibraryItem) {
      try {
        const bytes = decryptors.decryptLibraryItem(row);
        const parsed = JSON.parse(bytes.toString('utf8'));
        content = parsed.content || '';
      } catch {
        // ignore
      }
    }
    indexAsset(db, {
      assetId: row.id,
      ownerUserId: row.user_id,
      scope: row.scope || 'personal',
      groupId: row.group_id || '',
      kind: row.kind,
      sourceTable: 'library_items',
      title: row.title,
      tags: row.tags,
      content,
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

function ensureSearchIndex(db, queryAll, userId, decryptors) {
  let needReindex = false;
  try {
    const count = queryAll('SELECT COUNT(*) AS c FROM asset_search_fallback WHERE owner_user_id = ?', [userId]);
    if (!count[0] || Number(count[0].c) === 0) needReindex = true;
  } catch {
    needReindex = true;
  }
  if (needReindex) {
    reindexAllForUser(db, queryAll, userId, decryptors || {});
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
