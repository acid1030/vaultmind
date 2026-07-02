/**
 * VaultMind IPC Type Bridge
 *
 * Provides type-safe access to the Electron preload API (window.vaultApi).
 * In browser-only dev mode, falls back to mock implementations.
 */

// ── Shared Types ──────────────────────────────────────────

export interface VaultUser {
  id: string
  email: string
  username: string
  phone: string
  recoveryEmail: string
}

export interface VaultSettings {
  appId: string
  appSecret: string
  feishuPassphrase: string
  hasFeishuPassphrase: boolean
  folderToken: string
  redirectPort: number
}

export interface VaultContext {
  scope: 'personal' | 'group'
  groupId: string
  groupName: string
}

export interface VaultGroup {
  id: string
  name: string
  slug: string
  ownerUserId: string
  feishuFolderToken: string
  keyVersion: number
  role: string
  createdAt: string
}

export interface PendingInvite {
  id: string
  groupId: string
  groupName: string
  role: string
  createdAt: string
}

export interface ManifestMeta {
  fileToken: string
  url: string
  syncedAt: string
  pulledAt: string
}

export interface LibraryItem {
  id: string
  recordId: string
  kind: string
  name: string
  title: string
  url: string
  sourcePath: string
  savedPath: string
  size: number
  downloadedAt: string
  scope: string
  groupId: string
  tags: string
  maskedText: string
  localOnly: boolean
  remoteOnly: boolean
}

export interface SyncRecord {
  id: string
  userId: string
  localPath: string
  fileName: string
  size: number
  token: string
  url: string
  uploadedAt: string
  algorithm: string
  kind: string
  scope: string
  groupId: string
  assetId: string
}

export interface AiProfile {
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
}

export interface KnowledgeSource {
  id: string
  name: string
  endpoint: string
  apiKey: string
  collection: string
  enabled: boolean
  createdAt: string
}

export interface ObsidianSource {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  insecureTls: boolean
  enabled: boolean
  createdAt: string
}

export interface QueryLog {
  id: string
  question: string
  answer: string
  evidence: Evidence[]
  createdAt: string
}

export interface Evidence {
  source: string
  type: string
  title: string
  content: string
  score: number | null
  url?: string
  nodeId?: string
  assetId?: string
  sourceTable?: string
  isHint?: boolean
}

export interface ProjectAccount {
  id: string
  provider: string
  label: string
  username: string
  hasSecret: boolean
  createdAt: string
}

export interface ProjectRepository {
  id: string
  accountId: string
  tool: string
  name: string
  remoteUrl: string
  localPath: string
  migrationDir: string
  createdAt: string
}

export interface ProjectsData {
  accounts: ProjectAccount[]
  repositories: ProjectRepository[]
}

export interface VaultState {
  auth: {
    hasUsers: boolean
    isLoggedIn: boolean
    user: VaultUser | null
  }
  settings: VaultSettings
  isFeishuLoggedIn: boolean
  feishuUser: { name: string; openId: string; avatarUrl: string } | null
  context: VaultContext
  groups: VaultGroup[]
  pendingInvites: PendingInvite[]
  manifestMeta: ManifestMeta | null
  records: SyncRecord[]
  items: LibraryItem[]
  knowledgeCenter: {
    aiProfile: AiProfile
    knowledgeSources: KnowledgeSource[]
    vectorSources: KnowledgeSource[]
    obsidianSources: ObsidianSource[]
    queryLogs: QueryLog[]
    feishuWiki: { enabled: boolean; spaceId: string; available: boolean }
    obsidian: { configured: boolean; enabled: boolean; localRestUrl: string }
  }
  projects: ProjectsData
  redirectUri: string
  requiredScopes: string
  databasePath: string
}

export interface UploadProgress {
  uploadId: string
  phase: 'start' | 'file-start' | 'file-done' | 'file-error' | 'complete'
  total: number
  completed: number
  processed: number
  failed: number
  current: string
  index?: number
  message?: string
}

// ── VaultApi Interface ────────────────────────────────────

