import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Shield, BookOpen, Users, FolderGit2, Plus, Settings,
  ChevronDown, LogOut, Zap, Search, Key, Cloud, Bell
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import { vaultApi } from '@/lib/ipc'
import LibraryView from './LibraryView'
import GroupsView from './GroupsView'
import AddContentView from './AddContentView'
import ProjectsView from './ProjectsView'
import ConfigView from './ConfigView'
import PasswordVaultView from './PasswordVaultView'
import SyncCenterView from './SyncCenterView'
import DingtalkView from './DingtalkView'
import ThemeToggle from '../components/shared/ThemeToggle'

type NavView = 'library' | 'vault' | 'groups' | 'projects' | 'add' | 'sync' | 'dingtalk' | 'config'

const NAV_ITEMS = [
  { id: 'library'  as NavView, label: '内容库', icon: BookOpen,   disabled: false },
  { id: 'vault'    as NavView, label: '密码库', icon: Key,        disabled: false },
  { id: 'groups'   as NavView, label: '用户组', icon: Users,      disabled: false },
  { id: 'projects' as NavView, label: '项目',   icon: FolderGit2, disabled: false },
  { id: 'add'      as NavView, label: '添加',   icon: Plus,       disabled: false },
  { id: 'sync'     as NavView, label: '同步',   icon: Cloud,      disabled: false },
  { id: 'dingtalk' as NavView, label: '钉钉',   icon: Search,     disabled: true  },
  { id: 'config'   as NavView, label: '配置',   icon: Settings,   disabled: false },
]

