const path = require('path');
const os = require('os');

let pipelineInstance = null;
let modelLoadPromise = null;
let currentModel = '';

function modelCacheDir() {
  return path.join(os.homedir(), 'Library/Application Support/vaultmind/xenova-models');
}

async function getEmbedder(modelName = 'Xenova/all-MiniLM-L6-v2') {
  if (pipelineInstance && currentModel === modelName) return pipelineInstance;
  if (modelLoadPromise && currentModel === modelName) return modelLoadPromise;

  currentModel = modelName;
  modelLoadPromise = (async () => {
    try {
      const { pipeline, env } = require('@xenova/transformers');
      if (process.env.HF_ENDPOINT) {
        env.remoteHost = process.env.HF_ENDPOINT.endsWith('/')
          ? process.env.HF_ENDPOINT
          : `${process.env.HF_ENDPOINT}/`;
      }
      env.cacheDir = modelCacheDir();
      const embedder = await pipeline('feature-extraction', modelName, {
        cache_dir: modelCacheDir(),
        quantized: true,
      });
      pipelineInstance = embedder;
      return embedder;
    } catch (error) {
      console.error('加载本地 embedding 模型失败:', error.message || error);
      throw error;
    }
  })();

  return modelLoadPromise;
}

async function embedText(text, modelName) {
  const clean = String(text || '').trim();
  if (!clean) return [];
  const embedder = await getEmbedder(modelName);
  const result = await embedder(clean, { pooling: 'mean', normalize: true });
  const data = result.data;
  if (data && typeof data === 'object' && data.length !== undefined) {
    return Array.from(data);
  }
  if (Array.isArray(data)) return data;
  if (result && Array.isArray(result)) return result;
  return [];
}

function cosineSimilarity(a, b) {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function parseVector(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return [];
}

function scopeClause(context, alias = '') {
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
        (${p}scope = 'personal' AND ${p}owner_user_id = ?)
        OR (${p}scope = 'group' AND ${p}group_id IN (
          SELECT group_id FROM group_memberships WHERE user_id = ? AND status = 'active'
        ))
      )`,
      params: [context.userId, context.userId],
    };
  }
  return {
    clause: `${p}owner_user_id = ? AND (${p}scope IS NULL OR ${p}scope = 'personal')`,
    params: [context.userId],
  };
}

async function indexVector(db, {
  assetId,
  ownerUserId,
  scope,
  groupId,
  text,
  modelName,
}) {
  const clean = String(text || '').trim();
  if (!clean) return { skipped: true };
  try {
    const vector = await embedText(clean, modelName);
    if (!vector.length) return { skipped: true };
    db.run(
      `INSERT OR REPLACE INTO vector_embeddings
       (asset_id, owner_user_id, scope, group_id, vector_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        assetId,
        ownerUserId,
        scope || 'personal',
        groupId || '',
        JSON.stringify(vector),
        new Date().toISOString(),
      ],
    );
    return { ok: true, dimensions: vector.length };
  } catch (error) {
    console.error('索引向量失败:', error.message || error);
    return { error: String(error.message || error) };
  }
}

function removeVector(db, assetId) {
  try {
    db.run('DELETE FROM vector_embeddings WHERE asset_id = ?', [assetId]);
    return { ok: true };
  } catch (error) {
    return { error: String(error.message || error) };
  }
}

async function searchVectors(db, queryAll, userId, question, context, topK = 5, modelName) {
  try {
    const queryVector = await embedText(question, modelName);
    if (!queryVector.length) return [];

    const ctx = { ...context, userId };
    const sc = scopeClause(ctx, 'v');
    const rows = queryAll(
      `SELECT v.asset_id, v.owner_user_id, v.scope, v.group_id, v.vector_json,
              COALESCE(f.title, '') AS title,
              COALESCE(f.source_table, '') AS source_table,
              COALESCE(f.kind, '') AS kind,
              COALESCE(f.content, '') AS content
       FROM vector_embeddings v
       LEFT JOIN asset_search_fallback f ON f.asset_id = v.asset_id
       WHERE ${sc.clause}`,
      sc.params,
    );

    const scored = rows
      .map((row) => {
        const vector = parseVector(row.vector_json);
        if (!vector.length) return null;
        return {
          ...row,
          score: cosineSimilarity(queryVector, vector),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  } catch (error) {
    console.error('向量搜索失败:', error.message || error);
    return [];
  }
}

async function ensureModelDownloaded(modelName = 'Xenova/all-MiniLM-L6-v2') {
  try {
    await getEmbedder(modelName);
    return { ok: true, model: modelName };
  } catch (error) {
    return { error: String(error.message || error) };
  }
}

function resetEmbedder() {
  pipelineInstance = null;
  modelLoadPromise = null;
  currentModel = '';
}

module.exports = {
  embedText,
  indexVector,
  removeVector,
  searchVectors,
  ensureModelDownloaded,
  resetEmbedder,
};