export interface VaultApi {
  getState: () => Promise<VaultState>
  register: (payload: {
    email: string
    username: string
    password: string
    phone?: string
    recoveryEmail?: string
  }) => Promise<VaultState & { recoveryCode: string; acceptedInvites: any[] }>
  loginLocal: (payload: { email: string; password: string }) => Promise<VaultState & { acceptedInvites: any[] }>
  logoutLocal: () => Promise<VaultState>
  updateRecovery: (payload: { phone?: string; recoveryEmail?: string }) => Promise<VaultState>
  changeLocalPassword: (payload: { currentPassword: string; newPassword: string }) => Promise<VaultState>
  resetPassword: (payload: { email: string; recoveryCode: string; newPassword: string }) => Promise<{ ok: boolean }>
  saveSettings: (settings: Partial<VaultSettings>) => Promise<VaultState>
  testFeishuSync: (payload: any) => Promise<any>
  login: () => Promise<VaultState>
  loginFeishu: () => Promise<VaultState>
  openFeishuRedirectSettings: () => Promise<any>
  logout: () => Promise<VaultState>
  chooseFiles: () => Promise<{ canceled: boolean; filePaths: string[] }>
  chooseDirectory: () => Promise<{ canceled: boolean; filePaths: string[] }>
  scanWechatAttachments: () => Promise<any>
  chooseWechatAttachments: () => Promise<any>
  uploadFiles: (payload: any) => Promise<{ state: VaultState; records: any[]; failures: any[] }>
  onUploadProgress: (callback: (payload: UploadProgress) => void) => () => void
  uploadText: (payload: any) => Promise<{ state: VaultState; records: any[] }>
  downloadRecord: (payload: any) => Promise<VaultState>
  openAsset: (payload: any) => Promise<any>
  unlockItem: (payload: { itemId: string }) => Promise<{ id: string; name: string; text: string }>
  saveItemFile: (payload: { itemId: string }) => Promise<VaultState>
  forgetRecord: (recordId: string) => Promise<VaultState>
  forgetItem: (itemId: string) => Promise<VaultState>
  createLibraryItem: (payload: any) => Promise<VaultState>
  saveAiProfile: (payload: any) => Promise<VaultState>
  listModels: (payload: any) => Promise<{ models: string[] }>
  testModel: (payload: any) => Promise<{ ok: boolean; reply: string }>
  saveKnowledgeSources: (sources: any[]) => Promise<VaultState>
  saveVectorSources: (sources: any[]) => Promise<VaultState>
  saveObsidianSources: (sources: any[]) => Promise<VaultState>
  saveFeishuWikiSettings: (input: any) => Promise<VaultState>
  queryKnowledgeCenter: (payload: any) => Promise<any>
  saveProjectAccount: (payload: any) => Promise<VaultState>
  saveProjectRepository: (payload: any) => Promise<VaultState>
  deleteProjectRepository: (repoId: string) => Promise<VaultState>
  runProjectAction: (payload: any) => Promise<{ output: string; state: VaultState }>
  setContext: (payload: { scope: 'personal' | 'group'; groupId?: string }) => Promise<VaultState>
  createGroup: (payload: any) => Promise<VaultState>
  inviteToGroup: (payload: any) => Promise<any>
  leaveGroup: (groupId: string) => Promise<VaultState>
  listGroupMembers: (groupId: string) => Promise<any[]>
  search: (payload: any) => Promise<{ results: Evidence[]; state: VaultState }>
  reindexSearch: () => Promise<VaultState>
  copyItemToGroup: (payload: any) => Promise<VaultState>
  syncManifest: (payload: any) => Promise<any>
  pullManifest: (payload: any) => Promise<any>
  fullSync: (payload: any) => Promise<any>
  removeGroupMember: (payload: any) => Promise<VaultState>
  rotateGroupKey: (groupId: string) => Promise<any>
  updateMemberRole: (payload: any) => Promise<VaultState>
  transferGroupOwnership: (payload: any) => Promise<VaultState>
  acceptPendingInvites: () => Promise<{ accepted: any[]; state: VaultState }>
  openExternal: (url: string) => Promise<void>
  showDatabase: () => Promise<void>
}

// ── Dev-mode mock (when not running in Electron) ──────────

