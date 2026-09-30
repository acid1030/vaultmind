import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell, BookOpen, Check, ChevronDown, Cloud, FolderGit2, Home, KeyRound,
  LogOut, Plus, Search, Settings, Users, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import { vaultApi } from '@/lib/ipc'
import HomeView from './HomeView'
import LibraryView from './LibraryView'
import GroupsView from './GroupsView'
import AddContentView from './AddContentView'
import ProjectsView from './ProjectsView'
import ConfigView from './ConfigView'
import PasswordVaultView from './PasswordVaultView'
import SyncCenterView from './SyncCenterView'
import ThemeToggle from '../components/shared/ThemeToggle'
import BrandMark from '../components/shared/BrandMark'

type NavView = 'home' | 'library' | 'vault' | 'groups' | 'projects' | 'add' | 'sync' | 'config'

const NAV_GROUPS = [
  {
    label: '工作台',
    items: [
      { id: 'home' as NavView, label: '概览', icon: Home, description: '状态与快捷入口' },
      { id: 'library' as NavView, label: '知识库', icon: BookOpen, description: '检索与知识问答' },
      { id: 'vault' as NavView, label: '密码库', icon: KeyRound, description: '密码与密钥' },
      { id: 'add' as NavView, label: '添加内容', icon: Plus, description: '文件、笔记与链接' },
    ],
  },
  {
    label: '组织与连接',
    items: [
      { id: 'groups' as NavView, label: '用户组', icon: Users, description: '成员与共享空间' },
      { id: 'sync' as NavView, label: '同步中心', icon: Cloud, description: '飞书加密同步' },
    ],
  },
  {
    label: '高级工具',
    items: [
      { id: 'projects' as NavView, label: '开发连接', icon: FolderGit2, description: 'Git / SVN 辅助入口' },
      { id: 'config' as NavView, label: '设置', icon: Settings, description: '模型、数据源与账户' },
    ],
  },
]

const VIEW_META: Record<NavView, { title: string; subtitle: string }> = {
  home: { title: '工作台概览', subtitle: '从一个清晰入口掌握知识、密钥、协作与同步状态' },
  library: { title: '知识库', subtitle: '浏览内容、查找线索，并基于可信资料进行问答' },
  vault: { title: '密码库', subtitle: '集中管理本地加密的密码、Token 与密钥' },
  groups: { title: '用户组', subtitle: '管理成员权限、组密钥与共享内容' },
  projects: { title: '开发连接', subtitle: '把仓库与凭据作为知识上下文的辅助入口' },
  add: { title: '添加内容', subtitle: '把文件、笔记、密钥和链接安全收进保险库' },
  sync: { title: '同步中心', subtitle: '管理飞书连接、加密上传与多设备清单' },
  config: { title: '设置', subtitle: '配置模型、知识源、安全恢复与应用更新' },
}

