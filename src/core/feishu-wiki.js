function truncateQuery(query, maxLen = 50) {
  const q = String(query || '').trim();
  if (q.length <= maxLen) return q;
  return q.slice(0, maxLen);
}

function mapWikiItems(items) {
  return (items || []).slice(0, 8).map((item, index) => ({
    source: '飞书知识库',
    type: 'feishu_wiki',
    title: String(item.title || `Wiki #${index + 1}`),
    content: [
      item.url ? `链接: ${item.url}` : '',
      item.obj_type != null ? `类型: ${item.obj_type}` : '',
      item.space_id ? `空间: ${item.space_id}` : '',
      item.node_id ? `节点: ${item.node_id}` : '',
    ].filter(Boolean).join(' · ') || '飞书 Wiki 命中',
    score: 1 - index * 0.05,
    url: item.url || '',
    nodeId: item.node_id || '',
  }));
}

function parseSearchResponse(payload) {
  const data = payload.data || payload;
  const items = Array.isArray(data.items) ? data.items : [];
  return mapWikiItems(items);
}

module.exports = {
  truncateQuery,
  mapWikiItems,
  parseSearchResponse,
};