const mockVaultApi: VaultApi = {
  getState: async () => ({
    auth: { hasUsers: false, isLoggedIn: false, user: null },
    settings: { appId: '', appSecret: '', feishuPassphrase: '', hasFeishuPassphrase: false, folderToken: 'root', redirectPort: 37891 },
    isFeishuLoggedIn: false,
    feishuUser: null,
    context: { scope: 'personal', groupId: '', groupName: '' },
    groups: [],
    pendingInvites: [],
    manifestMeta: null,
    records: [],
    items: [],
    knowledgeCenter: {
      aiProfile: { provider: 'openai-compatible', baseUrl: '', apiKey: '', model: '', temperature: 0.2 },
      knowledgeSources: [],
      vectorSources: [],
      obsidianSources: [],
      queryLogs: [],
      feishuWiki: { enabled: true, spaceId: '', available: false },
      obsidian: { configured: false, enabled: false, localRestUrl: 'https://127.0.0.1:27124' },
    },
    projects: { accounts: [], repositories: [] },
    redirectUri: 'http://127.0.0.1:37891/feishu/oauth/callback',
    requiredScopes: 'drive:drive drive:drive:readonly auth:user.id:read wiki:wiki:readonly',
    databasePath: '',
  }),
  register: async () => { throw new Error('Electron 不可用：请在 Electron 环境中运行') },
  loginLocal: async () => { throw new Error('Electron 不可用：请在 Electron 环境中运行') },
  logoutLocal: async () => { throw new Error('Electron 不可用') },
  updateRecovery: async () => { throw new Error('Electron 不可用') },
  changeLocalPassword: async () => { throw new Error('Electron 不可用') },
  resetPassword: async () => { throw new Error('Electron 不可用') },
  saveSettings: async () => { throw new Error('Electron 不可用') },
  testFeishuSync: async () => { throw new Error('Electron 不可用') },
  login: async () => { throw new Error('Electron 不可用') },
  loginFeishu: async () => { throw new Error('Electron 不可用') },
  openFeishuRedirectSettings: async () => { throw new Error('Electron 不可用') },
  logout: async () => { throw new Error('Electron 不可用') },
  chooseFiles: async () => ({ canceled: true, filePaths: [] }),
  chooseDirectory: async () => ({ canceled: true, filePaths: [] }),
  scanWechatAttachments: async () => ({ canceled: true, roots: [], files: [] }),
  chooseWechatAttachments: async () => ({ canceled: true }),
  uploadFiles: async () => { throw new Error('Electron 不可用') },
  onUploadProgress: () => () => {},
  uploadText: async () => { throw new Error('Electron 不可用') },
  downloadRecord: async () => { throw new Error('Electron 不可用') },
  openAsset: async () => { throw new Error('Electron 不可用') },
  unlockItem: async () => { throw new Error('Electron 不可用') },
  saveItemFile: async () => { throw new Error('Electron 不可用') },
  forgetRecord: async () => { throw new Error('Electron 不可用') },
  forgetItem: async () => { throw new Error('Electron 不可用') },
  createLibraryItem: async () => { throw new Error('Electron 不可用') },
  saveAiProfile: async () => { throw new Error('Electron 不可用') },
  listModels: async () => { throw new Error('Electron 不可用') },
  testModel: async () => { throw new Error('Electron 不可用') },
  saveKnowledgeSources: async () => { throw new Error('Electron 不可用') },
  saveVectorSources: async () => { throw new Error('Electron 不可用') },
  saveObsidianSources: async () => { throw new Error('Electron 不可用') },
  saveFeishuWikiSettings: async () => { throw new Error('Electron 不可用') },
  queryKnowledgeCenter: async () => { throw new Error('Electron 不可用') },
  saveProjectAccount: async () => { throw new Error('Electron 不可用') },
  saveProjectRepository: async () => { throw new Error('Electron 不可用') },
  deleteProjectRepository: async () => { throw new Error('Electron 不可用') },
  runProjectAction: async () => { throw new Error('Electron 不可用') },
  setContext: async () => { throw new Error('Electron 不可用') },
  createGroup: async () => { throw new Error('Electron 不可用') },
  inviteToGroup: async () => { throw new Error('Electron 不可用') },
  leaveGroup: async () => { throw new Error('Electron 不可用') },
  listGroupMembers: async () => [],
  search: async () => ({ results: [], state: {} as VaultState }),
  reindexSearch: async () => { throw new Error('Electron 不可用') },
  copyItemToGroup: async () => { throw new Error('Electron 不可用') },
  syncManifest: async () => { throw new Error('Electron 不可用') },
  pullManifest: async () => { throw new Error('Electron 不可用') },
  fullSync: async () => { throw new Error('Electron 不可用') },
  removeGroupMember: async () => { throw new Error('Electron 不可用') },
  rotateGroupKey: async () => { throw new Error('Electron 不可用') },
  updateMemberRole: async () => { throw new Error('Electron 不可用') },
  transferGroupOwnership: async () => { throw new Error('Electron 不可用') },
  acceptPendingInvites: async () => { throw new Error('Electron 不可用') },
  openExternal: async () => {},
  showDatabase: async () => {},
}

/**
 * Get the VaultApi instance.
 * In Electron: returns window.vaultApi (exposed by preload.js)
 * In browser dev: returns mock that throws on real operations
 */
export function getVaultApi(): VaultApi {
  if (typeof window !== 'undefined' && (window as any).vaultApi) {
    return (window as any).vaultApi as VaultApi
  }
  return mockVaultApi
}

export const vaultApi = getVaultApi()
