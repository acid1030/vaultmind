import { create } from 'zustand'
import { vaultApi, type VaultState, type VaultUser, type Evidence, type PendingInvite } from '@/lib/ipc'

interface AppState {
  // ── State ──
  state: VaultState | null
  loading: boolean
  error: string | null
  initialized: boolean

  // ── Derived getters ──
  isLoggedIn: boolean
  user: VaultUser | null
  hasUsers: boolean
  pendingInvites: PendingInvite[]

  // ── Actions ──
  init: () => Promise<void>
  refresh: () => Promise<VaultState | null>
  register: (payload: { email: string; username: string; password: string; phone?: string; recoveryEmail?: string }) => Promise<{ recoveryCode?: string; error?: string }>
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
  setContext: (scope: 'personal' | 'group', groupId?: string) => Promise<void>
  createLibraryItem: (payload: any) => Promise<{ error?: string }>
  unlockItem: (itemId: string) => Promise<{ id?: string; name?: string; text?: string; error?: string }>
  openItem: (itemId: string) => Promise<{ id?: string; name?: string; kind?: string; content?: string; url?: string; opened?: boolean; path?: string; viewable?: boolean; error?: string }>
  forgetItem: (itemId: string) => Promise<void>
  forgetRecord: (recordId: string) => Promise<void>
  saveItemFile: (itemId: string) => Promise<{ error?: string }>
  openAsset: (payload: any) => Promise<any>
  queryKnowledge: (question: string, options?: any) => Promise<{ answer?: string; evidence?: Evidence[]; error?: string }>
  saveSettings: (settings: any) => Promise<{ error?: string }>
  saveLocalVectorSettings: (input: { localVectorSearch?: boolean; localVectorModel?: string }) => Promise<{ error?: string }>
  loginFeishu: () => Promise<{ error?: string }>
  logoutFeishu: () => Promise<void>
  saveAiProfile: (profile: any) => Promise<{ error?: string }>
  uploadFiles: (filePaths: string[], passphrase: string, scope?: any) => Promise<{ records?: any[]; failures?: any[]; error?: string }>
  uploadText: (payload: { name: string; text: string; passphrase: string; scope?: string; groupId?: string }) => Promise<{ records?: any[]; error?: string }>
  downloadRecord: (recordId: string, passphrase: string) => Promise<{ error?: string }>
  fullSync: (passphrase: string, scope?: any) => Promise<{ pull?: any; push?: any; pullError?: string; pushError?: string }>
  syncManifest: (passphrase: string, scope?: any) => Promise<{ error?: string }>
  pullManifest: (passphrase: string, scope?: any) => Promise<{ error?: string }>
  chooseFiles: () => Promise<{ canceled: boolean; filePaths: string[] }>
  chooseDirectory: () => Promise<{ canceled: boolean; filePaths: string[] }>
  scanWechatAttachments: () => Promise<any>
  chooseWechatAttachments: () => Promise<any>
  // Group actions
  createGroup: (name: string, feishuFolderToken?: string) => Promise<{ error?: string }>
  inviteToGroup: (groupId: string, email: string, role?: string) => Promise<{ inviteCode?: string; error?: string }>
  leaveGroup: (groupId: string) => Promise<void>
  listGroupMembers: (groupId: string) => Promise<any[] | { error?: string }>
  removeGroupMember: (groupId: string, memberId: string) => Promise<{ error?: string }>
  rotateGroupKey: (groupId: string) => Promise<{ newVersion?: number; error?: string }>
  updateMemberRole: (groupId: string, memberId: string, role: string) => Promise<{ error?: string }>
  acceptPendingInvites: () => Promise<{ accepted?: any[]; error?: string }>
  copyItemToGroup: (itemId: string, groupId: string) => Promise<{ error?: string }>
  // Project actions
  saveProjectAccount: (payload: any) => Promise<{ error?: string }>
  saveProjectRepository: (payload: any) => Promise<{ error?: string }>
  deleteProjectRepository: (repoId: string) => Promise<{ error?: string }>
  runProjectAction: (repoId: string, action: string, message?: string) => Promise<{ output?: string; error?: string }>
  setError: (error: string | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  state: null,
  loading: false,
  error: null,
  initialized: false,
  isLoggedIn: false,
  user: null,
  hasUsers: false,
  pendingInvites: [],

  init: async () => {
    set({ loading: true, error: null })
    try {
      const state = await vaultApi.getState()
      set({
        state,
        loading: false,
        initialized: true,
        isLoggedIn: state.auth.isLoggedIn,
        user: state.auth.user,
        hasUsers: state.auth.hasUsers,
        pendingInvites: state.pendingInvites || [],
      })
    } catch (err: any) {
      set({ loading: false, error: err.message || '初始化失败', initialized: true })
    }
  },

  refresh: async () => {
    try {
      const state = await vaultApi.getState()
      set({
        state,
        isLoggedIn: state.auth.isLoggedIn,
        user: state.auth.user,
        hasUsers: state.auth.hasUsers,
        pendingInvites: state.pendingInvites || [],
      })
      return state
    } catch (err: any) {
      set({ error: err.message })
      return null
    }
  },

  register: async (payload) => {
    try {
      const result = await vaultApi.register(payload)
      set({
        state: result,
        isLoggedIn: result.auth.isLoggedIn,
        user: result.auth.user,
        hasUsers: true,
        pendingInvites: result.pendingInvites || [],
      })
      return { recoveryCode: result.recoveryCode }
    } catch (err: any) {
      return { error: err.message || '注册失败' }
    }
  },

  login: async (email, password) => {
    try {
      const result = await vaultApi.loginLocal({ email, password })
      set({
        state: result,
        isLoggedIn: result.auth.isLoggedIn,
        user: result.auth.user,
        pendingInvites: result.pendingInvites || [],
      })
      return {}
    } catch (err: any) {
      return { error: err.message || '登录失败' }
    }
  },

  logout: async () => {
    try {
      const state = await vaultApi.logoutLocal()
      set({
        state,
        isLoggedIn: false,
        user: null,
        pendingInvites: [],
      })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  setContext: async (scope, groupId) => {
    try {
      const state = await vaultApi.setContext({ scope, groupId })
      set({ state })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  createLibraryItem: async (payload) => {
    try {
      const state = await vaultApi.createLibraryItem(payload)
      set({ state })
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  },

  unlockItem: async (itemId) => {
    try {
      const result = await vaultApi.unlockItem({ itemId })
      return result
    } catch (err: any) {
      return { error: err.message }
    }
  },

  openItem: async (itemId) => {
    try {
      const result = await vaultApi.openItem({ itemId })
      return result
    } catch (err: any) {
      return { error: err.message }
    }
  },

  forgetItem: async (itemId) => {
    try {
      const state = await vaultApi.forgetItem(itemId)
      set({ state })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  forgetRecord: async (recordId) => {
    try {
      const state = await vaultApi.forgetRecord(recordId)
      set({ state })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  saveItemFile: async (itemId) => {
    try {
      const state = await vaultApi.saveItemFile({ itemId })
      set({ state })
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  },

  openAsset: async (payload) => {
    try {
      return await vaultApi.openAsset(payload)
    } catch (err: any) {
      set({ error: err.message })
      return null
    }
  },

  queryKnowledge: async (question, options) => {
    try {
      const result = await vaultApi.queryKnowledgeCenter({ question, ...options })
      set({ state: result.state })
      return { answer: result.answer, evidence: result.evidence }
    } catch (err: any) {
      return { error: err.message }
    }
  },

  saveSettings: async (settings) => {
    try {
      const state = await vaultApi.saveSettings(settings)
      set({ state })
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  },

  saveLocalVectorSettings: async (input) => {
    try {
      const state = await vaultApi.saveLocalVectorSettings(input)
      set({ state })
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  },

  loginFeishu: async () => {
    try {
      const state = await vaultApi.loginFeishu()
      set({ state })
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  },

  logoutFeishu: async () => {
    try {
      const state = await vaultApi.logout()
      set({ state })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  saveAiProfile: async (profile) => {
    try {
      const state = await vaultApi.saveAiProfile(profile)
      set({ state })
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  },

  uploadFiles: async (filePaths, passphrase, scope) => {
    try {
      const result = await vaultApi.uploadFiles({ filePaths, passphrase, ...scope })
      set({ state: result.state })
      return { records: result.records, failures: result.failures }
    } catch (err: any) {
      return { error: err.message }
    }
  },

  uploadText: async (payload) => {
    try {
      const result = await vaultApi.uploadText(payload)
      set({ state: result.state })
      return { records: result.records }
    } catch (err: any) {
      return { error: err.message }
    }
  },

  downloadRecord: async (recordId, passphrase) => {
    try {
      const state = await vaultApi.downloadRecord({ recordId, passphrase })
      set({ state })
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  },

  fullSync: async (passphrase, scope) => {
    try {
      const result = await vaultApi.fullSync({ passphrase, ...scope })
      if (result.state) set({ state: result.state })
      return { pull: result.pull, push: result.push, pullError: result.pullError, pushError: result.pushError }
    } catch (err: any) {
      return { pullError: err.message }
    }
  },

  syncManifest: async (passphrase, scope) => {
    try {
      const result = await vaultApi.syncManifest({ passphrase, ...scope })
      if (result.state) set({ state: result.state })
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  },

  pullManifest: async (passphrase, scope) => {
    try {
      const result = await vaultApi.pullManifest({ passphrase, ...scope })
      if (result.state) set({ state: result.state })
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  },

  chooseFiles: async () => {
    return await vaultApi.chooseFiles()
  },

  chooseDirectory: async () => {
    return await vaultApi.chooseDirectory()
  },

  scanWechatAttachments: async () => {
    return await vaultApi.scanWechatAttachments()
  },

  chooseWechatAttachments: async () => {
    return await vaultApi.chooseWechatAttachments()
  },

  // ── Group actions ──

  createGroup: async (name, feishuFolderToken) => {
    try {
      const state = await vaultApi.createGroup({ name, feishuFolderToken })
      set({ state })
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  },

  inviteToGroup: async (groupId, email, role) => {
    try {
      const result = await vaultApi.inviteToGroup({ groupId, email, role })
      if (result.state) set({ state: result.state })
      return { inviteCode: result.inviteCode || result.invite_code || result.code }
    } catch (err: any) {
      return { error: err.message }
    }
  },

  leaveGroup: async (groupId) => {
    try {
      const state = await vaultApi.leaveGroup(groupId)
      set({ state })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  listGroupMembers: async (groupId) => {
    try {
      return await vaultApi.listGroupMembers(groupId)
    } catch (err: any) {
      return { error: err.message }
    }
  },

  removeGroupMember: async (groupId, memberId) => {
    try {
      const state = await vaultApi.removeGroupMember({ groupId, memberId })
      set({ state })
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  },

  rotateGroupKey: async (groupId) => {
    try {
      const result = await vaultApi.rotateGroupKey(groupId)
      if (result.state) set({ state: result.state })
      return { newVersion: result.newVersion || result.new_version }
    } catch (err: any) {
      return { error: err.message }
    }
  },

  updateMemberRole: async (groupId, memberId, role) => {
    try {
      const state = await vaultApi.updateMemberRole({ groupId, memberId, role })
      set({ state })
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  },

  acceptPendingInvites: async () => {
    try {
      const result = await vaultApi.acceptPendingInvites()
      if (result.state) set({ state: result.state, pendingInvites: result.state.pendingInvites || [] })
      return { accepted: result.accepted }
    } catch (err: any) {
      return { error: err.message }
    }
  },

  copyItemToGroup: async (itemId, groupId) => {
    try {
      const state = await vaultApi.copyItemToGroup({ itemId, groupId })
      set({ state })
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  },

  // ── Project actions ──

  saveProjectAccount: async (payload) => {
    try {
      const state = await vaultApi.saveProjectAccount(payload)
      set({ state })
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  },

  saveProjectRepository: async (payload) => {
    try {
      const state = await vaultApi.saveProjectRepository(payload)
      set({ state })
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  },

  deleteProjectRepository: async (repoId) => {
    try {
      const state = await vaultApi.deleteProjectRepository(repoId)
      set({ state })
      return {}
    } catch (err: any) {
      set({ error: err.message })
      return { error: err.message }
    }
  },

  runProjectAction: async (repoId, action, message) => {
    try {
      const result = await vaultApi.runProjectAction({ repoId, action, message })
      if (result.state) set({ state: result.state })
      return { output: result.output }
    } catch (err: any) {
      return { error: err.message }
    }
  },

  setError: (error) => set({ error }),
}))
