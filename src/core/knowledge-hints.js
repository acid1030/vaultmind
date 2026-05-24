const OBSIDIAN_LOCAL_URL = 'https://127.0.0.1:27124';

function obsidianSetupHint() {
  return {
    source: 'VaultMind',
    type: 'setup',
    title: 'Obsidian 尚未配置',
    content: [
      '可选方案 A（本地）：安装 Obsidian → 安装社区插件「Local REST API」→ 启动 Obsidian 并保持库打开 →',
      `在配置中填写 Base URL：${OBSIDIAN_LOCAL_URL}，并填入插件生成的 API Token。`,
      '可选方案 B（远程）：在服务器/NAS 上运行 Obsidian + REST API（或通过 HTTPS 反向代理暴露），',
      '将可访问的 REST 地址与 Token 填入配置（勾选「允许自签名证书」仅在你信任该证书时使用）。',
      '若暂未配置 Obsidian，可优先使用「飞书知识库」：登录飞书后在配置中启用飞书 Wiki 检索。',
    ].join('\n'),
    score: null,
    isHint: true,
  };
}

function feishuWikiLoginHint() {
  return {
    source: 'VaultMind',
    type: 'setup',
    title: '飞书知识库未连接',
    content: '请先在顶栏登录飞书，并在「配置 → 飞书知识库」中启用 Wiki 检索。应用会使用你已可见的飞书知识库文档作为检索来源。',
    score: null,
    isHint: true,
  };
}

function feishuWikiScopeHint(errorMessage) {
  return {
    source: '飞书知识库',
    type: 'feishu_wiki',
    title: '飞书 Wiki 检索需要权限',
    content: `请在飞书开放平台为应用开通 wiki:wiki 或 wiki:wiki:readonly 权限后重新登录。详情：${errorMessage}`,
    score: null,
    isHint: true,
  };
}

module.exports = {
  OBSIDIAN_LOCAL_URL,
  obsidianSetupHint,
  feishuWikiLoginHint,
  feishuWikiScopeHint,
};
