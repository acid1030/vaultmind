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
      context: { scope: 'personal', groupId: '', groupName: '' },
      groups: [],
      knowledgeCenter: {
        aiProfile: {},
        knowledgeSources: [],
        vectorSources: [],
        obsidianSources: [],
        queryLogs: [],
        feishuWiki: { enabled: true, spaceId: '', available: false },
        obsidian: { configured: false, enabled: false, localRestUrl: 'https://127.0.0.1:27124' },
      },
      redirectUri: 'http://127.0.0.1:37891/feishu/oauth/callback',
      requiredScopes: '',
    }),
    register: fail,
    loginLocal: fail,
    logoutLocal: fail,
    updateRecovery: fail,
    changeLocalPassword: fail,
    resetPassword: fail,
    saveSettings: fail,
    testFeishuSync: fail,
    login: fail,
    logout: fail,
    chooseFiles: fail,
    chooseDirectory: fail,
    scanWechatAttachments: fail,
    chooseWechatAttachments: fail,
    uploadFiles: fail,
    onUploadProgress: () => () => {},
    uploadText: fail,
    downloadRecord: fail,
    openAsset: fail,
    unlockItem: fail,
    saveItemFile: fail,
    forgetRecord: fail,
    forgetItem: fail,
    createLibraryItem: fail,
    saveAiProfile: fail,
    listModels: fail,
    testModel: fail,
    saveKnowledgeSources: fail,
    saveVectorSources: fail,
    queryKnowledgeCenter: fail,
    saveProjectAccount: fail,
    saveProjectRepository: fail,
    deleteProjectRepository: fail,
    runProjectAction: fail,
    setContext: fail,
    createGroup: fail,
    inviteToGroup: fail,
    leaveGroup: fail,
    listGroupMembers: fail,
    search: fail,
    reindexSearch: fail,
    copyItemToGroup: fail,
    syncManifest: fail,
    pullManifest: fail,
    fullSync: fail,
    removeGroupMember: fail,
    rotateGroupKey: fail,
    updateMemberRole: fail,
    transferGroupOwnership: fail,
    acceptPendingInvites: fail,
    openExternal: fail,
    showDatabase: fail,
  };
}

const api = window.vaultApi || createUnavailableApi();
const FEISHU_APP_CREDENTIALS_URL = 'https://open.feishu.cn/app';
const ICONS = {
  activity: '<path d="M22 12h-4l-3 8-6-16-3 8H2"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><rect x="2" y="2" width="13" height="13" rx="2"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  git: '<path d="M15 9a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z"/><path d="M15 15a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z"/><path d="M12 12V9"/><path d="M12 15v6"/><path d="M12 3v3"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M11 12 21 2"/><path d="m16 7 3 3"/><path d="m14 9 3 3"/>',
  library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  mail: '<path d="M4 4h16v16H4z"/><path d="m22 6-10 7L2 6"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  settings: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 3.3l.06.06A1.65 1.65 0 0 0 8.92 3a1.65 1.65 0 0 0 1-1.51V1a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.14.47.51.84.98.98.2.06.39.09.62.09h.09a2 2 0 1 1 0 4H21a1.65 1.65 0 0 0-1.6 2Z"/>',
  sync: '<path d="M21 12a9 9 0 0 0-15-6.7L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/><path d="M21 21v-5h-5"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  upload: '<path d="M12 21V9"/><path d="m17 14-5-5-5 5"/><path d="M5 3h14"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
};

function icon(name) {
  const body = ICONS[name] || ICONS.activity;
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

function iconButton(name, label, attrs = '') {
  return `<button ${attrs} title="${escapeHtml(label)}">${icon(name)}<span>${escapeHtml(label)}</span></button>`;
}

function evidenceFileMeta(item) {
  const groups = [
    { name: 'word', label: 'Word', exts: ['doc', 'docx', 'wps'] },
    { name: 'pdf', label: 'PDF', exts: ['pdf'] },
    { name: 'sheet', label: 'Excel', exts: ['xls', 'xlsx', 'csv'] },
    { name: 'slide', label: 'PPT', exts: ['ppt', 'pptx'] },
    { name: 'archive', label: '压缩包', exts: ['zip', 'rar', '7z', 'tar', 'gz'] },
    { name: 'image', label: '图片', exts: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'] },
    { name: 'video', label: '视频', exts: ['mp4', 'mov', 'm4v', 'avi', 'mkv'] },
    { name: 'audio', label: '音频', exts: ['mp3', 'm4a', 'wav', 'aac'] },
    { name: 'code', label: '代码', exts: ['js', 'ts', 'json', 'html', 'css', 'xml', 'md'] },
  ];
  const knownExts = new Set(groups.flatMap((group) => group.exts));
  const candidates = [];
  for (const text of [item?.title || '', item?.content || '']) {
    const matches = String(text).toLowerCase().matchAll(/\.([a-z0-9]{2,8})(?=$|[\s)，),。·、:：])/g);
    for (const match of matches) candidates.push(match[1]);
  }
  const ext = [...candidates].reverse().find((candidate) => knownExts.has(candidate))
    || candidates[candidates.length - 1]
    || (item?.kind === 'text' ? 'txt' : 'file');
  const group = groups.find((entry) => entry.exts.includes(ext));
  return {
    ext: ext.toUpperCase(),
    type: group ? group.name : 'generic',
    label: group ? group.label : '文件',
  };
}

function evidenceTypeIcon(meta) {
  const glyphs = {
    word: 'W',
    pdf: 'PDF',
    sheet: 'X',
    slide: 'P',
    archive: 'ZIP',
    image: 'IMG',
    video: 'VID',
    audio: 'AUD',
    code: '</>',
    generic: meta.ext,
  };
  const glyph = glyphs[meta.type] || meta.ext;
  return `
    <div class="evidenceType evidenceType-${escapeHtml(meta.type)}" title="${escapeHtml(meta.label)}">
      <span class="fileTypeGlyph">${escapeHtml(glyph)}</span>
    </div>
  `;
}

function hydrateIcons(root = document) {
  for (const button of root.querySelectorAll('button[data-icon]')) {
    if (button.querySelector('.icon')) continue;
    const label = button.textContent.trim();
    button.innerHTML = `${icon(button.dataset.icon)}${label ? `<span>${escapeHtml(label)}</span>` : ''}`;
  }
}

