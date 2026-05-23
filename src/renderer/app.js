function createUnavailableApi() {
  const message = '当前页面不是在 Electron 桌面端中运行。请在项目目录执行 npm start 打开应用。';
  const fail = () => Promise.reject(new Error(message));
  return {
    getState: () => Promise.resolve({
      auth: { hasUsers: false, isLoggedIn: false, user: null },
      settings: {},
      isFeishuLoggedIn: false,
      records: [],
      items: [],
      knowledgeCenter: { aiProfile: {}, knowledgeSources: [], vectorSources: [], obsidianSources: [], queryLogs: [] },
      redirectUri: 'http://127.0.0.1:37891/feishu/oauth/callback',
      requiredScopes: '',
    }),
    register: fail,
    loginLocal: fail,
    logoutLocal: fail,
    updateRecovery: fail,
    resetPassword: fail,
    saveSettings: fail,
    login: fail,
    logout: fail,
    chooseFiles: fail,
    chooseDirectory: fail,
    uploadFiles: fail,
    uploadText: fail,
    downloadRecord: fail,
    unlockItem: fail,
    saveItemFile: fail,
    forgetRecord: fail,
    forgetItem: fail,
    createLibraryItem: fail,
    saveAiProfile: fail,
    saveKnowledgeSources: fail,
    saveVectorSources: fail,
    queryKnowledgeCenter: fail,
    saveProjectAccount: fail,
    saveProjectRepository: fail,
    deleteProjectRepository: fail,
    runProjectAction: fail,
    openExternal: fail,
    showDatabase: fail,
  };
}

const api = window.vaultApi || createUnavailableApi();

const elements = {
  loginView: document.querySelector('#loginView'),
  mainView: document.querySelector('#mainView'),
  showLogin: document.querySelector('#showLogin'),
  showRegister: document.querySelector('#showRegister'),
  localEmail: document.querySelector('#localEmail'),
  localUsername: document.querySelector('#localUsername'),
  recoveryEmail: document.querySelector('#recoveryEmail'),
  localPassword: document.querySelector('#localPassword'),
  usernameWrap: document.querySelector('#usernameWrap'),
  verifyWrap: document.querySelector('#verifyWrap'),
  sendVerifyCode: document.querySelector('#sendVerifyCode'),
  localSubmit: document.querySelector('#localSubmit'),
  resetEmail: document.querySelector('#resetEmail'),
  resetCode: document.querySelector('#resetCode'),
  resetPassword: document.querySelector('#resetPassword'),
  resetSubmit: document.querySelector('#resetSubmit'),
  loginHint: document.querySelector('#loginHint'),
  localBadge: document.querySelector('#localBadge'),
  navLibrary: document.querySelector('#navLibrary'),
  navProjects: document.querySelector('#navProjects'),
  navAdd: document.querySelector('#navAdd'),
  navConfig: document.querySelector('#navConfig'),
  libraryView: document.querySelector('#libraryView'),
  projectsView: document.querySelector('#projectsView'),
  addView: document.querySelector('#addView'),
  configView: document.querySelector('#configView'),
  projectProviderGithub: document.querySelector('#projectProviderGithub'),
  projectProviderGitlab: document.querySelector('#projectProviderGitlab'),
  projectProviderGit: document.querySelector('#projectProviderGit'),
  projectProviderSvn: document.querySelector('#projectProviderSvn'),
  projectAccountLabel: document.querySelector('#projectAccountLabel'),
  projectAccountUsername: document.querySelector('#projectAccountUsername'),
  projectAccountSecret: document.querySelector('#projectAccountSecret'),
  saveProjectAccount: document.querySelector('#saveProjectAccount'),
  projectAccounts: document.querySelector('#projectAccounts'),
  projectTool: document.querySelector('#projectTool'),
  projectAccountSelect: document.querySelector('#projectAccountSelect'),
  projectName: document.querySelector('#projectName'),
  projectRemoteUrl: document.querySelector('#projectRemoteUrl'),
  projectLocalPath: document.querySelector('#projectLocalPath'),
  projectMigrationDir: document.querySelector('#projectMigrationDir'),
  chooseProjectDir: document.querySelector('#chooseProjectDir'),
  saveProjectRepo: document.querySelector('#saveProjectRepo'),
  projectRepos: document.querySelector('#projectRepos'),
  projectOutput: document.querySelector('#projectOutput'),
  projectCommitMessage: document.querySelector('#projectCommitMessage'),
  showConfigForm: document.querySelector('#showConfigForm'),
  configList: document.querySelector('#configList'),
  configForm: document.querySelector('#configForm'),
  configType: document.querySelector('#configType'),
  dynamicConfigFields: document.querySelector('#dynamicConfigFields'),
  saveConfigDynamic: document.querySelector('#saveConfigDynamic'),
  cancelConfigForm: document.querySelector('#cancelConfigForm'),
  profilePhone: document.querySelector('#profilePhone'),
  profileRecoveryEmail: document.querySelector('#profileRecoveryEmail'),
  saveRecovery: document.querySelector('#saveRecovery'),
  llmBaseUrl: document.querySelector('#llmBaseUrl'),
  llmApiKey: document.querySelector('#llmApiKey'),
  llmModel: document.querySelector('#llmModel'),
  llmTemperature: document.querySelector('#llmTemperature'),
  saveAiProfile: document.querySelector('#saveAiProfile'),
  kbName: document.querySelector('#kbName'),
  kbEndpoint: document.querySelector('#kbEndpoint'),
  kbApiKey: document.querySelector('#kbApiKey'),
  addKbSource: document.querySelector('#addKbSource'),
  kbSources: document.querySelector('#kbSources'),
  vectorName: document.querySelector('#vectorName'),
  vectorEndpoint: document.querySelector('#vectorEndpoint'),
  vectorCollection: document.querySelector('#vectorCollection'),
  vectorApiKey: document.querySelector('#vectorApiKey'),
  addVectorSource: document.querySelector('#addVectorSource'),
  vectorSources: document.querySelector('#vectorSources'),
  obsidianName: document.querySelector('#obsidianName'),
  obsidianBaseUrl: document.querySelector('#obsidianBaseUrl'),
  obsidianApiKey: document.querySelector('#obsidianApiKey'),
  obsidianInsecureTls: document.querySelector('#obsidianInsecureTls'),
  addObsidianSource: document.querySelector('#addObsidianSource'),
  obsidianSources: document.querySelector('#obsidianSources'),
  questionInput: document.querySelector('#questionInput'),
  runKnowledgeQuery: document.querySelector('#runKnowledgeQuery'),
  queryResult: document.querySelector('#queryResult'),
  appId: document.querySelector('#appId'),
  appSecret: document.querySelector('#appSecret'),
  folderToken: document.querySelector('#folderToken'),
  redirectUri: document.querySelector('#redirectUri'),
  scopes: document.querySelector('#scopes'),
  loginBadge: document.querySelector('#loginBadge'),
  notice: document.querySelector('#notice'),
  selectedFiles: document.querySelector('#selectedFiles'),
  passphrase: document.querySelector('#passphrase'),
  records: document.querySelector('#records'),
  items: document.querySelector('#items'),
  saveSettings: document.querySelector('#saveSettings'),
  login: document.querySelector('#login'),
  logout: document.querySelector('#logout'),
  chooseFiles: document.querySelector('#chooseFiles'),
  upload: document.querySelector('#upload'),
  showDatabase: document.querySelector('#showDatabase'),
  fileMode: document.querySelector('#fileMode'),
  textMode: document.querySelector('#textMode'),
  webMode: document.querySelector('#webMode'),
  videoMode: document.querySelector('#videoMode'),
  manualTitle: document.querySelector('#manualTitle'),
  manualUrl: document.querySelector('#manualUrl'),
  manualUrlWrap: document.querySelector('#manualUrlWrap'),
  manualText: document.querySelector('#manualText'),
  manualTextWrap: document.querySelector('#manualTextWrap'),
  saveManualContent: document.querySelector('#saveManualContent'),
  vaultFileMode: document.querySelector('#vaultFileMode'),
  vaultTextMode: document.querySelector('#vaultTextMode'),
  fileUploadBox: document.querySelector('#fileUploadBox'),
  textUploadBox: document.querySelector('#textUploadBox'),
  secretName: document.querySelector('#secretName'),
  secretText: document.querySelector('#secretText'),
  unlockPassword: document.querySelector('#unlockPassword'),
};

