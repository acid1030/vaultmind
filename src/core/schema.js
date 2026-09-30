function ensureColumn(db, table, column, type) {
  try {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch {
    // column already exists
  }
}

function migrateSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      feishu_folder_token TEXT,
      key_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS group_memberships (
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      PRIMARY KEY (group_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS group_member_keys (
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      key_version INTEGER NOT NULL,
      wrapped_key_ciphertext TEXT NOT NULL,
      wrapped_key_iv TEXT NOT NULL,
      wrapped_key_tag TEXT NOT NULL,
      PRIMARY KEY (group_id, user_id, key_version)
    );
    CREATE TABLE IF NOT EXISTS group_invites (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      invitee_email TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sealed_ciphertext TEXT,
      sealed_iv TEXT,
      sealed_tag TEXT
    );
  `);
  ensureColumn(db, 'group_invites', 'sealed_ciphertext', 'TEXT');
  ensureColumn(db, 'group_invites', 'sealed_iv', 'TEXT');
  ensureColumn(db, 'group_invites', 'sealed_tag', 'TEXT');

  const scopedTables = [
    'library_items',
    'decrypted_items',
    'records',
    'project_accounts',
    'project_repositories',
  ];
  for (const table of scopedTables) {
    ensureColumn(db, table, 'scope', "TEXT NOT NULL DEFAULT 'personal'");
    ensureColumn(db, table, 'group_id', 'TEXT');
    ensureColumn(db, table, 'created_by', 'TEXT');
    ensureColumn(db, table, 'tags', 'TEXT');
  }
  ensureColumn(db, 'library_items', 'updated_at', 'TEXT');
  ensureColumn(db, 'library_items', 'remote_only', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'records', 'asset_id', 'TEXT');
  ensureColumn(db, 'users', 'vault_id', 'TEXT');
  ensureColumn(db, 'users', 'cloud_linked', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'users', 'feishu_open_id_hash', 'TEXT');

  db.run(`
    CREATE TABLE IF NOT EXISTS vault_devices (
      vault_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      PRIMARY KEY (vault_id, device_id)
    );
    CREATE TABLE IF NOT EXISTS sync_tombstones (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      vault_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'personal',
      group_id TEXT,
      deleted_at TEXT NOT NULL,
      device_id TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      vault_id TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'personal',
      group_id TEXT,
      entity_type TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      strategy TEXT NOT NULL,
      resolution TEXT NOT NULL,
      local_changed_at TEXT,
      remote_changed_at TEXT,
      remote_device_id TEXT,
      local_value TEXT NOT NULL,
      remote_value TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      resolved_at TEXT
    );
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_tombstones_vault ON sync_tombstones(vault_id, scope, group_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sync_conflicts_vault ON sync_conflicts(vault_id, scope, group_id, detected_at)');

  try {
    db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS asset_search USING fts5(
        asset_id UNINDEXED,
        owner_user_id UNINDEXED,
        scope UNINDEXED,
        group_id UNINDEXED,
        kind UNINDEXED,
        source_table UNINDEXED,
        title,
        tags,
        content,
        tokenize='unicode61'
      );
    `);
  } catch {
    // fts5 may not be available in this sql.js build
  }

  // 备用：普通表索引，兼容没有 FTS5 的 sql.js 版本
  db.run(`
    CREATE TABLE IF NOT EXISTS asset_search_fallback (
      asset_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'personal',
      group_id TEXT NOT NULL DEFAULT '',
      kind TEXT,
      source_table TEXT,
      title TEXT,
      tags TEXT,
      content TEXT
    );
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_asset_search_owner ON asset_search_fallback(owner_user_id)');

  // 本地向量索引表
  db.run(`
    CREATE TABLE IF NOT EXISTS vector_embeddings (
      asset_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'personal',
      group_id TEXT NOT NULL DEFAULT '',
      vector_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_vector_owner ON vector_embeddings(owner_user_id)');
}

module.exports = { migrateSchema, ensureColumn };