const LLM_PROVIDERS = {
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'],
  },
  zhipu: {
    label: '智谱AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5.1', 'glm-5', 'glm-5-turbo', 'glm-4.7', 'glm-4.6', 'glm-4.5', 'glm-4.5-air', 'glm-4.5v', 'glm-4.6v'],
  },
  zhipu_coding_plan: {
    label: '智谱CodingPlan',
    baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
    models: ['glm-5.1', 'glm-5', 'glm-5-turbo', 'glm-4.7', 'glm-4.6', 'glm-4.5', 'glm-4.5-air'],
  },
  minimax: {
    label: 'MiniMax',
    baseUrl: 'https://api.minimaxi.com/v1',
    models: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.1', 'MiniMax-M2.1-highspeed', 'MiniMax-M2'],
  },
  kimi: {
    label: 'Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2.6', 'kimi-k2.5', 'kimi-k2-0905-preview', 'kimi-k2-turbo-preview', 'kimi-k2-thinking', 'kimi-k2-thinking-turbo', 'kimi-k2-0711-preview', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
  qwen: {
    label: '千问 / 阿里百炼',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen3.7-max', 'qwen3.7-max-2026-05-20', 'qwen3.6-max-preview', 'qwen3.6-plus', 'qwen3.6-plus-2026-04-02', 'qwen3.6-flash', 'qwen3.6-flash-2026-04-16', 'qwen3.6-35b-a3b', 'qwen3.5-plus', 'qwen3.5-flash', 'qwen3-max', 'qwen3-max-2026-01-23', 'qwen3-max-preview', 'qwen-plus-latest', 'qwen-flash-latest', 'qwen-turbo-latest', 'qwen3-coder-plus', 'qwen3-coder-flash', 'qwq-plus'],
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-5.5', 'gpt-5.5-chat-latest', 'gpt-5.5-pro', 'gpt-5.5-codex', 'gpt-5.2', 'gpt-5.2-chat-latest', 'gpt-5.2-pro', 'gpt-5.2-codex', 'gpt-5.1', 'gpt-5.1-chat-latest', 'gpt-5.1-codex-max', 'gpt-5.1-codex', 'gpt-5', 'gpt-5-chat-latest', 'gpt-5-codex', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini', 'o3'],
  },
  gemini: {
    label: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-3-pro', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'],
  },
  grok: {
    label: 'Grok',
    baseUrl: 'https://api.x.ai/v1',
    models: ['grok-4.3', 'grok-4.3-latest', 'grok-4.20', 'grok-4.20-latest', 'grok-3-latest', 'grok-3-mini-latest'],
  },
  claude: {
    label: 'Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-opus-4-1-20250805', 'claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
  },
  custom: {
    label: '自定义 OpenAI-compatible',
    baseUrl: '',
    models: [],
  },
};

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
  logoutLocal: document.querySelector('#logoutLocal'),
  contextSelect: document.querySelector('#contextSelect'),
  navLibrary: document.querySelector('#navLibrary'),
  navGroups: document.querySelector('#navGroups'),
  navProjects: document.querySelector('#navProjects'),
  navAdd: document.querySelector('#navAdd'),
  navConfig: document.querySelector('#navConfig'),
  libraryView: document.querySelector('#libraryView'),
  groupsView: document.querySelector('#groupsView'),
  projectsView: document.querySelector('#projectsView'),
  addView: document.querySelector('#addView'),
  configView: document.querySelector('#configView'),
  newGroupName: document.querySelector('#newGroupName'),
  newGroupFolder: document.querySelector('#newGroupFolder'),
  createGroupBtn: document.querySelector('#createGroupBtn'),
  groupsList: document.querySelector('#groupsList'),
  inviteGroupSelect: document.querySelector('#inviteGroupSelect'),
  inviteEmail: document.querySelector('#inviteEmail'),
  inviteRole: document.querySelector('#inviteRole'),
  inviteGroupBtn: document.querySelector('#inviteGroupBtn'),
  groupMembers: document.querySelector('#groupMembers'),
  addScopeHint: document.querySelector('#addScopeHint'),
  globalSearch: document.querySelector('#globalSearch'),
  runGlobalSearch: document.querySelector('#runGlobalSearch'),
  searchResults: document.querySelector('#searchResults'),
  syncManifest: document.querySelector('#syncManifest'),
  pullManifest: document.querySelector('#pullManifest'),
  fullSync: document.querySelector('#fullSync'),
  manifestStatus: document.querySelector('#manifestStatus'),
  acceptInvitesBtn: document.querySelector('#acceptInvitesBtn'),
  pendingInvites: document.querySelector('#pendingInvites'),
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
  feishuPassphrase: document.querySelector('#feishuPassphrase'),
  redirectUri: document.querySelector('#redirectUri'),
  scopes: document.querySelector('#scopes'),
  loginBadge: document.querySelector('#loginBadge'),
  notice: document.querySelector('#notice'),
  noticeText: document.querySelector('#noticeText'),
  noticeClose: document.querySelector('#noticeClose'),
  selectedFiles: document.querySelector('#selectedFiles'),
  libraryReauthWrap: document.querySelector('#libraryReauthWrap'),
  libraryLocalPassword: document.querySelector('#libraryLocalPassword'),
  records: document.querySelector('#records'),
  items: document.querySelector('#items'),
  saveSettings: document.querySelector('#saveSettings'),
  testFeishuSync: document.querySelector('#testFeishuSync'),
  login: document.querySelector('#login'),
  logout: document.querySelector('#logout'),
  chooseFiles: document.querySelector('#chooseFiles'),
  scanWechatFiles: document.querySelector('#scanWechatFiles'),
  wechatFiles: document.querySelector('#wechatFiles'),
  uploadProgress: document.querySelector('#uploadProgress'),
  uploadProgressTitle: document.querySelector('#uploadProgressTitle'),
  uploadProgressCount: document.querySelector('#uploadProgressCount'),
  uploadProgressBar: document.querySelector('.uploadProgressBar'),
  uploadProgressFill: document.querySelector('#uploadProgressFill'),
  uploadProgressDetail: document.querySelector('#uploadProgressDetail'),
  showDatabase: document.querySelector('#showDatabase'),
  fileMode: document.querySelector('#fileMode'),
  textMode: document.querySelector('#textMode'),
  webMode: document.querySelector('#webMode'),
  videoMode: document.querySelector('#videoMode'),
  addFileBox: document.querySelector('#addFileBox'),
  addFieldsBox: document.querySelector('#addFieldsBox'),
  manualTitle: document.querySelector('#manualTitle'),
  manualUrl: document.querySelector('#manualUrl'),
  manualUrlWrap: document.querySelector('#manualUrlWrap'),
  manualText: document.querySelector('#manualText'),
  manualTextWrap: document.querySelector('#manualTextWrap'),
  optSaveLocal: document.querySelector('#optSaveLocal'),
  optSaveLocalWrap: document.querySelector('#optSaveLocalWrap'),
  optSyncFeishu: document.querySelector('#optSyncFeishu'),
  optSyncManifest: document.querySelector('#optSyncManifest'),
  localReauthWrap: document.querySelector('#localReauthWrap'),
  addLocalPassword: document.querySelector('#addLocalPassword'),
  addKnowledgeSources: document.querySelector('#addKnowledgeSources'),
  addHistory: document.querySelector('#addHistory'),
  submitAdd: document.querySelector('#submitAdd'),
};

let state = null;
let selectedFiles = [];
let wechatFilesDraft = [];
let authMode = 'login';
let uploadMode = 'file';
let activeView = 'library';
let configFormVisible = false;
let projectProvider = 'github';
let kbSourcesDraft = [];
let vectorSourcesDraft = [];
let obsidianSourcesDraft = [];
let pendingVerifyCode = '';
let refreshedModels = [];
let chatUserId = '';
let chatMessages = [];
let chatOldestCreatedAt = null;
let chatHasMore = false;
let chatLoading = false;
let chatInitializing = null;
let noticeTimer = null;
let activeUploadId = '';
let unsubscribeUploadProgress = null;

const CHAT_DB_NAME = 'vaultmind-chat';
const CHAT_DB_VERSION = 1;
const CHAT_STORE = 'knowledge_messages';
const CHAT_PAGE_SIZE = 100;

function showNotice(message, isError = false, timeoutMs = 5000) {
  if (noticeTimer) clearTimeout(noticeTimer);
  elements.noticeText.textContent = message;
  elements.notice.className = isError ? 'notice error' : 'notice';
  if (timeoutMs > 0) {
    noticeTimer = setTimeout(() => {
      dismissNotice();
      noticeTimer = null;
    }, timeoutMs);
  }
}

function clearNotice() {
  if (noticeTimer) {
    clearTimeout(noticeTimer);
    noticeTimer = null;
  }
  elements.notice.className = 'notice hidden';
  elements.noticeText.textContent = '';
  elements.loginHint.textContent = '';
}