let state = null;
let selectedFiles = [];
let authMode = 'login';
let uploadMode = 'file';
let vaultUploadMode = 'file';
let activeView = 'library';
let configFormVisible = false;
let projectProvider = 'github';
let kbSourcesDraft = [];
let vectorSourcesDraft = [];
let obsidianSourcesDraft = [];
let pendingVerifyCode = '';

function showNotice(message, isError = false) {
  elements.notice.textContent = message;
  elements.notice.className = isError ? 'notice error' : 'notice';
}

function clearNotice() {
  elements.notice.className = 'notice hidden';
  elements.notice.textContent = '';
  elements.loginHint.textContent = '';
}

function setLoginHint(message, isError = false) {
  elements.loginHint.textContent = message;
  elements.loginHint.className = isError ? 'hint errorText' : 'hint';
}

function fileNameFromPath(filePath) {
  return filePath.split(/[\\/]/).pop() || filePath;
}

function formatBytes(size) {
  if (!Number.isFinite(size)) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function cryptoRandomId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setBusy(isBusy) {
  for (const button of document.querySelectorAll('button')) {
    button.disabled = isBusy;
  }
}

async function run(action, successMessage, loginArea = false) {
  setBusy(true);
  clearNotice();
  try {
    const result = await action();
    if (successMessage) {
      if (loginArea) setLoginHint(successMessage);
      else showNotice(successMessage);
    }
    return result;
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    if (loginArea) setLoginHint(message, true);
    else showNotice(message, true);
    return null;
  } finally {
    setBusy(false);
  }
}

function renderAuthMode() {
  const isRegister = authMode === 'register';
  elements.showLogin.classList.toggle('active', !isRegister);
  elements.showRegister.classList.toggle('active', isRegister);
  elements.usernameWrap.classList.toggle('hidden', !isRegister);
  elements.verifyWrap.classList.toggle('hidden', !isRegister);
  elements.localSubmit.textContent = isRegister ? '注册并登录' : '登录';
}

function renderUploadMode() {
  elements.fileMode.classList.toggle('active', uploadMode === 'file');
  elements.textMode.classList.toggle('active', uploadMode === 'text');
  elements.webMode.classList.toggle('active', uploadMode === 'web');
  elements.videoMode.classList.toggle('active', uploadMode === 'video');
  elements.manualUrlWrap.classList.toggle('hidden', !['web', 'video'].includes(uploadMode));
  elements.manualTextWrap.classList.toggle('hidden', ['web', 'video'].includes(uploadMode));

  const isVaultText = vaultUploadMode === 'text';
  elements.vaultFileMode.classList.toggle('active', !isVaultText);
  elements.vaultTextMode.classList.toggle('active', isVaultText);
  elements.fileUploadBox.classList.toggle('hidden', isVaultText);
  elements.textUploadBox.classList.toggle('hidden', !isVaultText);
}

function renderActiveView() {
  elements.navLibrary.classList.toggle('active', activeView === 'library');
  elements.navProjects.classList.toggle('active', activeView === 'projects');
  elements.navAdd.classList.toggle('active', activeView === 'add');
  elements.navConfig.classList.toggle('active', activeView === 'config');
  elements.libraryView.classList.toggle('hidden', activeView !== 'library');
  elements.projectsView.classList.toggle('hidden', activeView !== 'projects');
  elements.addView.classList.toggle('hidden', activeView !== 'add');
  elements.configView.classList.toggle('hidden', activeView !== 'config');
}

function render() {
  if (!state) return;
  const loggedIn = Boolean(state.auth && state.auth.isLoggedIn);
  elements.loginView.classList.toggle('hidden', loggedIn);
  elements.mainView.classList.toggle('hidden', !loggedIn);
  renderAuthMode();
  renderUploadMode();
  renderActiveView();

  if (!loggedIn) {
    setLoginHint(state.auth && state.auth.hasUsers ? '请输入邮箱和本地密码登录。' : '还没有本地账号，请注册第一个账号。');
    if (!state.auth.hasUsers) authMode = 'register';
    renderAuthMode();
    return;
  }

  elements.localBadge.textContent = `本地：${state.auth.user.username} <${state.auth.user.email}>`;
  elements.profilePhone.value = state.auth.user.phone || '';
  elements.profileRecoveryEmail.value = state.auth.user.recoveryEmail || '';
  const aiProfile = state.knowledgeCenter?.aiProfile || {};
  elements.llmBaseUrl.value = aiProfile.baseUrl || '';
  elements.llmApiKey.value = aiProfile.apiKey || '';
  elements.llmModel.value = aiProfile.model || '';
  elements.llmTemperature.value = String(aiProfile.temperature ?? 0.2);
  kbSourcesDraft = state.knowledgeCenter?.knowledgeSources ? [...state.knowledgeCenter.knowledgeSources] : [];
  vectorSourcesDraft = state.knowledgeCenter?.vectorSources ? [...state.knowledgeCenter.vectorSources] : [];
  obsidianSourcesDraft = state.knowledgeCenter?.obsidianSources ? [...state.knowledgeCenter.obsidianSources] : [];
  elements.appId.value = state.settings.appId || '';
  elements.appSecret.value = state.settings.appSecret || '';
  elements.folderToken.value = state.settings.folderToken || 'root';
  elements.redirectUri.value = state.redirectUri || '';
  elements.scopes.textContent = state.requiredScopes || '';

  elements.loginBadge.textContent = state.isFeishuLoggedIn
    ? (state.feishuUser && state.feishuUser.name ? `飞书：${state.feishuUser.name}` : '已登录飞书')
    : '未登录飞书';
  elements.loginBadge.className = state.isFeishuLoggedIn ? 'badge' : 'badge warn';
  elements.logout.style.display = state.isFeishuLoggedIn ? '' : 'none';

  elements.selectedFiles.innerHTML = selectedFiles.length
    ? selectedFiles.map((file) => `<div>${escapeHtml(fileNameFromPath(file))}</div>`).join('')
    : '尚未选择文件';

  renderRecords();
  renderItems();
  renderSources();
  renderConfigCenter();
  renderProjects();
  renderLastQuery();
}

function renderProjects() {
  const accounts = state.projects?.accounts || [];
  const repos = state.projects?.repositories || [];
  elements.projectAccounts.innerHTML = accounts.length
    ? accounts.map((account) => `
      <div class="sourceItem">
        <div><strong>${escapeHtml(account.label)}</strong><span>${escapeHtml(account.provider)} · ${escapeHtml(account.username || 'token')}</span></div>
      </div>
    `).join('')
    : '<div class="muted">尚未配置项目账号</div>';
  elements.projectAccountSelect.innerHTML = '<option value="">无账号</option>' + accounts.map((account) => (
    `<option value="${account.id}">${escapeHtml(account.label)} (${escapeHtml(account.provider)})</option>`
  )).join('');
  elements.projectRepos.innerHTML = repos.length
    ? repos.map((repo) => `
      <article class="projectRepo">
        <div>
          <strong>${escapeHtml(repo.name)}</strong>
          <p>${escapeHtml(repo.tool)} · ${escapeHtml(repo.localPath)}</p>
          <p>${escapeHtml(repo.remoteUrl)}</p>
          ${repo.migrationDir ? `<p>迁移目录：${escapeHtml(repo.migrationDir)}</p>` : ''}
        </div>
        <div class="actions">
          <button data-project-action="clone" data-id="${repo.id}">克隆/检出</button>
          <button data-project-action="status" data-id="${repo.id}">状态</button>
          <button data-project-action="log" data-id="${repo.id}">版本</button>
          <button data-project-action="update" data-id="${repo.id}">更新</button>
          <button data-project-action="commit" data-id="${repo.id}">提交</button>
          <button data-project-action="push" data-id="${repo.id}">推送</button>
          <button data-project-action="delete" data-id="${repo.id}">删除</button>
        </div>
      </article>
    `).join('')
    : '<div class="empty">还没有项目配置。</div>';
}

function configCards() {
  const cards = [];
  cards.push({
    type: 'feishu',
    title: '飞书同步',
    status: state.isFeishuLoggedIn ? '已登录' : (state.settings?.appId ? '已配置，未登录' : '未配置'),
    meta: state.settings?.folderToken ? `Folder: ${state.settings.folderToken}` : '同步到飞书云空间',
  });
  const ai = state.knowledgeCenter?.aiProfile || {};
  cards.push({
    type: 'llm',
    title: '大模型',
    status: ai.model ? '已配置' : '未配置',
    meta: ai.model || 'OpenAI-compatible endpoint',
  });
  for (const item of kbSourcesDraft) cards.push({ type: 'knowledge', title: item.name, status: item.enabled ? '启用' : '停用', meta: item.endpoint, id: item.id });
  for (const item of vectorSourcesDraft) cards.push({ type: 'vector', title: item.name, status: item.enabled ? '启用' : '停用', meta: item.collection || item.endpoint, id: item.id });
  for (const item of obsidianSourcesDraft) cards.push({ type: 'obsidian', title: item.name, status: item.enabled ? '启用' : '停用', meta: item.baseUrl, id: item.id });
  cards.push({
    type: 'recovery',
    title: '账户恢复',
    status: (state.auth?.user?.phone || state.auth?.user?.recoveryEmail) ? '已配置' : '未配置',
    meta: state.auth?.user?.recoveryEmail || state.auth?.user?.phone || '手机或邮箱找回',
  });
  return cards;
}

function renderConfigCenter() {
  elements.configList.innerHTML = configCards().map((card) => `
    <div class="configCard">
      <div>
        <span class="configType">${escapeHtml(typeLabel(card.type))}</span>
        <strong>${escapeHtml(card.title)}</strong>
        <p>${escapeHtml(card.meta || '')}</p>
      </div>
      <button class="configStatus" data-config-type="${escapeHtml(card.type)}">${escapeHtml(card.status)}</button>
    </div>
  `).join('');
  elements.configForm.classList.toggle('hidden', !configFormVisible);
  renderDynamicConfigFields();
}

function openConfigForm(type) {
  configFormVisible = true;
  elements.configType.value = type;
  renderConfigCenter();
}

function typeLabel(type) {
  return {
    feishu: '飞书',
    llm: '模型',
    knowledge: '知识库',
    vector: '向量库',
    obsidian: 'Obsidian',
    recovery: '账户',
  }[type] || type;
}

function renderDynamicConfigFields() {
  if (!elements.dynamicConfigFields) return;
  const type = elements.configType.value;
  const ai = state?.knowledgeCenter?.aiProfile || {};
  const templates = {
    feishu: `
      <label>App ID<input data-field="appId" value="${escapeHtml(state?.settings?.appId || '')}" placeholder="cli_xxx" /></label>
      <label>App Secret<input data-field="appSecret" type="password" value="${escapeHtml(state?.settings?.appSecret || '')}" placeholder="只保存在本机 SQLite" /></label>
      <label>飞书文件夹 Token<input data-field="folderToken" value="${escapeHtml(state?.settings?.folderToken || 'root')}" placeholder="root 或 fldcn..." /></label>
    `,
    llm: `
      <label>Base URL<input data-field="baseUrl" value="${escapeHtml(ai.baseUrl || '')}" placeholder="https://api.openai.com/v1" /></label>
      <label>API Key<input data-field="apiKey" type="password" value="${escapeHtml(ai.apiKey || '')}" placeholder="sk-..." /></label>
      <label>模型<input data-field="model" value="${escapeHtml(ai.model || '')}" placeholder="gpt-4.1-mini / qwen-plus" /></label>
      <label>Temperature<input data-field="temperature" value="${escapeHtml(ai.temperature ?? 0.2)}" /></label>
    `,
    knowledge: `
      <label>名称<input data-field="name" placeholder="公司知识库" /></label>
      <label>检索接口<input data-field="endpoint" placeholder="https://server/kb/search" /></label>
      <label>API Key<input data-field="apiKey" type="password" placeholder="可选" /></label>
    `,
    vector: `
      <label>名称<input data-field="name" placeholder="Milvus / Qdrant / PGVector" /></label>
      <label>检索接口<input data-field="endpoint" placeholder="https://server/vector/search" /></label>
      <label>Collection<input data-field="collection" placeholder="personal_docs" /></label>
      <label>API Key<input data-field="apiKey" type="password" placeholder="可选" /></label>
    `,
    obsidian: `
      <label>名称<input data-field="name" placeholder="我的 Obsidian Vault" /></label>
      <label>Base URL<input data-field="baseUrl" placeholder="https://127.0.0.1:27124" /></label>
      <label>API Key<input data-field="apiKey" type="password" placeholder="Local REST API token" /></label>
      <label class="checkLine"><input data-field="insecureTls" type="checkbox" checked />允许自签名 HTTPS 证书</label>
    `,
    recovery: `
      <label>绑定手机<input data-field="phone" value="${escapeHtml(state?.auth?.user?.phone || '')}" placeholder="用于找回身份" /></label>
      <label>恢复邮箱<input data-field="recoveryEmail" value="${escapeHtml(state?.auth?.user?.recoveryEmail || '')}" placeholder="you@example.com" /></label>
    `,
  };
  elements.dynamicConfigFields.innerHTML = templates[type] || '';
}

function readConfigForm() {
  const data = {};
  for (const input of elements.dynamicConfigFields.querySelectorAll('[data-field]')) {
    data[input.dataset.field] = input.type === 'checkbox' ? input.checked : input.value;
  }
  return data;
}

function renderSources() {
  elements.kbSources.innerHTML = kbSourcesDraft.length
    ? kbSourcesDraft.map((source) => `
      <div class="sourceItem">
        <div><strong>${escapeHtml(source.name)}</strong><span>${escapeHtml(source.endpoint)}</span></div>
        <button data-source-kind="kb" data-source-id="${source.id}">删除</button>
      </div>
    `).join('')
    : '<div class="muted">尚未添加知识库</div>';
  elements.vectorSources.innerHTML = vectorSourcesDraft.length
    ? vectorSourcesDraft.map((source) => `
      <div class="sourceItem">
        <div><strong>${escapeHtml(source.name)}</strong><span>${escapeHtml(source.collection || source.endpoint)}</span></div>
        <button data-source-kind="vector" data-source-id="${source.id}">删除</button>
      </div>
    `).join('')
    : '<div class="muted">尚未添加向量库</div>';
  elements.obsidianSources.innerHTML = obsidianSourcesDraft.length
    ? obsidianSourcesDraft.map((source) => `
      <div class="sourceItem">
        <div><strong>${escapeHtml(source.name)}</strong><span>${escapeHtml(source.baseUrl)}</span></div>
        <button data-source-kind="obsidian" data-source-id="${source.id}">删除</button>
      </div>
    `).join('')
    : '<div class="muted">尚未添加 Obsidian</div>';
}

function renderLastQuery() {
  const latest = state.knowledgeCenter?.queryLogs?.[0];
  if (!latest) return;
  elements.queryResult.innerHTML = `
    <strong>${escapeHtml(latest.question)}</strong>
    <pre>${escapeHtml(latest.answer)}</pre>
    <div class="evidenceList">
      ${(latest.evidence || []).slice(0, 5).map((item) => `
        <div class="evidenceItem">
          <span>${escapeHtml(item.source)} · ${escapeHtml(item.title)}</span>
          <p>${escapeHtml(item.content || '').slice(0, 260)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderRecords() {
  elements.records.innerHTML = '';
  if (!state.records || state.records.length === 0) {
    elements.records.innerHTML = '<div class="row"><div class="muted">还没有同步记录</div><div></div><div></div><div></div></div>';
    return;
  }
  for (const record of state.records) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div>
        <div>${escapeHtml(record.fileName)}</div>
        <div class="muted">${escapeHtml(record.token)}</div>
        <div class="muted">${escapeHtml(record.localPath || '')}</div>
      </div>
      <div class="muted">${record.kind === 'text' ? '文本' : '文件'}</div>
      <div class="muted">${formatBytes(record.size)}</div>
      <div class="actions">
        <button data-record-action="download" data-id="${record.id}">取回入库</button>
        <button data-record-action="open" data-id="${record.id}">飞书</button>
        <button data-record-action="forget" data-id="${record.id}">移除</button>
      </div>
    `;
    elements.records.appendChild(row);
  }
}

function renderItems() {
  elements.items.innerHTML = '';
  if (!state.items || state.items.length === 0) {
    elements.items.innerHTML = '<div class="empty">还没有从飞书取回并解密的内容。</div>';
    return;
  }
  for (const item of state.items) {
    const card = document.createElement('article');
    card.className = 'itemCard';
    if (item.kind === 'file') {
      card.innerHTML = `
        <div class="itemHeader">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <div class="muted">文件 · ${formatBytes(item.size)}</div>
          </div>
          <div class="actions">
            <button data-item-action="save" data-id="${item.id}">下载回本地</button>
            <button data-item-action="forget" data-id="${item.id}">移除</button>
          </div>
        </div>
        <div class="pathLine">原路径：${escapeHtml(item.sourcePath || '无')}</div>
        <div class="pathLine">保存路径：${escapeHtml(item.savedPath || '尚未保存到本地')}</div>
      `;
    } else if (item.kind === 'web' || item.kind === 'video') {
      card.innerHTML = `
        <div class="itemHeader">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <div class="muted">${item.kind === 'video' ? '视频链接' : '网页链接'} · ${formatBytes(item.size)}</div>
          </div>
          <div class="actions">
            <button data-item-action="open-url" data-url="${escapeHtml(item.url || '')}">打开</button>
            <button data-item-action="unlock" data-id="${item.id}">解锁</button>
            <button data-item-action="forget" data-id="${item.id}">移除</button>
          </div>
        </div>
        <div class="pathLine">${escapeHtml(item.url || '链接已加密，解锁后查看')}</div>
        <pre id="itemText-${item.id}" class="maskedText">${escapeHtml(item.maskedText)}</pre>
      `;
    } else {
      card.innerHTML = `
        <div class="itemHeader">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <div class="muted">文本 · ${formatBytes(item.size)}</div>
          </div>
          <div class="actions">
            <button data-item-action="unlock" data-id="${item.id}">解锁查看</button>
            <button data-item-action="forget" data-id="${item.id}">移除</button>
          </div>
        </div>
        <pre id="itemText-${item.id}" class="maskedText">${escapeHtml(item.maskedText)}</pre>
      `;
    }
    elements.items.appendChild(card);
  }
}

async function refresh() {
  state = await api.getState();
  render();
}

elements.showLogin.addEventListener('click', () => {
  authMode = 'login';
  renderAuthMode();
});

elements.showRegister.addEventListener('click', () => {
  authMode = 'register';
  renderAuthMode();
});

elements.localSubmit.addEventListener('click', async () => {
  const payload = {
    email: elements.localEmail.value,
    username: elements.localUsername.value,
    phone: elements.localEmail.value,
    recoveryEmail: elements.localEmail.value,
    password: elements.localPassword.value,
  };
  if (authMode === 'register' && elements.recoveryEmail.value.trim() !== pendingVerifyCode) {
    setLoginHint('验证码不正确，请先发送并输入验证码。', true);
    return;
  }
  const next = authMode === 'register'
    ? await run(() => api.register(payload), '注册成功', true)
    : await run(() => api.loginLocal(payload), '登录成功', true);
  if (next) {
    state = next;
    elements.localPassword.value = '';
    if (next.recoveryCode) {
      setLoginHint(`注册成功。请保存恢复码：${next.recoveryCode}`);
    }
    render();
  }
});

elements.sendVerifyCode.addEventListener('click', () => {
  const target = elements.localEmail.value.trim();
  if (!target) {
    setLoginHint('请先输入手机或邮箱。', true);
    return;
  }
  pendingVerifyCode = String(Math.floor(100000 + Math.random() * 900000));
  const channel = target.includes('@') ? '邮件' : '短信';
  setLoginHint(`${channel}验证码已发送。开发模式验证码：${pendingVerifyCode}`);
});

for (const button of [elements.navLibrary, elements.navProjects, elements.navAdd, elements.navConfig]) {
  button.addEventListener('click', () => {
    activeView = button.dataset.view;
    renderActiveView();
  });
}

for (const button of [elements.projectProviderGithub, elements.projectProviderGitlab, elements.projectProviderGit, elements.projectProviderSvn]) {
  button.addEventListener('click', () => {
    projectProvider = button.dataset.provider;
    for (const item of [elements.projectProviderGithub, elements.projectProviderGitlab, elements.projectProviderGit, elements.projectProviderSvn]) {
      item.classList.toggle('active', item === button);
    }
  });
}

elements.saveProjectAccount.addEventListener('click', async () => {
  const next = await run(() => api.saveProjectAccount({
    provider: projectProvider,
    label: elements.projectAccountLabel.value,
    username: elements.projectAccountUsername.value,
    secret: elements.projectAccountSecret.value,
  }), '项目账号已保存');
  if (next) {
    state = next;
    elements.projectAccountLabel.value = '';
    elements.projectAccountUsername.value = '';
    elements.projectAccountSecret.value = '';
    render();
  }
});

elements.chooseProjectDir.addEventListener('click', async () => {
  const result = await run(() => api.chooseDirectory());
  if (result && !result.canceled && result.filePaths?.[0]) {
    elements.projectLocalPath.value = result.filePaths[0];
  }
});

elements.saveProjectRepo.addEventListener('click', async () => {
  const next = await run(() => api.saveProjectRepository({
    tool: elements.projectTool.value,
    accountId: elements.projectAccountSelect.value,
    name: elements.projectName.value,
    remoteUrl: elements.projectRemoteUrl.value,
    localPath: elements.projectLocalPath.value,
    migrationDir: elements.projectMigrationDir.value,
  }), '项目配置已保存');
  if (next) {
    state = next;
    elements.projectName.value = '';
    elements.projectRemoteUrl.value = '';
    elements.projectLocalPath.value = '';
    elements.projectMigrationDir.value = '';
    render();
  }
});

elements.projectRepos.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-project-action]');
  if (!button) return;
  const action = button.dataset.projectAction;
  if (action === 'delete') {
    const next = await run(() => api.deleteProjectRepository(button.dataset.id), '项目配置已删除');
    if (next) {
      state = next;
      render();
    }
    return;
  }
  elements.projectOutput.textContent = '执行中...';
  const result = await run(() => api.runProjectAction({
    repoId: button.dataset.id,
    action,
    message: elements.projectCommitMessage.value,
  }), '项目命令执行完成');
  if (result) {
    state = result.state;
    elements.projectOutput.textContent = result.output || 'OK';
    render();
  }
});

elements.showConfigForm.addEventListener('click', () => {
  configFormVisible = true;
  renderConfigCenter();
});

elements.configList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-config-type]');
  if (!button) return;
  openConfigForm(button.dataset.configType);
});

elements.cancelConfigForm.addEventListener('click', () => {
  configFormVisible = false;
  renderConfigCenter();
});

elements.configType.addEventListener('change', () => {
  renderDynamicConfigFields();
});

elements.saveConfigDynamic.addEventListener('click', async () => {
  const type = elements.configType.value;
  const data = readConfigForm();
  let next = null;
  if (type === 'feishu') {
    next = await run(() => api.saveSettings({ ...data, redirectPort: 37891 }), '飞书配置已保存');
  } else if (type === 'llm') {
    next = await run(() => api.saveAiProfile({ provider: 'openai-compatible', ...data }), '大模型配置已保存');
  } else if (type === 'knowledge') {
    next = await run(() => api.saveKnowledgeSources([{ id: cryptoRandomId(), enabled: true, ...data }, ...kbSourcesDraft]), '知识库配置已保存');
  } else if (type === 'vector') {
    next = await run(() => api.saveVectorSources([{ id: cryptoRandomId(), enabled: true, ...data }, ...vectorSourcesDraft]), '向量库配置已保存');
  } else if (type === 'obsidian') {
    next = await run(() => api.saveObsidianSources([{ id: cryptoRandomId(), enabled: true, ...data }, ...obsidianSourcesDraft]), 'Obsidian 配置已保存');
  } else if (type === 'recovery') {
    next = await run(() => api.updateRecovery(data), '恢复资料已保存');
  }
  if (next) {
    state = next;
    configFormVisible = false;
    render();
  }
});

elements.resetSubmit.addEventListener('click', async () => {
  const result = await run(() => api.resetPassword({
    email: elements.resetEmail.value,
    recoveryCode: elements.resetCode.value,
    newPassword: elements.resetPassword.value,
  }), '密码已重置，请使用新密码登录。', true);
  if (result) {
    authMode = 'login';
    elements.localEmail.value = elements.resetEmail.value;
    elements.localPassword.value = '';
    renderAuthMode();
  }
});

elements.fileMode.addEventListener('click', () => {
  uploadMode = 'file';
  renderUploadMode();
});

elements.textMode.addEventListener('click', () => {
  uploadMode = 'text';
  renderUploadMode();
});

elements.webMode.addEventListener('click', () => {
  uploadMode = 'web';
  renderUploadMode();
});

elements.videoMode.addEventListener('click', () => {
  uploadMode = 'video';
  renderUploadMode();
});

elements.vaultFileMode.addEventListener('click', () => {
  vaultUploadMode = 'file';
  renderUploadMode();
});

elements.vaultTextMode.addEventListener('click', () => {
  vaultUploadMode = 'text';
  renderUploadMode();
});

elements.saveManualContent.addEventListener('click', async () => {
  const result = await run(() => api.createLibraryItem({
    kind: uploadMode === 'file' ? 'text' : uploadMode,
    title: elements.manualTitle.value,
    url: elements.manualUrl.value,
    content: elements.manualText.value,
  }), '内容已保存到本地内容库');
  if (result) {
    state = result;
    elements.manualTitle.value = '';
    elements.manualUrl.value = '';
    elements.manualText.value = '';
    activeView = 'library';
    render();
  }
});

elements.saveSettings.addEventListener('click', async () => {
  const next = await run(() => api.saveSettings({
    appId: elements.appId.value,
    appSecret: elements.appSecret.value,
    folderToken: elements.folderToken.value,
    redirectPort: 37891,
  }), '配置已保存');
  if (next) {
    state = next;
    render();
  }
});

elements.saveRecovery.addEventListener('click', async () => {
  const next = await run(() => api.updateRecovery({
    phone: elements.profilePhone.value,
    recoveryEmail: elements.profileRecoveryEmail.value,
  }), '恢复资料已保存');
  if (next) {
    state = next;
    render();
  }
});

elements.saveAiProfile.addEventListener('click', async () => {
  const next = await run(() => api.saveAiProfile({
    provider: 'openai-compatible',
    baseUrl: elements.llmBaseUrl.value,
    apiKey: elements.llmApiKey.value,
    model: elements.llmModel.value,
    temperature: elements.llmTemperature.value,
  }), '大模型配置已保存');
  if (next) {
    state = next;
    render();
  }
});

elements.addKbSource.addEventListener('click', async () => {
  const source = {
    id: cryptoRandomId(),
    name: elements.kbName.value,
    endpoint: elements.kbEndpoint.value,
    apiKey: elements.kbApiKey.value,
    enabled: true,
  };
  if (!source.name || !source.endpoint) {
    showNotice('请填写知识库名称和检索接口', true);
    return;
  }
  const next = await run(() => api.saveKnowledgeSources([source, ...kbSourcesDraft]), '知识库已添加');
  if (next) {
    state = next;
    elements.kbName.value = '';
    elements.kbEndpoint.value = '';
    elements.kbApiKey.value = '';
    render();
  }
});

elements.addVectorSource.addEventListener('click', async () => {
  const source = {
    id: cryptoRandomId(),
    name: elements.vectorName.value,
    endpoint: elements.vectorEndpoint.value,
    collection: elements.vectorCollection.value,
    apiKey: elements.vectorApiKey.value,
    enabled: true,
  };
  if (!source.name || !source.endpoint) {
    showNotice('请填写向量库名称和检索接口', true);
    return;
  }
  const next = await run(() => api.saveVectorSources([source, ...vectorSourcesDraft]), '向量库已添加');
  if (next) {
    state = next;
    elements.vectorName.value = '';
    elements.vectorEndpoint.value = '';
    elements.vectorCollection.value = '';
    elements.vectorApiKey.value = '';
    render();
  }
});

elements.addObsidianSource.addEventListener('click', async () => {
  const source = {
    id: cryptoRandomId(),
    name: elements.obsidianName.value,
    baseUrl: elements.obsidianBaseUrl.value,
    apiKey: elements.obsidianApiKey.value,
    insecureTls: elements.obsidianInsecureTls.checked,
    enabled: true,
  };
  if (!source.name || !source.baseUrl) {
    showNotice('请填写 Obsidian 名称和 Base URL', true);
    return;
  }
  const next = await run(() => api.saveObsidianSources([source, ...obsidianSourcesDraft]), 'Obsidian 已添加');
  if (next) {
    state = next;
    elements.obsidianName.value = '';
    elements.obsidianBaseUrl.value = '';
    elements.obsidianApiKey.value = '';
    render();
  }
});

elements.kbSources.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-source-kind="kb"]');
  if (!button) return;
  const nextSources = kbSourcesDraft.filter((source) => source.id !== button.dataset.sourceId);
  const next = await run(() => api.saveKnowledgeSources(nextSources), '知识库已删除');
  if (next) {
    state = next;
    render();
  }
});

elements.vectorSources.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-source-kind="vector"]');
  if (!button) return;
  const nextSources = vectorSourcesDraft.filter((source) => source.id !== button.dataset.sourceId);
  const next = await run(() => api.saveVectorSources(nextSources), '向量库已删除');
  if (next) {
    state = next;
    render();
  }
});

elements.obsidianSources.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-source-kind="obsidian"]');
  if (!button) return;
  const nextSources = obsidianSourcesDraft.filter((source) => source.id !== button.dataset.sourceId);
  const next = await run(() => api.saveObsidianSources(nextSources), 'Obsidian 已删除');
  if (next) {
    state = next;
    render();
  }
});

elements.runKnowledgeQuery.addEventListener('click', async () => {
  const question = elements.questionInput.value.trim();
  if (!question) {
    showNotice('请输入检索问题', true);
    return;
  }
  elements.queryResult.textContent = '正在检索知识库和向量库，并生成答案...';
  const result = await run(() => api.queryKnowledgeCenter({ question }), '检索完成');
  if (result) {
    state = result.state;
    elements.queryResult.innerHTML = `
      <strong>${escapeHtml(question)}</strong>
      <pre>${escapeHtml(result.answer)}</pre>
      <div class="evidenceList">
        ${(result.evidence || []).map((item) => `
          <div class="evidenceItem">
            <span>${escapeHtml(item.source)} · ${escapeHtml(item.title)}</span>
            <p>${escapeHtml(item.content || '').slice(0, 420)}</p>
          </div>
        `).join('')}
      </div>
    `;
    render();
  }
});

elements.login.addEventListener('click', async () => {
  const next = await run(() => api.login(), '飞书账号已登录');
  if (next) {
    state = next;
    render();
  }
});

elements.loginBadge.addEventListener('click', async () => {
  if (state.isFeishuLoggedIn) {
    const next = await run(() => api.logout(), '已退出飞书登录');
    if (next) {
      state = next;
      render();
    }
    return;
  }
  activeView = 'config';
  renderActiveView();
  openConfigForm('feishu');
});

elements.logout.addEventListener('click', async () => {
  const next = await run(() => api.logout(), '已退出飞书登录');
  if (next) {
    state = next;
    render();
  }
});

elements.chooseFiles.addEventListener('click', async () => {
  const result = await run(() => api.chooseFiles());
  if (result && !result.canceled) {
    selectedFiles = result.filePaths || [];
    render();
  }
});

elements.upload.addEventListener('click', async () => {
  if (!state.isFeishuLoggedIn) {
    showNotice('请先登录飞书账号', true);
    return;
  }
  if (elements.passphrase.value.length < 8) {
    showNotice('飞书加密口令至少需要 8 个字符', true);
    return;
  }
  const action = vaultUploadMode === 'text'
    ? () => api.uploadText({
      name: elements.secretName.value,
      text: elements.secretText.value,
      passphrase: elements.passphrase.value,
    })
    : () => api.uploadFiles({
      filePaths: selectedFiles,
      passphrase: elements.passphrase.value,
    });
  const result = await run(action, '已加密同步到飞书');
  if (result) {
    state = result.state;
    selectedFiles = [];
    elements.passphrase.value = '';
    elements.secretName.value = '';
    elements.secretText.value = '';
    render();
  }
});

elements.records.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-record-action]');
  if (!button) return;
  const record = state.records.find((item) => item.id === button.dataset.id);
  if (!record) return;

  if (button.dataset.recordAction === 'open') {
    await api.openExternal(record.url || `https://open.feishu.cn/file/${record.token}`);
    return;
  }

  if (button.dataset.recordAction === 'forget') {
    const next = await run(() => api.forgetRecord(record.id), '同步记录已移除');
    if (next) {
      state = next;
      render();
    }
    return;
  }

  if (elements.passphrase.value.length < 8) {
    showNotice('请输入上传时使用的飞书加密口令，再取回入库', true);
    return;
  }
  const next = await run(() => api.downloadRecord({
    recordId: record.id,
    passphrase: elements.passphrase.value,
  }), '已从飞书取回、解密并存入本地 SQLite');
  if (next) {
    state = next;
    render();
  }
});

elements.items.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-item-action]');
  if (!button) return;
  const itemId = button.dataset.id;
  if (button.dataset.itemAction === 'open-url') {
    if (button.dataset.url) await api.openExternal(button.dataset.url);
    return;
  }
  const localPassword = elements.unlockPassword.value;
  if ((button.dataset.itemAction === 'unlock' || button.dataset.itemAction === 'save') && localPassword.length < 8) {
    showNotice('请输入本地密码', true);
    return;
  }

  if (button.dataset.itemAction === 'forget') {
    const next = await run(() => api.forgetItem(itemId), '本地内容已移除');
    if (next) {
      state = next;
      render();
    }
    return;
  }

  if (button.dataset.itemAction === 'unlock') {
    const result = await run(() => api.unlockItem({ itemId, localPassword }), '文本已解锁');
    if (result) {
      const target = document.querySelector(`#itemText-${CSS.escape(itemId)}`);
      if (target) {
        target.className = 'plainText';
        target.textContent = result.text;
      }
    }
    return;
  }

  if (button.dataset.itemAction === 'save') {
    const next = await run(() => api.saveItemFile({ itemId, localPassword }), '文件已保存到本地');
    if (next) {
      state = next;
      render();
    }
  }
});

elements.showDatabase.addEventListener('click', () => {
  api.showDatabase();
});

refresh().catch((error) => setLoginHint(String(error), true));
