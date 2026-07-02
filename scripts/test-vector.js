#!/usr/bin/env node
const path = require('path');
const initSqlJs = require('sql.js');
const { migrateSchema } = require('../src/core/schema');
const vectorSearch = require('../src/core/vector-search');

async function main() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE library_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT,
      title TEXT,
      content_ciphertext TEXT,
      content_iv TEXT,
      content_tag TEXT,
      size INTEGER,
      created_at TEXT,
      scope TEXT DEFAULT 'personal',
      group_id TEXT,
      tags TEXT
    );
  `);
  migrateSchema(db);

  const queryAll = (sql, params = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  };

  const userId = 'user-1';
  db.run('INSERT INTO users VALUES (?)', [userId]);

  // Index a few assets with content
  const assets = [
    { id: 'a1', title: '公司年会策划', content: '我们计划在今年年底举办一场年会，地点选在上海中心大厦，主题是“未来已来”。' },
    { id: 'a2', title: '项目预算', content: '本季度研发预算主要投入 AI 搜索和向量数据库优化，预计费用五十万元。' },
    { id: 'a3', title: '旅游攻略', content: '去日本关西旅游，推荐京都清水寺、大阪环球影城，还有奈良的小鹿。' },
  ];

  console.log('正在生成向量索引（首次会下载模型）...');
  for (const asset of assets) {
    db.run(
      `INSERT INTO library_items (id, user_id, kind, title, content_ciphertext, content_iv, content_tag, size, created_at, scope, group_id, tags)
       VALUES (?, ?, 'text', ?, '', '', '', 0, ?, 'personal', '', '')`,
      [asset.id, userId, asset.title, new Date().toISOString()],
    );
    const result = await vectorSearch.indexVector(db, {
      assetId: asset.id,
      ownerUserId: userId,
      scope: 'personal',
      groupId: '',
      text: `${asset.title}\n${asset.content}`,
      modelName: 'Xenova/all-MiniLM-L6-v2',
    });
    console.log('索引结果:', asset.id, result);
  }

  console.log('正在执行语义搜索...');
  const results = await vectorSearch.searchVectors(
    db, queryAll, userId, '年底团队聚会在哪里举行？', { scope: 'personal', groupId: '' }, 3,
    'Xenova/all-MiniLM-L6-v2',
  );

  console.log(`命中 ${results.length} 条：`);
  for (const r of results) {
    console.log(`  - ${r.title} (score=${r.score.toFixed(3)})`);
  }

  if (!results.some((r) => r.asset_id === 'a1')) {
    throw new Error('语义搜索没有召回最相关的“公司年会策划”');
  }

  console.log('Vector search test passed.');
}

main().catch((error) => {
  console.error('VECTOR TEST FAILED:', error);
  process.exit(1);
});