function dismissNotice() {
  if (noticeTimer) {
    clearTimeout(noticeTimer);
    noticeTimer = null;
  }
  elements.notice.className = 'notice hidden';
  elements.noticeText.textContent = '';
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

function openChatDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CHAT_DB_NAME, CHAT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(CHAT_STORE)
        ? request.transaction.objectStore(CHAT_STORE)
        : db.createObjectStore(CHAT_STORE, { keyPath: 'id' });
      if (!store.indexNames.contains('by_user_created')) {
        store.createIndex('by_user_created', ['userId', 'createdAtMs']);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function chatTx(mode = 'readonly') {
  return openChatDb().then((db) => {
    const tx = db.transaction(CHAT_STORE, mode);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
    tx.onabort = () => db.close();
    return tx.objectStore(CHAT_STORE);
  });
}

function normalizeChatLog(log, userId = state?.auth?.user?.id || '') {
  const createdAt = log.createdAt || new Date().toISOString();
  const createdAtMs = Number.isFinite(Date.parse(createdAt)) ? Date.parse(createdAt) : Date.now();
  return {
    id: String(log.id || cryptoRandomId()),
    userId,
    question: String(log.question || ''),
    answer: String(log.answer || ''),
    evidence: Array.isArray(log.evidence) ? log.evidence.filter((item) => !item.isHint) : [],
    createdAt,
    createdAtMs,
  };
}

function setupHintMessage(result) {
  const hints = [
    ...(Array.isArray(result?.setupHints) ? result.setupHints : []),
    ...(Array.isArray(result?.evidence) ? result.evidence.filter((item) => item.isHint) : []),
  ];
  const unique = [];
  const seen = new Set();
  for (const hint of hints) {
    const message = [hint.source, hint.title, hint.content].filter(Boolean).join(' · ');
    if (message && !seen.has(message)) {
      seen.add(message);
      unique.push(message);
    }
  }
  return unique.join('\n\n');
}

async function saveChatMessage(log) {
  const userId = state?.auth?.user?.id;
  if (!userId || !log?.question) return null;
  const message = normalizeChatLog(log, userId);
  const store = await chatTx('readwrite');
  await new Promise((resolve, reject) => {
    const request = store.put(message);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  return message;
}

async function importServerQueryLogs() {
  const logs = state?.knowledgeCenter?.queryLogs || [];
  if (!state?.auth?.user?.id || !logs.length) return;
  await Promise.all(logs.map((log) => saveChatMessage(log)));
}

async function loadChatPage({ beforeCreatedAt = null, prepend = false } = {}) {
  const userId = state?.auth?.user?.id;
  if (!userId || chatLoading) return [];
  chatLoading = true;
  try {
    const store = await chatTx('readonly');
    const index = store.index('by_user_created');
    const lower = [userId, 0];
    const upper = [userId, beforeCreatedAt === null ? Number.MAX_SAFE_INTEGER : beforeCreatedAt - 1];
    const range = IDBKeyRange.bound(lower, upper);
    const rows = await new Promise((resolve, reject) => {
      const found = [];
      const request = index.openCursor(range, 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || found.length >= CHAT_PAGE_SIZE) {
          resolve(found.reverse());
          return;
        }
        found.push(cursor.value);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
    chatHasMore = rows.length === CHAT_PAGE_SIZE;
    if (prepend) {
      const seen = new Set(chatMessages.map((item) => item.id));
      chatMessages = [...rows.filter((item) => !seen.has(item.id)), ...chatMessages];
    } else {
      chatMessages = rows;
    }
    chatOldestCreatedAt = chatMessages.length ? chatMessages[0].createdAtMs : null;
    return rows;
  } finally {
    chatLoading = false;
  }
}

async function initializeChatMessages() {
  if (!state?.auth?.isLoggedIn || !state.auth.user) {
    chatUserId = '';
    chatMessages = [];
    chatOldestCreatedAt = null;
    chatHasMore = false;
    return;
  }
  const nextUserId = state.auth.user.id;
  if (chatUserId === nextUserId && chatMessages.length) return;
  chatUserId = nextUserId;
  chatMessages = [];
  chatOldestCreatedAt = null;
  chatHasMore = false;
  await importServerQueryLogs();
  await loadChatPage();
}

function setBusy(isBusy) {
  for (const button of document.querySelectorAll('button')) {
    if (button === elements.noticeClose) continue;
    button.disabled = isBusy;
  }
}

function updateUploadProgress({ total = 0, completed = 0, processed = null, failed = 0, current = '', phase = 'idle' } = {}) {
  if (!elements.uploadProgress) return;
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeCompleted = Math.min(safeTotal, Math.max(0, Number(completed) || 0));
  const safeProcessed = Math.min(safeTotal, Math.max(0, Number(processed ?? completed) || 0));
  const safeFailed = Math.max(0, Number(failed) || 0);
  const percent = safeTotal ? Math.round((safeProcessed / safeTotal) * 100) : 0;
  elements.uploadProgress.classList.toggle('hidden', phase === 'idle');
  elements.uploadProgressTitle.textContent = phase === 'complete'
    ? (safeFailed ? '同步部分完成' : '同步完成')
    : '正在同步到飞书';
  elements.uploadProgressCount.textContent = `${safeCompleted}/${safeTotal}${safeFailed ? ` · 失败 ${safeFailed}` : ''}`;
  elements.uploadProgressFill.style.width = `${percent}%`;
  elements.uploadProgressBar?.setAttribute('aria-valuenow', String(percent));
  if (phase === 'complete') {
    elements.uploadProgressDetail.textContent = safeFailed
      ? `已同步 ${safeCompleted} 个文件，${safeFailed} 个失败，可直接重试失败项`
      : `已同步完成 ${safeCompleted} 个文件`;
  } else if (phase === 'file-error') {
    elements.uploadProgressDetail.textContent = current ? `已跳过失败文件：${current}` : '已跳过失败文件';
  } else if (current) {
    elements.uploadProgressDetail.textContent = `当前文件：${current}`;
  } else {
    elements.uploadProgressDetail.textContent = '准备上传';
  }
}

function resetUploadProgress() {
  activeUploadId = '';
  updateUploadProgress({ phase: 'idle' });
}

function createUploadId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ensureUploadProgressListener() {
  if (unsubscribeUploadProgress || typeof api.onUploadProgress !== 'function') return;
  unsubscribeUploadProgress = api.onUploadProgress((progress) => {
    if (!progress || progress.uploadId !== activeUploadId) return;
    updateUploadProgress(progress);
  });
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

function hasFeishuOAuthConfig() {
  return Boolean(state?.settings?.appId && state?.settings?.appSecret);
}

async function ensureFeishuSettingsSaved() {
  const appId = (elements.appId?.value || state?.settings?.appId || '').trim();
  const appSecret = elements.appSecret?.value || '';
  if (!appId) return;
  const next = await api.saveSettings({
    appId,
    appSecret: appSecret && appSecret !== '********' ? appSecret : undefined,
    folderToken: elements.folderToken?.value || state?.settings?.folderToken || 'root',
    redirectPort: 37891,
  });
  if (next) state = next;
}

async function startFeishuLogin() {
  await ensureFeishuSettingsSaved();
  if (!hasFeishuOAuthConfig()) {
    activeView = 'config';
    renderActiveView();
    openConfigForm('feishu');
    showNotice('请先填写并保存飞书 App ID / App Secret，再配置重定向 URL', true);
    return;
  }
  const redirectUri = state?.redirectUri || 'http://127.0.0.1:37891/feishu/oauth/callback';
  showNotice(`即将打开飞书授权窗口。若出现 20029，说明飞书开放平台还没有登记当前回调地址：${redirectUri}。请在配置页复制回调地址，粘贴到飞书应用「安全设置 → 重定向 URL」并保存后再登录。`);
  const next = await api.login();
  state = next;
  showNotice('飞书账号已登录');
  render();
}

async function openFeishuOAuthSetup() {
  activeView = 'config';
  renderActiveView();
  openConfigForm('feishu');
  await api.openExternal(FEISHU_APP_CREDENTIALS_URL);
  showNotice('已打开飞书开放平台。请创建企业自建应用，复制 App ID/Secret，并在「安全设置 → 重定向 URL」粘贴本页回调地址。', true);
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
  const isFile = uploadMode === 'file';
  elements.fileMode.classList.toggle('active', isFile);
  elements.textMode.classList.toggle('active', uploadMode === 'text');
  elements.webMode.classList.toggle('active', uploadMode === 'web');
  elements.videoMode.classList.toggle('active', uploadMode === 'video');
  if (elements.addFileBox) elements.addFileBox.classList.toggle('hidden', !isFile);
  if (elements.addFieldsBox) elements.addFieldsBox.classList.toggle('hidden', isFile);
  elements.manualUrlWrap.classList.toggle('hidden', !['web', 'video'].includes(uploadMode));
  elements.manualTextWrap.classList.toggle('hidden', ['web', 'video'].includes(uploadMode));

  if (elements.optSaveLocalWrap) {
    elements.optSaveLocalWrap.classList.toggle('muted', isFile);
    if (elements.optSaveLocal) {
      if (isFile) {
        elements.optSaveLocal.checked = false;
        elements.optSaveLocal.disabled = true;
      } else {
        elements.optSaveLocal.disabled = false;
        if (elements.optSyncFeishu) elements.optSyncFeishu.checked = true;
        if (!elements.optSaveLocal.checked && !elements.optSyncFeishu?.checked) {
          elements.optSaveLocal.checked = true;
        }
      }
    }
  }
  renderAddSyncOptions();
}

function renderAddSyncOptions() {
  if (elements.localReauthWrap) {
    elements.localReauthWrap.classList.toggle('hidden', !elements.optSaveLocal?.checked);
  }
  if (elements.optSyncManifest) {
    elements.optSyncManifest.disabled = !elements.optSyncFeishu?.checked;
    if (!elements.optSyncFeishu?.checked) elements.optSyncManifest.checked = false;
  }
  if (!elements.addKnowledgeSources) return;
  const kc = state?.knowledgeCenter || {};
  const lines = [];
  if (state?.isFeishuLoggedIn && kc.feishuWiki?.enabled !== false) {
    lines.push('· 飞书知识库 Wiki：已连接，保存后可在「知识库对话」检索');
  } else if (state?.settings?.appId) {
    lines.push('· 飞书知识库 Wiki：需登录飞书（配置中心）');
  }
  for (const s of kc.knowledgeSources || []) {
    if (s.enabled) lines.push(`· 远程知识库：${s.name}`);
  }
  for (const s of kc.vectorSources || []) {
    if (s.enabled) lines.push(`· 向量库：${s.name}`);
  }
  for (const s of kc.obsidianSources || []) {
    if (s.enabled) lines.push(`· Obsidian：${s.name}`);
  }
  elements.addKnowledgeSources.innerHTML = lines.length
    ? `<p>${lines.map((l) => escapeHtml(l)).join('<br />')}</p><p>以上来源在「知识库对话」中检索，无需单独上传；连接请在「配置」中管理。</p>`
    : '<p>连接飞书 Wiki / 远程知识库 / Obsidian 后，可在「知识库对话」统一检索。</p>';
}

function syncSelectedFilesFromWechatDraft() {
  selectedFiles = wechatFilesDraft.filter((file) => file.selected).map((file) => file.path);
}

function renderWechatFiles() {
  if (!elements.wechatFiles) return;
  elements.wechatFiles.classList.toggle('hidden', !wechatFilesDraft.length);
  if (!wechatFilesDraft.length) {
    elements.wechatFiles.innerHTML = '';
    return;
  }
  const selectedCount = wechatFilesDraft.filter((file) => file.selected).length;
  elements.wechatFiles.innerHTML = `
    <div class="wechatFileHeader">
      <strong>微信附件</strong>
      <span>${selectedCount}/${wechatFilesDraft.length} 个已选</span>
    </div>
    <div class="wechatFileItems">
      ${wechatFilesDraft.map((file, index) => `
        <label class="wechatFileItem">
          <input type="checkbox" data-wechat-file-index="${index}" ${file.selected ? 'checked' : ''} />
          <span>
            <strong>${escapeHtml(file.name)}</strong>
            <small>${escapeHtml(file.relativePath || file.path)} · ${formatBytes(file.size)}</small>
          </span>
        </label>
      `).join('')}
    </div>
  `;
}

function renderActiveView() {
  elements.navLibrary.classList.toggle('active', activeView === 'library');
  elements.navGroups.classList.toggle('active', activeView === 'groups');
  elements.navProjects.classList.toggle('active', activeView === 'projects');
  elements.navAdd.classList.toggle('active', activeView === 'add');
  elements.navConfig.classList.toggle('active', activeView === 'config');
  elements.libraryView.classList.toggle('hidden', activeView !== 'library');
  elements.groupsView.classList.toggle('hidden', activeView !== 'groups');
  elements.projectsView.classList.toggle('hidden', activeView !== 'projects');
  elements.addView.classList.toggle('hidden', activeView !== 'add');
  elements.configView.classList.toggle('hidden', activeView !== 'config');
}

function currentScopePayload() {
  const ctx = state?.context || { scope: 'personal', groupId: '' };
  if (ctx.scope === 'group' && ctx.groupId) {
    return { scope: 'group', groupId: ctx.groupId };
  }
  return { scope: 'personal' };
}

function renderContext() {
  if (!state || !elements.contextSelect) return;
  const groups = state.groups || [];
  const ctx = state.context || { scope: 'personal', groupId: '', groupName: '' };
  elements.contextSelect.innerHTML = '<option value="personal">个人</option>'
    + groups.map((g) => `<option value="group:${g.id}">${escapeHtml(g.name)}</option>`).join('');
  elements.contextSelect.value = ctx.scope === 'group' && ctx.groupId ? `group:${ctx.groupId}` : 'personal';
  if (elements.addScopeHint) {
    elements.addScopeHint.textContent = ctx.scope === 'group'
      ? `将保存到用户组：${ctx.groupName || ctx.groupId}`
      : '将保存到：个人空间（不与其他用户共享）';
  }
  if (elements.inviteGroupSelect) {
    elements.inviteGroupSelect.innerHTML = groups.map((g) => (
      `<option value="${g.id}">${escapeHtml(g.name)}</option>`
    )).join('') || '<option value="">暂无用户组</option>';
  }
}

function renderPendingInvites() {
  const invites = state?.pendingInvites || [];
  if (!elements.pendingInvites) return;
  elements.pendingInvites.innerHTML = invites.length
    ? invites.map((inv) => `
      <div class="sourceItem">
        <div><strong>${escapeHtml(inv.groupName)}</strong><span>${escapeHtml(inv.role)} · 待接受</span></div>
      </div>
    `).join('')
    : '<div class="muted">没有待处理邀请</div>';
}

function renderManifestStatus() {
  if (!elements.manifestStatus) return;
  const meta = state?.manifestMeta;
  const ctx = state?.context || {};
  if (!meta) {
    elements.manifestStatus.textContent = `当前上下文：${ctx.scope === 'group' ? ctx.groupName : '个人'} · 尚未同步清单`;
    return;
  }
  elements.manifestStatus.textContent = `清单 token: ${meta.fileToken ? meta.fileToken.slice(0, 12) + '…' : '-'} · 上传: ${meta.syncedAt || '-'} · 拉取: ${meta.pulledAt || '-'}`;
}

function renderGroups() {
  const groups = state?.groups || [];
  const currentGroupId = state?.context?.scope === 'group' ? state.context.groupId : '';
  elements.groupsList.innerHTML = groups.length
    ? groups.map((g) => `
      <div class="sourceItem groupCard${g.id === currentGroupId ? ' activeGroup' : ''}">
        <div>
          <strong>${escapeHtml(g.name)}${g.id === currentGroupId ? '<span class="scopeBadge">当前</span>' : ''}</strong>
          <span>${escapeHtml(g.role)} · ${escapeHtml(g.slug || '未设置标识')}</span>
        </div>
        <div class="actions">
          ${iconButton('arrowRight', '切换', `data-group-switch="${g.id}"`)}
          ${iconButton('users', '成员', `data-group-members="${g.id}"`)}
          ${['owner', 'admin'].includes(g.role) ? iconButton('key', '轮换密钥', `data-group-rotate="${g.id}"`) : ''}
          ${iconButton('logout', '离开', `data-group-leave="${g.id}"`)}
        </div>
      </div>
    `).join('')
    : '<div class="muted">还没有用户组，请先创建。</div>';
  if (elements.groupMembers && !elements.groupMembers.innerHTML.trim()) {
    elements.groupMembers.innerHTML = '<div class="empty compactEmpty">选择一个用户组查看成员。</div>';
  }
}

function render() {
  if (!state) return;
  hydrateIcons();
  const loggedIn = Boolean(state.auth && state.auth.isLoggedIn);
  elements.loginView.classList.toggle('hidden', loggedIn);
  elements.mainView.classList.toggle('hidden', !loggedIn);
  renderAuthMode();
  renderUploadMode();
  renderActiveView();
  renderContext();

  if (!loggedIn) {
    setLoginHint(state.auth && state.auth.hasUsers ? '请输入邮箱和本地密码登录。' : '还没有本地账号，请注册第一个账号。');
    if (!state.auth.hasUsers) authMode = 'register';
    renderAuthMode();
    return;
  }

  elements.localBadge.textContent = `本地：${state.auth.user.username} <${state.auth.user.email}>`;
  elements.localBadge.title = '本地账号';
  elements.localBadge.removeAttribute('role');
  elements.localBadge.removeAttribute('tabindex');
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
  if (elements.feishuPassphrase) elements.feishuPassphrase.value = state.settings.feishuPassphrase || '';
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
  renderWechatFiles();

  renderRecords();
  renderItems();
  renderAddHistory();
  renderGroups();
  renderPendingInvites();
  renderManifestStatus();
  renderSources();
  renderConfigCenter();
  renderProjects();
  renderKnowledgeChat();
  hydrateIcons();
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
          ${iconButton('download', '克隆/检出', `data-project-action="clone" data-id="${repo.id}"`)}
          ${iconButton('activity', '状态', `data-project-action="status" data-id="${repo.id}"`)}
          ${iconButton('git', '版本', `data-project-action="log" data-id="${repo.id}"`)}
          ${iconButton('sync', '更新', `data-project-action="update" data-id="${repo.id}"`)}
          ${iconButton('save', '提交', `data-project-action="commit" data-id="${repo.id}"`)}
          ${iconButton('upload', '推送', `data-project-action="push" data-id="${repo.id}"`)}
          ${iconButton('trash', '删除', `data-project-action="delete" data-id="${repo.id}"`)}
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
  const fw = state.knowledgeCenter?.feishuWiki || {};
  cards.push({
    type: 'feishuWiki',
    title: '飞书知识库',
    status: fw.available ? (fw.enabled ? '已启用' : '已停用') : '需登录飞书',
    meta: fw.spaceId ? `空间 ${fw.spaceId}` : 'Wiki 全文检索（登录后可用）',
  });
  const ob = state.knowledgeCenter?.obsidian || {};
  if (!ob.configured) {
    cards.push({
      type: 'obsidian',
      title: 'Obsidian',
      status: '未配置',
      meta: `本地 REST ${ob.localRestUrl || '127.0.0.1:27124'} 或远程 REST`,
    });
  }
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
      <button class="configStatus" data-config-type="${escapeHtml(card.type)}">${icon('settings')}<span>${escapeHtml(card.status)}</span></button>
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
    feishuWiki: '飞书 Wiki',
    llm: '模型',
    knowledge: '知识库',
    vector: '向量库',
    obsidian: 'Obsidian',
    recovery: '账户',
  }[type] || type;
}

function llmProviderOptions(selectedProvider) {
  return Object.entries(LLM_PROVIDERS).map(([value, provider]) => (
    `<option value="${escapeHtml(value)}" ${value === selectedProvider ? 'selected' : ''}>${escapeHtml(provider.label)}</option>`
  )).join('');
}

function llmModelOptions(providerKey, selectedModel) {
  const defaults = LLM_PROVIDERS[providerKey]?.models || [];
  const models = [...new Set([...refreshedModels, ...defaults, selectedModel].filter(Boolean))];
  if (!models.length) return '<option value="">请先刷新或手动输入模型</option>';
  return models.map((model) => (
    `<option value="${escapeHtml(model)}" ${model === selectedModel ? 'selected' : ''}>${escapeHtml(model)}</option>`
  )).join('');
}

function preferredModel(providerKey, currentModel = '') {
  const provider = LLM_PROVIDERS[providerKey] || LLM_PROVIDERS.openai;
  if (currentModel && provider.models.includes(currentModel)) return currentModel;
  return provider.models[0] || currentModel || '';
}

function renderDynamicConfigFields() {
  if (!elements.dynamicConfigFields) return;
  const type = elements.configType.value;
  const ai = state?.knowledgeCenter?.aiProfile || {};
  const fw = state?.knowledgeCenter?.feishuWiki || {};
  const obMeta = state?.knowledgeCenter?.obsidian || {};
  const providerKey = ai.provider && LLM_PROVIDERS[ai.provider] ? ai.provider : 'openai';
  const provider = LLM_PROVIDERS[providerKey] || LLM_PROVIDERS.openai;
  const selectedModel = preferredModel(providerKey, ai.model || '');
  const templates = {
    feishu: `
      <label>App ID<input data-field="appId" value="${escapeHtml(state?.settings?.appId || '')}" placeholder="cli_xxx" /></label>
      <label>App Secret<input data-field="appSecret" type="password" value="${escapeHtml(state?.settings?.appSecret || '')}" placeholder="只保存在本机 SQLite" /></label>
      <label>飞书加密口令<input data-field="feishuPassphrase" type="password" value="${escapeHtml(state?.settings?.feishuPassphrase || '')}" placeholder="统一用于上传、取回和目录清单同步，至少 8 位" /></label>
      <label>飞书文件夹 Token<input data-field="folderToken" value="${escapeHtml(state?.settings?.folderToken || 'root')}" placeholder="root 或 fldcn..." /></label>
      <label>OAuth 回调地址（须与飞书后台完全一致）
        <div class="inlineControl">
          <input id="feishuRedirectUriField" readonly value="${escapeHtml(state?.redirectUri || 'http://127.0.0.1:37891/feishu/oauth/callback')}" />
          <button type="button" class="small" data-action="copy-redirect-uri" data-icon="copy">复制</button>
        </div>
      </label>
      <ol class="feishuSteps muted">
        <li>点击「打开安全设置」→ 左侧 <strong>开发配置 → 安全设置</strong></li>
        <li>在 <strong>重定向 URL</strong> 中粘贴上方回调地址 → 保存</li>
        <li>回到本应用，先点「保存配置」，再点顶栏「未登录飞书」登录</li>
      </ol>
      <div class="buttonRow">
        <button type="button" class="small" data-action="open-feishu-safe" data-icon="external">打开安全设置</button>
        <button type="button" class="small" data-action="copy-redirect-uri" data-icon="copy">复制回调地址</button>
      </div>
      <p class="muted">报错 <strong>20029</strong>：说明重定向 URL 未登记或与 App ID 不匹配。飞书错误页上的「前往」只会打开后台首页，<strong>不会自动帮你填 URL</strong>，请按上面 3 步手动添加。</p>
      <p class="muted">云盘同步与知识库 Wiki 检索共用飞书登录；Wiki 需在开放平台开通 <code>wiki:wiki:readonly</code> 后重新授权。</p>
      <button type="button" class="full" data-action="test-feishu-sync" data-icon="activity">测试同步文本到飞书</button>
      <p class="muted">将加密上传一小段测试文本并回读校验；通过后会尝试删除云端测试文件，不会写入本地同步记录。</p>
    `,
    feishuWiki: `
      <p class="muted">未配置 Obsidian 或自定义知识库时，将优先检索你已可见的飞书 Wiki 文档。请先在顶栏登录飞书。</p>
      <label class="checkLine"><input data-field="enabled" type="checkbox" ${fw.enabled !== false ? 'checked' : ''} />启用飞书知识库检索</label>
      <label>知识空间 ID（可选）<input data-field="spaceId" value="${escapeHtml(fw.spaceId || '')}" placeholder="留空则搜索全部可见 Wiki" /></label>
    `,
    llm: `
      <label>模型供应商<select data-field="provider" id="llmProviderSelect">${llmProviderOptions(providerKey)}</select></label>
      <label>Base URL<input data-field="baseUrl" id="llmBaseUrlDynamic" value="${escapeHtml(ai.baseUrl || provider.baseUrl || '')}" placeholder="https://api.openai.com/v1" /></label>
      <label>API Key<input data-field="apiKey" type="password" value="${escapeHtml(ai.apiKey || '')}" placeholder="sk-..." /></label>
      <label>
        模型
        <div class="inlineControl">
          <select data-field="model" id="llmModelSelect">${llmModelOptions(providerKey, selectedModel)}</select>
          <button type="button" class="small" data-action="refresh-models" data-icon="sync">刷新</button>
        </div>
      </label>
      <label>手动模型名<input data-field="modelOverride" value="" placeholder="列表没有时，在这里输入模型名" /></label>
      <label>Temperature<input data-field="temperature" value="${escapeHtml(ai.temperature ?? 0.2)}" /></label>
      <button type="button" class="full" data-action="test-model" data-icon="activity">测试模型连接</button>
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
      <p class="muted"><strong>方案 A（本机）</strong>：安装 Obsidian → 社区插件「Local REST API」→ 保持库打开 → Base URL 填 <code>${escapeHtml(obMeta.localRestUrl || 'https://127.0.0.1:27124')}</code>。</p>
      <p class="muted"><strong>方案 B（远程）</strong>：在服务器/NAS 暴露 REST API（或 HTTPS 反代），填写可访问地址与 Token。</p>
      <label>名称<input data-field="name" placeholder="我的 Obsidian Vault" /></label>
      <label>Base URL<input data-field="baseUrl" value="${escapeHtml(obMeta.localRestUrl || 'https://127.0.0.1:27124')}" placeholder="https://127.0.0.1:27124 或 https://nas.example.com/obsidian" /></label>
      <label>API Key<input data-field="apiKey" type="password" placeholder="Local REST API token" /></label>
      <label class="checkLine"><input data-field="insecureTls" type="checkbox" checked />允许自签名 HTTPS 证书（仅信任环境使用）</label>
    `,
    recovery: `
      <label>绑定手机<input data-field="phone" value="${escapeHtml(state?.auth?.user?.phone || '')}" placeholder="用于找回身份" /></label>
      <label>恢复邮箱<input data-field="recoveryEmail" value="${escapeHtml(state?.auth?.user?.recoveryEmail || '')}" placeholder="you@example.com" /></label>
      <hr class="divider" />
      <label>当前本地密码<input data-field="currentPassword" type="password" placeholder="修改密码时填写" /></label>
      <label>新本地密码<input data-field="newPassword" type="password" placeholder="至少 8 位；留空则不修改" /></label>
    `,
  };
  elements.dynamicConfigFields.innerHTML = templates[type] || '';
}

function readConfigForm() {
  const data = {};
  for (const input of elements.dynamicConfigFields.querySelectorAll('[data-field]')) {
    data[input.dataset.field] = input.type === 'checkbox' ? input.checked : input.value;
  }
  if (data.modelOverride && data.modelOverride.trim()) data.model = data.modelOverride.trim();
  delete data.modelOverride;
  return data;
}

function renderSources() {
  elements.kbSources.innerHTML = kbSourcesDraft.length
    ? kbSourcesDraft.map((source) => `
      <div class="sourceItem">
        <div><strong>${escapeHtml(source.name)}</strong><span>${escapeHtml(source.endpoint)}</span></div>
        ${iconButton('trash', '删除', `data-source-kind="kb" data-source-id="${source.id}"`)}
      </div>
    `).join('')
    : '<div class="muted">尚未添加知识库</div>';
  elements.vectorSources.innerHTML = vectorSourcesDraft.length
    ? vectorSourcesDraft.map((source) => `
      <div class="sourceItem">
        <div><strong>${escapeHtml(source.name)}</strong><span>${escapeHtml(source.collection || source.endpoint)}</span></div>
        ${iconButton('trash', '删除', `data-source-kind="vector" data-source-id="${source.id}"`)}
      </div>
    `).join('')
    : '<div class="muted">尚未添加向量库</div>';
  elements.obsidianSources.innerHTML = obsidianSourcesDraft.length
    ? obsidianSourcesDraft.map((source) => `
      <div class="sourceItem">
        <div><strong>${escapeHtml(source.name)}</strong><span>${escapeHtml(source.baseUrl)}</span></div>
        ${iconButton('trash', '删除', `data-source-kind="obsidian" data-source-id="${source.id}"`)}
      </div>
    `).join('')
    : '<div class="muted">尚未添加 Obsidian</div>';
}

function knowledgeMessageHtml(log) {
  const evidence = (log.evidence || []).filter((item) => !item.isHint).slice(0, 5);
  return `
    <div class="chatMessage userMessage">
      <div class="chatAvatar userAvatar">我</div>
      <div class="chatStack">
        <div class="chatRole">我</div>
        <div class="chatBubble">
          <p>${escapeHtml(log.question)}</p>
        </div>
      </div>
    </div>
    <div class="chatMessage assistantMessage">
      <div class="chatAvatar assistantAvatar">VM</div>
      <div class="chatStack">
        <div class="chatRole">VaultMind</div>
        <div class="chatBubble">
          <pre>${escapeHtml(log.answer)}</pre>
          ${evidence.length ? `
            <div class="evidenceList">
              ${evidence.map((item) => {
                const canOpen = item.type === 'local' && item.assetId;
                const fileMeta = evidenceFileMeta(item);
                return `
                <div class="evidenceItem">
                  ${evidenceTypeIcon(fileMeta)}
                  <div class="evidenceHeader">
                    <div class="evidenceTitle">
                      <span>${escapeHtml(item.source)} · ${escapeHtml(item.title)}</span>
                      <small>${escapeHtml(fileMeta.label)} · ${escapeHtml(fileMeta.ext)}</small>
                    </div>
                    ${canOpen ? iconButton('external', '打开', `class="evidenceOpen" data-evidence-action="open" data-asset-id="${escapeHtml(item.assetId)}" data-source-table="${escapeHtml(item.sourceTable || '')}"`) : ''}
                  </div>
                  <p>${escapeHtml(item.content || '').slice(0, 260)}</p>
                </div>
              `; }).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    elements.queryResult.scrollTop = elements.queryResult.scrollHeight;
  });
}

function renderKnowledgeChat(extraHtml = '') {
  if (state?.auth?.isLoggedIn && chatUserId !== state.auth.user?.id && !chatInitializing) {
    chatInitializing = initializeChatMessages()
      .then(() => renderKnowledgeChat())
      .catch((error) => showNotice(`读取本地聊天记录失败：${error.message || error}`, true))
      .finally(() => { chatInitializing = null; });
  }
  const logs = chatMessages;
  if (!logs.length && !extraHtml) {
    elements.queryResult.innerHTML = '<div class="emptyChat">检索和回答会显示在这里。</div>';
    return;
  }
  const loader = chatHasMore
    ? '<div class="chatLoader">向上滚动加载更早对话</div>'
    : (logs.length > CHAT_PAGE_SIZE - 1 ? '<div class="chatLoader">已显示全部本地对话</div>' : '');
  elements.queryResult.innerHTML = `${loader}${logs.map(knowledgeMessageHtml).join('')}${extraHtml}`;
  if (extraHtml || elements.queryResult.scrollTop < 4) scrollChatToBottom();
}

async function loadOlderChatMessages() {
  if (!chatHasMore || chatLoading || chatOldestCreatedAt === null) return;
  const previousHeight = elements.queryResult.scrollHeight;
  const previousTop = elements.queryResult.scrollTop;
  await loadChatPage({ beforeCreatedAt: chatOldestCreatedAt, prepend: true });
  renderKnowledgeChat();
  requestAnimationFrame(() => {
    elements.queryResult.scrollTop = elements.queryResult.scrollHeight - previousHeight + previousTop;
  });
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
        ${iconButton('download', '取回入库', `data-record-action="download" data-id="${record.id}"`)}
        ${iconButton('external', '飞书', `data-record-action="open" data-id="${record.id}"`)}
        ${iconButton('trash', '移除', `data-record-action="forget" data-id="${record.id}"`)}
      </div>
    `;
    elements.records.appendChild(row);
  }
}

function recordHistoryHtml(record) {
  const fileMeta = record.kind === 'text'
    ? { ext: 'TXT', type: 'generic', label: '文本' }
    : evidenceFileMeta({ title: record.fileName, content: record.localPath || '', kind: record.kind });
  return `
    <div class="historyItem">
      ${evidenceTypeIcon(fileMeta)}
      <div>
        <strong>${escapeHtml(record.fileName)}</strong>
        <span>${escapeHtml(fileMeta.label)} · ${escapeHtml(fileMeta.ext)} · ${formatBytes(record.size)}</span>
        <span>${escapeHtml(record.token || '')}</span>
      </div>
    </div>
  `;
}

function itemHistoryHtml(item) {
  const typeLabelText = item.kind === 'file'
    ? '文件'
    : (item.kind === 'web' ? '网页' : (item.kind === 'video' ? '视频' : '文本'));
  return `
    <div class="historyItem">
      <div class="historyIcon">${icon(item.kind === 'file' ? 'file' : 'library')}</div>
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(typeLabelText)} · ${formatBytes(item.size)}</span>
        <span>${item.scope === 'group' ? '用户组内容' : '个人内容'}${item.remoteOnly ? ' · 待下载' : ''}</span>
      </div>
    </div>
  `;
}

function renderAddHistory() {
  if (!elements.addHistory) return;
  const recentItems = (state.items || []).slice(0, 8);
  const recentRecords = (state.records || []).slice(0, 8);
  elements.addHistory.innerHTML = `
    <div class="historyColumn">
      ${recentItems.length ? recentItems.map(itemHistoryHtml).join('') : '<div class="empty compactEmpty">还没有本地添加记录。</div>'}
    </div>
    <div class="historyColumn">
      ${recentRecords.length ? recentRecords.map(recordHistoryHtml).join('') : '<div class="empty compactEmpty">还没有飞书同步记录。</div>'}
    </div>
  `;
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
            ${iconButton('download', '下载回本地', `data-item-action="save" data-id="${item.id}"`)}
            ${iconButton('trash', '移除', `data-item-action="forget" data-id="${item.id}"`)}
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
            ${iconButton('external', '打开', `data-item-action="open-url" data-url="${escapeHtml(item.url || '')}"`)}
            ${iconButton('unlock', '解锁', `data-item-action="unlock" data-id="${item.id}"`)}
            ${iconButton('trash', '移除', `data-item-action="forget" data-id="${item.id}"`)}
          </div>
        </div>
        <div class="pathLine">${escapeHtml(item.url || '链接已加密，解锁后查看')}</div>
        <pre id="itemText-${item.id}" class="maskedText">${escapeHtml(item.maskedText)}</pre>
      `;
    } else {
      const scopeBadge = item.scope === 'group' ? '<span class="scopeBadge">组</span>' : '';
      const remoteBadge = item.remoteOnly ? '<span class="scopeBadge warn">待下载</span>' : '';
      card.innerHTML = `
        <div class="itemHeader">
          <div>
            <strong>${escapeHtml(item.name)}</strong> ${scopeBadge} ${remoteBadge}
            <div class="muted">文本 · ${formatBytes(item.size)}</div>
          </div>
          <div class="actions">
            ${iconButton('unlock', '解锁查看', `data-item-action="unlock" data-id="${item.id}"`)}
            ${item.scope === 'personal' && item.localOnly ? iconButton('copy', '复制到组', `data-item-action="copy-group" data-id="${item.id}"`) : ''}
            ${iconButton('trash', '移除', `data-item-action="forget" data-id="${item.id}"`)}
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
  await initializeChatMessages();
  render();
}

async function reauthorizeLocalSession(source = 'add') {
  const email = state?.auth?.user?.email;
  const wrap = source === 'library' ? elements.libraryReauthWrap : elements.localReauthWrap;
  const input = source === 'library' ? elements.libraryLocalPassword : elements.addLocalPassword;
  const password = input?.value || '';
  if (!email) throw new Error('请先登录本地账号');
  if (!password) {
    if (wrap) wrap.classList.remove('hidden');
    input?.focus();
    throw new Error(source === 'library'
      ? '本地会话需要重新授权，请在内容库搜索框下方填写本地密码后再试。'
      : '本地会话已过期，请在同步选项里填写本地密码后再次保存。');
  }
  const next = await api.loginLocal({ email, password });
  state = next.state || next;
  input.value = '';
  if (wrap) wrap.classList.add('hidden');
  await initializeChatMessages();
  return state;
}

async function saveAddContentOnce({ saveLocal, syncFeishu, syncManifest, scope }) {
  const result = { upload: null };
  if (saveLocal) {
    state = await api.createLibraryItem({
      kind: uploadMode,
      title: elements.manualTitle.value,
      url: elements.manualUrl.value,
      content: elements.manualText.value,
      ...scope,
    });
  }
  if (syncFeishu) {
    if (uploadMode === 'file') {
      activeUploadId = createUploadId();
      ensureUploadProgressListener();
      updateUploadProgress({
        uploadId: activeUploadId,
        phase: 'start',
        total: selectedFiles.length,
        completed: 0,
      });
      const uploaded = await api.uploadFiles({ filePaths: selectedFiles, uploadId: activeUploadId, ...scope });
      result.upload = uploaded;
      state = uploaded.state;
    } else {
      const { name, text } = addFormFeishuText();
      const uploaded = await api.uploadText({ name, text, ...scope });
      result.upload = uploaded;
      state = uploaded.state;
    }
  }
  if (syncManifest) {
    const synced = await api.syncManifest(scope);
    state = synced.state || synced;
  }
  return result;
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
    state = next.state || next;
    elements.localPassword.value = '';
    await initializeChatMessages();
    const accepted = next.acceptedInvites;
    if (next.recoveryCode) {
      setLoginHint(`注册成功。请保存恢复码：${next.recoveryCode}`);
    } else if (accepted?.length) {
      setLoginHint(`已自动加入 ${accepted.length} 个用户组`);
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

elements.noticeClose.addEventListener('click', dismissNotice);
elements.queryResult.addEventListener('scroll', () => {
  if (elements.queryResult.scrollTop <= 12) {
    loadOlderChatMessages().catch((error) => showNotice(`加载历史对话失败：${error.message || error}`, true));
  }
});
elements.queryResult.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-evidence-action="open"]');
  if (!button) return;
  const result = await run(() => api.openAsset({
    assetId: button.dataset.assetId,
    sourceTable: button.dataset.sourceTable,
  }), '已打开匹配文件');
  if (result) button.blur();
});

for (const button of [elements.navLibrary, elements.navGroups, elements.navProjects, elements.navAdd, elements.navConfig]) {
  button.addEventListener('click', () => {
    activeView = button.dataset.view;
    renderActiveView();
  });
}

elements.contextSelect.addEventListener('change', async () => {
  const value = elements.contextSelect.value;
  const payload = value === 'personal'
    ? { scope: 'personal' }
    : { scope: 'group', groupId: value.replace('group:', '') };
  const next = await run(() => api.setContext(payload), '已切换工作上下文');
  if (next) {
    state = next;
    render();
  }
});

elements.createGroupBtn.addEventListener('click', async () => {
  const next = await run(() => api.createGroup({
    name: elements.newGroupName.value,
    feishuFolderToken: elements.newGroupFolder.value,
  }), '用户组已创建');
  if (next) {
    state = next;
    elements.newGroupName.value = '';
    elements.newGroupFolder.value = '';
    render();
  }
});

elements.inviteGroupBtn.addEventListener('click', async () => {
  const result = await run(() => api.inviteToGroup({
    groupId: elements.inviteGroupSelect.value,
    email: elements.inviteEmail.value,
    role: elements.inviteRole.value,
  }), '邀请已处理');
  if (result) {
    state = result.state;
    elements.inviteEmail.value = '';
    if (result.pending) {
      showNotice(result.userExists
        ? `已向 ${result.email} 发送邀请，对方登录后将自动加入`
        : `已记录待注册邀请：${result.email}`);
    }
    render();
  }
});

elements.groupsList.addEventListener('click', async (event) => {
  const switchBtn = event.target.closest('button[data-group-switch]');
  if (switchBtn) {
    const next = await run(() => api.setContext({ scope: 'group', groupId: switchBtn.dataset.groupSwitch }), '已切换到该组');
    if (next) { state = next; activeView = 'library'; render(); }
    return;
  }
  const membersBtn = event.target.closest('button[data-group-members]');
  if (membersBtn) {
    const members = await run(() => api.listGroupMembers(membersBtn.dataset.groupMembers));
    if (members) {
      const canManage = (state.groups || []).find((g) => g.id === membersBtn.dataset.groupMembers);
      const isAdmin = canManage && ['owner', 'admin'].includes(canManage.role);
      elements.groupMembers.innerHTML = members.map((m) => `
        <div class="sourceItem">
          <div><strong>${escapeHtml(m.username)}</strong><span>${escapeHtml(m.email)} · ${escapeHtml(m.role)}</span></div>
          ${isAdmin && m.role !== 'owner' ? `
            <div class="actions">
              ${iconButton('trash', '移除', `data-member-remove="${membersBtn.dataset.groupMembers}" data-user-id="${m.id}"`)}
              ${iconButton('key', '设管理员', `data-member-role="${membersBtn.dataset.groupMembers}" data-user-id="${m.id}" data-role="admin"`)}
            </div>
          ` : ''}
        </div>
      `).join('');
    }
    return;
  }
  const leaveBtn = event.target.closest('button[data-group-leave]');
  if (leaveBtn) {
    const next = await run(() => api.leaveGroup(leaveBtn.dataset.groupLeave), '已离开用户组');
    if (next) { state = next; render(); }
    return;
  }
  const rotateBtn = event.target.closest('button[data-group-rotate]');
  if (rotateBtn) {
    const result = await run(() => api.rotateGroupKey(rotateBtn.dataset.groupRotate), '组密钥已轮换');
    if (result) {
      state = result.state;
      if (result.needsReinvite?.length) {
        showNotice(`已轮换密钥，${result.needsReinvite.length} 名成员需重新邀请`, true);
      }
      render();
    }
  }
});

elements.groupMembers.addEventListener('click', async (event) => {
  const removeBtn = event.target.closest('button[data-member-remove]');
  if (removeBtn) {
    const next = await run(() => api.removeGroupMember({
      groupId: removeBtn.dataset.memberRemove,
      userId: removeBtn.dataset.userId,
    }), '成员已移除');
    if (next) { state = next; render(); }
    return;
  }
  const roleBtn = event.target.closest('button[data-member-role]');
  if (roleBtn) {
    const next = await run(() => api.updateMemberRole({
      groupId: roleBtn.dataset.memberRole,
      userId: roleBtn.dataset.userId,
      role: roleBtn.dataset.role,
    }), '角色已更新');
    if (next) { state = next; render(); }
  }
});

elements.acceptInvitesBtn.addEventListener('click', async () => {
  const result = await run(() => api.acceptPendingInvites(), '已处理邀请');
  if (result) {
    state = result.state;
    if (result.accepted?.length) showNotice(`已加入 ${result.accepted.length} 个用户组`);
    render();
  }
});

elements.runGlobalSearch.addEventListener('click', async () => {
  const q = elements.globalSearch.value.trim();
  if (!q) return;
  const result = await run(() => api.search({ query: q }));
  if (result) {
    state = result.state;
    elements.searchResults.innerHTML = (result.results || []).map((r) => `
      <div class="evidenceItem"><span>${escapeHtml(r.source)} · ${escapeHtml(r.title)}</span><p>${escapeHtml(r.content || '')}</p></div>
    `).join('') || '<div class="muted">无匹配结果</div>';
    render();
  }
});

elements.globalSearch.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') elements.runGlobalSearch.click();
});

function hasFeishuPassphrase() {
  return Boolean(state?.settings?.hasFeishuPassphrase);
}

function requireConfiguredFeishuPassphrase() {
  if (hasFeishuPassphrase()) return true;
  showNotice('请先在「配置 → 飞书同步」设置飞书加密口令', true);
  return false;
}

function manifestPayload() {
  return currentScopePayload();
}

elements.syncManifest.addEventListener('click', async () => {
  if (!requireConfiguredFeishuPassphrase()) return;
  const next = await run(() => api.syncManifest(manifestPayload()), '目录清单已上传到飞书');
  if (next?.state) { state = next.state; render(); }
});

elements.pullManifest.addEventListener('click', async () => {
  if (!requireConfiguredFeishuPassphrase()) return;
  const next = await run(() => api.pullManifest(manifestPayload()), '已从飞书拉取并合并清单');
  if (next?.state) {
    state = next.state;
    if (next.stats) showNotice(`合并完成：新增 ${next.stats.addedItems} 条，更新 ${next.stats.updatedItems} 条`);
    render();
  }
});

elements.fullSync.addEventListener('click', async () => {
  if (!requireConfiguredFeishuPassphrase()) return;
  const next = await run(() => api.fullSync(manifestPayload()), '完整同步已完成');
  if (next?.state) {
    state = next.state;
    if (next.pullError) showNotice(`拉取: ${next.pullError}`, true);
    if (next.pushError) showNotice(`上传: ${next.pushError}`, true);
    render();
  }
});

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
    ...currentScopePayload(),
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
    ...currentScopePayload(),
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
  refreshedModels = [];
  renderDynamicConfigFields();
});

elements.dynamicConfigFields.addEventListener('change', (event) => {
  const target = event.target;
  if (target && target.id === 'llmProviderSelect') {
    const provider = LLM_PROVIDERS[target.value] || LLM_PROVIDERS.openai;
    const baseUrl = elements.dynamicConfigFields.querySelector('#llmBaseUrlDynamic');
    if (baseUrl) baseUrl.value = provider.baseUrl || '';
    refreshedModels = [];
    const modelSelect = elements.dynamicConfigFields.querySelector('#llmModelSelect');
    if (modelSelect) modelSelect.innerHTML = llmModelOptions(target.value, provider.models[0] || '');
  }
});

elements.dynamicConfigFields.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action="refresh-models"]');
  if (!button) return;
  const data = readConfigForm();
  if (!data.baseUrl) {
    showNotice('请先选择供应商或填写 Base URL', true);
    return;
  }
  setBusy(true);
  clearNotice();
  try {
    const result = await api.listModels(data);
    refreshedModels = Array.isArray(result.models) ? result.models : [];
    if (!refreshedModels.length) throw new Error('远程接口没有返回模型列表');
    showNotice(`模型列表已刷新：${refreshedModels.length} 个`);
  } catch (error) {
    const provider = LLM_PROVIDERS[data.provider] || LLM_PROVIDERS.openai;
    refreshedModels = provider.models || [];
    showNotice(`远程刷新失败，已切换为 ${provider.label} 的内置最新模型列表。原因：${error && error.message ? error.message : String(error)}`, true);
  } finally {
    const selected = refreshedModels[0] || data.model;
    const ai = state.knowledgeCenter?.aiProfile || {};
    state = {
      ...state,
      knowledgeCenter: {
        ...state.knowledgeCenter,
        aiProfile: { ...ai, ...data, model: selected },
      },
    };
    renderDynamicConfigFields();
    setBusy(false);
  }
});

elements.dynamicConfigFields.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action="test-model"]');
  if (!button) return;
  const data = readConfigForm();
  if (!data.baseUrl || !data.model) {
    showNotice('请先选择供应商、Base URL 和模型', true);
    return;
  }
  const result = await run(() => api.testModel(data));
  if (result && result.ok) {
    showNotice(`模型连接正常：${result.reply || '测试通过'}`);
  }
});

elements.dynamicConfigFields.addEventListener('click', async (event) => {
  const copyBtn = event.target.closest('button[data-action="copy-redirect-uri"]');
  if (copyBtn) {
    const field = elements.dynamicConfigFields.querySelector('#feishuRedirectUriField')
      || document.querySelector('#redirectUri');
    const text = field?.value || state?.redirectUri || 'http://127.0.0.1:37891/feishu/oauth/callback';
    try {
      await navigator.clipboard.writeText(text);
      showNotice('回调地址已复制，请粘贴到飞书开放平台「重定向 URL」');
    } catch {
      showNotice(`请手动复制：${text}`, true);
    }
    return;
  }
  const safeBtn = event.target.closest('button[data-action="open-feishu-safe"]');
  if (safeBtn) {
    await ensureFeishuSettingsSaved();
    try {
      const info = await api.openFeishuRedirectSettings();
      showNotice(`已打开应用 ${info.appId} 的安全设置。请把回调地址粘贴到「重定向 URL」：${info.redirectUri}`);
    } catch {
      await api.openExternal(FEISHU_APP_CREDENTIALS_URL);
      showNotice('请先保存 App ID，再在安全设置 → 重定向 URL 中粘贴回调地址', true);
    }
    return;
  }
  const button = event.target.closest('button[data-action="test-feishu-sync"]');
  if (!button) return;
  const data = readConfigForm();
  if (!data.feishuPassphrase || data.feishuPassphrase.length < 8) {
    showNotice('请先填写至少 8 位的飞书加密口令', true);
    return;
  }
  if (!state.isFeishuLoggedIn) {
    showNotice('请先保存配置并登录飞书', true);
    return;
  }
  await runFeishuSyncTest(data.feishuPassphrase, {
    appId: data.appId,
    appSecret: data.appSecret,
    folderToken: data.folderToken,
  });
});

elements.saveConfigDynamic.addEventListener('click', async () => {
  const type = elements.configType.value;
  const data = readConfigForm();
  let next = null;
  if (type === 'feishu') {
    next = await run(() => api.saveSettings({ ...data, redirectPort: 37891 }), '飞书配置已保存');
  } else if (type === 'feishuWiki') {
    next = await run(() => api.saveFeishuWikiSettings({
      enabled: data.enabled !== false,
      spaceId: data.spaceId || '',
    }), '飞书知识库设置已保存');
  } else if (type === 'llm') {
    next = await run(() => api.saveAiProfile(data), '大模型配置已保存');
  } else if (type === 'knowledge') {
    next = await run(() => api.saveKnowledgeSources([{ id: cryptoRandomId(), enabled: true, ...data }, ...kbSourcesDraft]), '知识库配置已保存');
  } else if (type === 'vector') {
    next = await run(() => api.saveVectorSources([{ id: cryptoRandomId(), enabled: true, ...data }, ...vectorSourcesDraft]), '向量库配置已保存');
  } else if (type === 'obsidian') {
    next = await run(() => api.saveObsidianSources([{ id: cryptoRandomId(), enabled: true, ...data }, ...obsidianSourcesDraft]), 'Obsidian 配置已保存');
  } else if (type === 'recovery') {
    next = await run(() => api.updateRecovery({
      phone: data.phone,
      recoveryEmail: data.recoveryEmail,
    }), '恢复资料已保存');
    if (next && data.newPassword) {
      next = await run(() => api.changeLocalPassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }), '本地密码已修改');
    }
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

function addFormFeishuText() {
  const title = elements.manualTitle.value.trim();
  if (uploadMode === 'web' || uploadMode === 'video') {
    return { name: title, text: `${title}\n${elements.manualUrl.value.trim()}` };
  }
  return { name: title, text: elements.manualText.value };
}

elements.optSyncFeishu?.addEventListener('change', renderAddSyncOptions);
elements.optSyncManifest?.addEventListener('change', () => {
  if (elements.optSyncManifest.checked) elements.optSyncFeishu.checked = true;
  renderAddSyncOptions();
});

elements.submitAdd?.addEventListener('click', async () => {
  const saveLocal = Boolean(elements.optSaveLocal?.checked) && uploadMode !== 'file';
  const syncFeishu = Boolean(elements.optSyncFeishu?.checked);
  const syncManifest = Boolean(elements.optSyncManifest?.checked);

  if (uploadMode === 'file') {
    if (!selectedFiles.length) {
      showNotice('请选择至少一个文件', true);
      return;
    }
    if (!syncFeishu) {
      showNotice('文件类型请勾选「同步到飞书云盘」', true);
      return;
    }
  } else {
    if (!elements.manualTitle.value.trim()) {
      showNotice('请输入标题', true);
      return;
    }
    if (!saveLocal && !syncFeishu) {
      showNotice('请至少勾选一项：保存到本地 或 同步到飞书', true);
      return;
    }
  }

  if (syncFeishu || syncManifest) {
    if (!state.isFeishuLoggedIn) {
      showNotice('请先在配置中心登录飞书', true);
      return;
    }
    if (!requireConfiguredFeishuPassphrase()) return;
  }

  setBusy(true);
  clearNotice();
  const scope = currentScopePayload();
  try {
    let saveResult = null;
    try {
      saveResult = await saveAddContentOnce({ saveLocal, syncFeishu, syncManifest, scope });
    } catch (error) {
      const msg = error && error.message ? error.message : String(error);
      if (!msg.includes('重新登录本地')) throw error;
      await reauthorizeLocalSession();
      saveResult = await saveAddContentOnce({ saveLocal, syncFeishu, syncManifest, scope });
    }
    const failures = Array.isArray(saveResult?.upload?.failures) ? saveResult.upload.failures : [];
    const uploadedCount = Array.isArray(saveResult?.upload?.records) ? saveResult.upload.records.length : 0;
    if (failures.length) {
      selectedFiles = failures.map((failure) => failure.path).filter(Boolean);
      wechatFilesDraft = wechatFilesDraft
        .filter((file) => selectedFiles.includes(file.path))
        .map((file) => ({ ...file, selected: true }));
      showNotice(`已同步 ${uploadedCount} 个文件，${failures.length} 个失败；失败项已保留，可直接重试。`, true, 9000);
      render();
      return;
    }
    showNotice('保存完成');
    elements.manualTitle.value = '';
    elements.manualUrl.value = '';
    elements.manualText.value = '';
    selectedFiles = [];
    wechatFilesDraft = [];
    activeView = 'library';
    render();
    resetUploadProgress();
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    if (msg.includes('飞书登录')) {
      try {
        state = await api.getState();
        render();
      } catch {
        // keep original upload error visible
      }
    }
    showNotice(msg, true);
  } finally {
    setBusy(false);
  }
});

elements.saveSettings.addEventListener('click', async () => {
  const next = await run(() => api.saveSettings({
    appId: elements.appId.value,
    appSecret: elements.appSecret.value,
    feishuPassphrase: elements.feishuPassphrase?.value || '',
    folderToken: elements.folderToken.value,
    redirectPort: 37891,
  }), '配置已保存');
  if (next) {
    state = next;
    render();
  }
});

async function runFeishuSyncTest(passphrase = '', settingsOverride = {}) {
  const passphraseForTest = passphrase || (hasFeishuPassphrase() ? '********' : '');
  if (!passphraseForTest || passphraseForTest.length < 8) {
    showNotice('请先在「配置 → 飞书同步」设置飞书加密口令', true);
    return;
  }
  if (!state.isFeishuLoggedIn) {
    showNotice('请先保存配置并登录飞书', true);
    return;
  }
  const result = await run(() => api.testFeishuSync({
    appId: settingsOverride.appId ?? elements.appId?.value,
    appSecret: settingsOverride.appSecret ?? elements.appSecret?.value,
    folderToken: settingsOverride.folderToken ?? elements.folderToken?.value,
    passphrase: passphraseForTest,
    context: state.context,
  }));
  if (result && result.ok) {
    showNotice(result.message || '飞书同步测试通过');
  }
}

elements.testFeishuSync?.addEventListener('click', async () => {
  await runFeishuSyncTest(elements.feishuPassphrase?.value || '');
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

async function submitKnowledgeQuestion() {
  const question = elements.questionInput.value.trim();
  if (!question) {
    showNotice('请输入检索问题', true);
    return;
  }
  const pendingHtml = `
    <div class="chatMessage userMessage">
      <div class="chatAvatar userAvatar">我</div>
      <div class="chatStack">
        <div class="chatRole">我</div>
        <div class="chatBubble">
          <p>${escapeHtml(question)}</p>
        </div>
      </div>
    </div>
    <div class="chatMessage assistantMessage">
      <div class="chatAvatar assistantAvatar">VM</div>
      <div class="chatStack">
        <div class="chatRole">VaultMind</div>
        <div class="chatBubble pendingBubble">
          <p>正在检索本地库、飞书知识库与其它来源...</p>
        </div>
      </div>
    </div>
  `;
  renderKnowledgeChat(pendingHtml);
  elements.questionInput.value = '';
  const result = await run(() => api.queryKnowledgeCenter({ question, context: state.context }), '检索完成');
  if (result) {
    state = result.state;
    const hint = setupHintMessage(result);
    if (hint) showNotice(hint, false, 5000);
    const saved = await saveChatMessage(result);
    if (saved && chatUserId === saved.userId) {
      chatMessages = [...chatMessages.filter((item) => item.id !== saved.id), saved]
        .sort((a, b) => a.createdAtMs - b.createdAtMs)
        .slice(-CHAT_PAGE_SIZE);
      chatOldestCreatedAt = chatMessages.length ? chatMessages[0].createdAtMs : null;
      chatHasMore = chatHasMore || chatMessages.length === CHAT_PAGE_SIZE;
    }
    render();
  } else {
    elements.questionInput.value = question;
    renderKnowledgeChat();
  }
}

elements.runKnowledgeQuery.addEventListener('click', submitKnowledgeQuestion);

elements.questionInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  if (event.altKey) return;
  event.preventDefault();
  elements.runKnowledgeQuery.click();
});

elements.login.addEventListener('click', async () => {
  setBusy(true);
  clearNotice();
  try {
    await startFeishuLogin();
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    showNotice(message, true);
  } finally {
    setBusy(false);
  }
});

elements.loginBadge.addEventListener('click', async () => {
  if (state.isFeishuLoggedIn) {
    showNotice('飞书已登录。如需退出，请到「配置 → 飞书同步」点击「退出飞书」。');
    return;
  }
  setBusy(true);
  clearNotice();
  try {
    await startFeishuLogin();
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    if (message.includes('已关闭') || message.includes('已取消')) {
      showNotice(message, true);
      return;
    }
    if (message.includes('EADDRINUSE') || message.includes('已被占用')) {
      showNotice(message, true);
      return;
    }
    if (message.includes('20029') || message.includes('redirect_uri') || message.includes('重定向')) {
      activeView = 'config';
      renderActiveView();
      openConfigForm('feishu');
      showNotice('飞书 20029：请按配置页 3 步操作——打开安全设置 → 粘贴回调地址 → 保存后再登录。错误页的「前往」不会自动配置。', true);
      return;
    }
    activeView = 'config';
    renderActiveView();
    openConfigForm('feishu');
    showNotice(`${message}。请确认飞书回调 URL 已配置并保存 App 信息后重试登录。`, true);
  } finally {
    setBusy(false);
  }
});

elements.logoutLocal.addEventListener('click', async () => {
  const next = await run(() => api.logoutLocal(), '已退出本地账号');
  if (next) {
    state = next;
    chatUserId = '';
    chatMessages = [];
    activeView = 'library';
    render();
  }
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
    wechatFilesDraft = [];
    render();
  }
});

elements.scanWechatFiles?.addEventListener('click', async () => {
  const result = await run(() => api.scanWechatAttachments());
  if (result && !result.canceled) {
    wechatFilesDraft = (result.files || []).map((file) => ({ ...file, selected: true }));
    syncSelectedFilesFromWechatDraft();
    if (!wechatFilesDraft.length) {
      showNotice('未自动扫描到微信附件。请确认微信已下载附件，或微信文件目录不在默认位置。', true);
    } else {
      showNotice(`已从 ${result.roots?.length || 0} 个微信目录扫描到 ${wechatFilesDraft.length} 个附件，可取消勾选后保存同步。`);
    }
    render();
  }
});

elements.wechatFiles?.addEventListener('change', (event) => {
  const input = event.target.closest('input[data-wechat-file-index]');
  if (!input) return;
  const index = Number(input.dataset.wechatFileIndex);
  if (!Number.isInteger(index) || !wechatFilesDraft[index]) return;
  wechatFilesDraft[index].selected = input.checked;
  syncSelectedFilesFromWechatDraft();
  render();
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

  if (!requireConfiguredFeishuPassphrase()) return;
  const next = await run(() => api.downloadRecord({
    recordId: record.id,
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
  if (button.dataset.itemAction === 'forget') {
    const next = await run(() => api.forgetItem(itemId), '本地内容已移除');
    if (next) {
      state = next;
      render();
    }
    return;
  }

  if (button.dataset.itemAction === 'copy-group') {
    const groupId = state.context?.groupId || (state.groups?.[0]?.id);
    if (!groupId) {
      showNotice('请先创建或切换到目标用户组', true);
      return;
    }
    const next = await run(() => api.copyItemToGroup({ itemId, groupId }), '已复制到用户组');
    if (next) { state = next; render(); }
    return;
  }

  if (button.dataset.itemAction === 'unlock') {
    let result = await run(() => api.unlockItem({ itemId }), '文本已解锁');
    if (!result && elements.libraryLocalPassword?.value) {
      const authorized = await run(() => reauthorizeLocalSession('library'), '本地会话已恢复');
      if (authorized) result = await run(() => api.unlockItem({ itemId }), '文本已解锁');
    }
    if (result) {
      const target = document.querySelector(`#itemText-${CSS.escape(itemId)}`);
      if (target) {
        target.className = 'plainText';
        target.textContent = result.text;
      }
    } else {
      elements.libraryReauthWrap?.classList.remove('hidden');
    }
    return;
  }

  if (button.dataset.itemAction === 'save') {
    let next = await run(() => api.saveItemFile({ itemId }), '文件已保存到本地');
    if (!next && elements.libraryLocalPassword?.value) {
      const authorized = await run(() => reauthorizeLocalSession('library'), '本地会话已恢复');
      if (authorized) next = await run(() => api.saveItemFile({ itemId }), '文件已保存到本地');
    }
    if (next) {
      state = next;
      render();
    } else {
      elements.libraryReauthWrap?.classList.remove('hidden');
    }
  }
});

elements.showDatabase.addEventListener('click', () => {
  api.showDatabase();
});

refresh().catch((error) => setLoginHint(String(error), true));
