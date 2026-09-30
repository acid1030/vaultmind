function describeLlmFailure(error) {
  const message = String(error && error.message ? error.message : error || '');

  if (/\b402\b|insufficient\s+(?:balance|credit)|余额不足|额度不足|quota/i.test(message)) {
    return '大模型账户余额或额度不足，已自动切换为知识库检索结果。请充值当前模型账户，或在“配置 → 大模型”中更换可用模型。';
  }
  if (/\b401\b|\b403\b|unauthorized|forbidden|invalid\s+(?:api\s*)?key|鉴权|无权/i.test(message)) {
    return '大模型鉴权失败，已自动切换为知识库检索结果。请检查“配置 → 大模型”中的 API Key 和模型权限。';
  }
  if (/timeout|timed out|超时|ECONNREFUSED|ENOTFOUND|network/i.test(message)) {
    return '大模型服务暂时无法连接，已自动切换为知识库检索结果。请稍后重试或检查模型地址。';
  }
  return '大模型服务暂时不可用，已自动切换为知识库检索结果。';
}

function buildEvidenceFallback(evidence, notice) {
  const items = Array.isArray(evidence) ? evidence : [];
  const resultCount = items.filter((item) => !item.isHint).length;
  return [
    '### 当前状态',
    '',
    notice,
    '',
    '### 检索摘要',
    '',
    resultCount > 0
      ? `找到 ${resultCount} 条相关资料。详细内容已整理为下方来源卡片，敏感凭据会自动隐藏。`
      : '没有找到可用于回答的匹配资料。请尝试更具体或更短的关键词。',
  ].join('\n');
}

module.exports = {
  describeLlmFailure,
  buildEvidenceFallback,
};