export default function MainLayout() {
  const { state, logout, setContext, pendingInvites } = useAppStore()
  const toast = useToast()
  const [activeView, setActiveView] = useState<NavView>('home')
  const [contextOpen, setContextOpen] = useState(false)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const context = state?.context || { scope: 'personal' as const, groupId: '', groupName: '' }
  const groups = state?.groups || []
  const isFeishuLoggedIn = state?.isFeishuLoggedIn || false
  const user = state?.auth.user
  const contexts = useMemo(() => [
    { value: 'personal', label: '个人空间' },
    ...groups.map(group => ({ value: group.id, label: group.name })),
  ], [groups])
  const contextValue = context.scope === 'group' ? context.groupId : 'personal'
  const currentContext = contexts.find(item => item.value === contextValue) || contexts[0]
  const meta = VIEW_META[activeView]

  const navigate = (view: NavView) => {
    setActiveView(view)
    setContextOpen(false)
  }

  const handleContextChange = async (value: string) => {
    if (value === 'personal') await setContext('personal')
    else await setContext('group', value)
    setContextOpen(false)
    toast(`已切换到 ${contexts.find(item => item.value === value)?.label}`, 'info', 2000)
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setShowGlobalSearch(open => !open)
      }
      if (event.key === 'Escape') {
        setShowGlobalSearch(false)
        setContextOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!contextOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [contextOpen])

  return (
    <div className="vm-shell">
      <aside className="vm-sidebar">
        <button className="vm-brand" onClick={() => navigate('home')} aria-label="返回工作台概览">
          <BrandMark size="sm" decorative />
          <span className="vm-sidebar-copy">
            <strong>AxonMind</strong>
            <small>SECURE KNOWLEDGE WORKSPACE</small>
          </span>
        </button>

        <nav className="vm-side-nav" aria-label="主导航">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="vm-nav-group">
              <p className="vm-nav-label vm-sidebar-copy">{group.label}</p>
              {group.items.map(item => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    title={item.description}
                    aria-current={activeView === item.id ? 'page' : undefined}
                    onClick={() => navigate(item.id)}
                    className={cn('vm-side-link', activeView === item.id && 'active')}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    <span className="vm-sidebar-copy flex-1 text-left">{item.label}</span>
                    {item.id === 'groups' && pendingInvites.length > 0 && <span className="vm-nav-dot" />}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="vm-sidebar-footer">
          <button className={cn('vm-connection-card', isFeishuLoggedIn && 'connected')} onClick={() => navigate('sync')}>
            <span className="vm-connection-icon"><Cloud className="w-4 h-4" /></span>
            <span className="vm-sidebar-copy min-w-0 text-left">
              <strong>{isFeishuLoggedIn ? '云端已连接' : '仅本机存储'}</strong>
              <small>{isFeishuLoggedIn ? state?.feishuUser?.name || '飞书同步可用' : '连接飞书开启多设备同步'}</small>
            </span>
          </button>
        </div>
      </aside>

      <section className="vm-workspace">
        <header className="vm-topbar">
          <div className="vm-topbar-heading min-w-0">
            <span className="vm-topbar-breadcrumb">AxonMind / {currentContext.label}</span>
            <h1 className="truncate text-base font-semibold text-foreground">{meta.title}</h1>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{meta.subtitle}</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="vm-search-trigger" onClick={() => setShowGlobalSearch(true)} title="搜索 (Ctrl+K)">
              <Search className="w-3.5 h-3.5" />
              <span>搜索</span>
              <kbd>⌘ K</kbd>
            </button>

            <Button variant="primary" size="sm" className="vm-topbar-add" onClick={() => navigate('add')}>
              <Plus className="w-3.5 h-3.5" />添加内容
            </Button>

            <div className="relative" ref={contextMenuRef}>
              <button className="vm-context-trigger" onClick={() => setContextOpen(open => !open)} aria-expanded={contextOpen}>
                <span className="vm-context-dot" />
                <span className="max-w-28 truncate">{currentContext.label}</span>
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', contextOpen && 'rotate-180')} />
              </button>
              {contextOpen && (
                <div className="vm-context-menu animate-scale-in">
                  <p>切换工作空间</p>
                  {contexts.map(item => (
                    <button key={item.value} onClick={() => handleContextChange(item.value)} className={cn(item.value === contextValue && 'active')}>
                      <span className="truncate">{item.label}</span>
                      {item.value === contextValue && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button variant="ghost" size="icon-sm" onClick={() => pendingInvites.length > 0 && navigate('groups')} title={pendingInvites.length ? '查看待处理邀请' : '暂无通知'}>
              <Bell className="w-3.5 h-3.5" />
              {pendingInvites.length > 0 && <span className="vm-notification-dot" />}
            </Button>
            <ThemeToggle />
            <div className="vm-user-chip">
              <span>{(user?.username || user?.email || 'U').charAt(0).toUpperCase()}</span>
              <span className="vm-user-name">{user?.username || user?.email}</span>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={logout} title="退出登录"><LogOut className="w-3.5 h-3.5" /></Button>
          </div>
        </header>

        <main className="vm-page">
          {activeView === 'home' && <HomeView onNavigate={navigate} onSearch={() => setShowGlobalSearch(true)} />}
          {activeView === 'library' && <LibraryView context={context.scope === 'group' ? context.groupId : 'personal'} />}
          {activeView === 'vault' && <PasswordVaultView />}
          {activeView === 'groups' && <GroupsView />}
          {activeView === 'add' && <AddContentView />}
          {activeView === 'projects' && <ProjectsView />}
          {activeView === 'sync' && <SyncCenterView />}
          {activeView === 'config' && <ConfigView />}
        </main>
      </section>

      {showGlobalSearch && <GlobalSearch onClose={() => setShowGlobalSearch(false)} onNavigate={navigate} />}
    </div>
  )
}

function GlobalSearch({ onClose, onNavigate }: { onClose: () => void; onNavigate: (view: NavView) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [opening, setOpening] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearchError('')
      return
    }
    setSearching(true)
    const timer = window.setTimeout(async () => {
      try {
        const response = await vaultApi.search({ query, searchScope: 'all' })
        setResults(response.results || [])
        setSearchError('')
      } catch (error: any) {
        setResults([])
        setSearchError(error?.message || '搜索暂时不可用')
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => setSelectedIndex(0), [results])

  const openResult = async (result: any) => {
    if (result.sourceTable === 'records') {
      setOpening(true)
      try {
        const opened = await vaultApi.openAsset({ assetId: result.assetId, sourceTable: 'records' })
        if (opened?.opened) onClose()
        else {
          onNavigate('sync')
          onClose()
        }
      } catch {
        onNavigate('sync')
        onClose()
      } finally {
        setOpening(false)
      }
      return
    }
    if (!result.assetId) {
      onNavigate('library')
      onClose()
      return
    }
    setOpening(true)
    try {
      const opened = await vaultApi.openItem({ itemId: result.assetId })
      if (opened.opened) onClose()
      else setPreview({ title: opened.name || result.title || '内容预览', content: opened.content || opened.url || '暂无可预览内容' })
    } catch {
      onNavigate('library')
      onClose()
    } finally {
      setOpening(false)
    }
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault()
      setSelectedIndex(index => (index + 1) % results.length)
    } else if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault()
      setSelectedIndex(index => (index - 1 + results.length) % results.length)
    } else if (event.key === 'Enter' && results[selectedIndex]) {
      event.preventDefault()
      openResult(results[selectedIndex])
    }
  }

  return (
    <div className="vm-command-overlay" onClick={onClose}>
      <div className="vm-command-panel animate-scale-in" onClick={event => event.stopPropagation()}>
        <div className="vm-command-input">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input autoFocus placeholder="搜索标题、标签和内容..." value={query}
            onChange={event => { setQuery(event.target.value); setPreview(null) }}
            onKeyDown={handleSearchKeyDown} />
          <kbd>ESC</kbd>
        </div>
        <div className="vm-command-results">
          {preview ? (
            <div className="p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="truncate text-sm font-semibold text-foreground">{preview.title}</h3>
                <Button variant="ghost" size="icon-sm" onClick={() => setPreview(null)}><X className="w-3.5 h-3.5" /></Button>
              </div>
              <pre className="vm-search-preview">{preview.content}</pre>
            </div>
          ) : searching || opening ? (
            <div className="vm-command-empty"><span className="vm-spinner" />{opening ? '正在安全打开内容...' : '正在搜索...'}</div>
          ) : query && searchError ? (
            <div className="vm-command-empty vm-command-error"><Search className="w-7 h-7" /><span>搜索失败</span><small>{searchError}</small></div>
          ) : query && results.length === 0 ? (
            <div className="vm-command-empty"><Search className="w-7 h-7" /><span>没有找到匹配内容</span><small>尝试更短的关键词或检查当前工作空间</small></div>
          ) : results.length > 0 ? results.map((result, index) => (
            <button key={`${result.assetId || result.title}-${index}`}
              className={cn('vm-command-row', selectedIndex === index && 'active')}
              onMouseEnter={() => setSelectedIndex(index)} onClick={() => openResult(result)}>
              <span className="vm-command-icon"><BookOpen className="w-3.5 h-3.5" /></span>
              <span className="min-w-0 flex-1">
                <strong>{result.title}</strong>
                <small>{result.sourceTable || 'library_items'} · {result.scope === 'group' ? '团队空间' : '个人空间'}</small>
              </span>
              <span className="text-[10px] text-muted-foreground">打开</span>
            </button>
          )) : (
            <div className="vm-command-empty"><Search className="w-7 h-7" /><span>搜索整个 AxonMind</span><small>支持知识条目、文件索引与团队共享内容</small></div>
          )}
        </div>
        <div className="vm-command-footer"><span>↑↓ 浏览</span><span>Enter 打开</span><span>Esc 关闭</span></div>
      </div>
    </div>
  )
}