export default function MainLayout() {
  const { state, logout, setContext, refresh, pendingInvites } = useAppStore()
  const toast = useToast()

  const [activeView, setActiveView] = useState<NavView>('library')
  const [contextOpen, setContextOpen] = useState(false)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)

  const context = state?.context || { scope: 'personal' as const, groupId: '', groupName: '' }
  const groups = state?.groups || []
  const isFeishuLoggedIn = state?.isFeishuLoggedIn || false
  const user = state?.auth.user

  const contexts = [
    { value: 'personal', label: '个人空间' },
    ...groups.map(g => ({ value: g.id, label: g.name })),
  ]
  const currentContext = contexts.find(c => c.value === (context.scope === 'group' ? context.groupId : 'personal')) || contexts[0]

  const handleContextChange = async (value: string) => {
    if (value === 'personal') {
      await setContext('personal')
    } else {
      await setContext('group', value)
    }
    setContextOpen(false)
    toast(`已切换到 ${contexts.find(c => c.value === value)?.label}`, 'info', 2000)
  }

  const handleLogout = async () => {
    await logout()
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowGlobalSearch(s => !s)
      }
      if (e.key === 'Escape') {
        setShowGlobalSearch(false)
        setContextOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-dot-grid)' }}>
      {/* 顶栏 */}
      <header className="glass-panel rounded-none border-t-0 border-l-0 border-r-0 border-b sticky top-0 z-30 px-5 h-14 flex items-center justify-between gap-4"
        style={{ borderBottomColor: 'var(--border)' }}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(145deg, hsl(190 60% 22%), hsl(152 50% 16%))',
              border: '1px solid hsl(190 60% 28% / 0.5)',
              boxShadow: '0 0 16px hsl(190 90% 60% / 0.15)',
            }}>
            <Shield className="w-4 h-4" style={{ color: 'hsl(190 90% 72%)' }} />
          </div>
          <span className="text-sm font-bold tracking-tight text-foreground">
            VaultMind
          </span>
        </div>

        {/* 中间导航 */}
        <nav className="flex items-center gap-0.5 flex-1 justify-center max-w-2xl overflow-x-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            return (
              <button key={item.id}
                onClick={() => !item.disabled && setActiveView(item.id)}
                disabled={item.disabled}
                title={item.disabled ? '即将推出' : undefined}
                className={cn(
                  "nav-pill whitespace-nowrap",
                  activeView === item.id && !item.disabled && "active",
                  item.disabled && "opacity-35 cursor-not-allowed pointer-events-none"
                )}>
                <Icon className="w-3.5 h-3.5" />
                <span className="text-xs">{item.label}</span>
                {item.id === 'groups' && pendingInvites && pendingInvites.length > 0 && (
                  <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-[hsl(352_84%_60%)]" />
                )}
              </button>
            )
          })}
        </nav>

        {/* 右侧控件 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 上下文选择器 */}
          <div className="relative">
            <button
              onClick={() => setContextOpen(!contextOpen)}
              className="flex items-center gap-1.5 h-8 px-3 rounded text-xs font-medium transition-all text-foreground"
              style={{
                background: 'hsl(218 30% 12%)',
                border: '1px solid var(--border)',
              }}>
              <span>{currentContext.label}</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", contextOpen && "rotate-180")} />
            </button>

            {contextOpen && (
              <div className="absolute top-full right-0 mt-1.5 w-44 glass-panel rounded-md py-1 z-50 animate-scale-in">
                {contexts.map(c => (
                  <button key={c.value}
                    onClick={() => handleContextChange(c.value)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[hsl(218_30%_14%)]",
                      (context.scope === 'group' ? context.groupId : 'personal') === c.value
                        ? "text-[hsl(190_90%_72%)]"
                        : "text-[hsl(218_16%_60%)]"
                    )}>
                    {c.label}
                    {(context.scope === 'group' ? context.groupId : 'personal') === c.value && <span className="float-right">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 搜索快捷 */}
          <Button variant="ghost" size="icon-sm" onClick={() => setShowGlobalSearch(true)} title="搜索 (Ctrl+K)">
            <Search className="w-3.5 h-3.5" />
          </Button>

          {/* 通知 */}
          <Button variant="ghost" size="icon-sm" title="通知">
            <Bell className="w-3.5 h-3.5" />
            {pendingInvites && pendingInvites.length > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[hsl(352_84%_60%)]" />
            )}
          </Button>

          {/* 云同步状态 */}
          <button
            onClick={() => setActiveView('sync')}
            className={cn("vm-badge text-xs", isFeishuLoggedIn ? "vm-badge-emerald" : "vm-badge-gold")}
            title="点击打开同步中心">
            <Zap className="w-3 h-3" />
            {isFeishuLoggedIn ? (state?.feishuUser?.name || '已连接') : '未连接云端'}
          </button>

          {/* 主题切换 */}
          <ThemeToggle />

          {/* 用户名 */}
          {user && (
            <span className="text-xs hidden md:inline text-muted-foreground">
              {user.username}
            </span>
          )}

          {/* 退出 */}
          <Button variant="ghost" size="icon-sm" onClick={handleLogout} title="退出登录">
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 p-4 min-h-0 overflow-hidden">
        {activeView === 'library'  && <LibraryView context={context.scope === 'group' ? context.groupId : 'personal'} />}
        {activeView === 'vault'    && <PasswordVaultView />}
        {activeView === 'groups'   && <GroupsView />}
        {activeView === 'add'      && <AddContentView />}
        {activeView === 'projects' && <ProjectsView />}
        {activeView === 'sync'     && <SyncCenterView />}
        {activeView === 'dingtalk' && <DingtalkView />}
        {activeView === 'config'   && <ConfigView />}
      </main>

      {/* 全局搜索弹窗 */}
      {showGlobalSearch && <GlobalSearch onClose={() => setShowGlobalSearch(false)} />}
    </div>
  )
}

// ── Global Search Modal ───────────────────────────────────

function GlobalSearch({ onClose }: { onClose: () => void }) {
  const { state } = useAppStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await vaultApi.search({ query, searchScope: 'all' })
        setResults(res.results || [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      style={{ background: 'hsl(218 42% 2% / 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="w-full max-w-xl glass-panel rounded-xl overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}>
        {/* 搜索输入 */}
        <div className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <Search className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
          <input
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground"
            placeholder="搜索内容库..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && onClose()}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground" style={{ background: 'var(--border)' }}>ESC</kbd>
        </div>

        {/* 搜索结果 */}
        <div className="max-h-[400px] overflow-y-auto p-2">
          {searching && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 animate-spin"
                style={{ borderColor: 'hsl(190 60% 30%)', borderTopColor: 'hsl(190 90% 60%)' }} />
            </div>
          )}
          {!searching && query && results.length === 0 && (
            <div className="vm-empty py-8">
              <Search className="w-7 h-7 text-muted-foreground" />
              <p className="text-xs">没有找到匹配的内容</p>
            </div>
          )}
          {!searching && results.map((r, i) => (
            <button key={i}
              className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded transition-colors hover:bg-[hsl(218_30%_12%)]"
              onClick={() => {
                if (r.assetId) vaultApi.unlockItem({ itemId: r.assetId })
                onClose()
              }}>
              <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 bg-muted"
                style={{ border: '1px solid hsl(218 24% 20%)' }}>
                <BookOpen className="w-3.5 h-3.5" style={{ color: 'hsl(190 90% 60%)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-foreground">{r.title}</p>
                <p className="text-[10px] mt-0.5 text-muted-foreground">
                  {r.sourceTable || 'library_items'} · {r.scope === 'group' ? '组内' : '个人'}
                </p>
              </div>
            </button>
          ))}
          {!query && (
            <div className="vm-empty py-8">
              <Search className="w-7 h-7 text-muted-foreground" />
              <p className="text-xs">输入关键词开始搜索</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
