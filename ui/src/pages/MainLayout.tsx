import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Shield, BookOpen, Users, FolderGit2, Plus, Settings,
  ChevronDown, LogOut, Zap, Bell, Search, Key, Cloud, MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'
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
  { id: 'library'  as NavView, label: '内容库', icon: BookOpen     },
  { id: 'vault'    as NavView, label: '密码库', icon: Key          },
  { id: 'groups'   as NavView, label: '用户组', icon: Users        },
  { id: 'projects' as NavView, label: '项目',   icon: FolderGit2   },
  { id: 'add'      as NavView, label: '添加',   icon: Plus         },
  { id: 'sync'     as NavView, label: '同步',   icon: Cloud        },
  { id: 'dingtalk' as NavView, label: '钉钉',   icon: MessageSquare},
  { id: 'config'   as NavView, label: '配置',   icon: Settings     },
]

interface MainLayoutProps {
  onLogout: () => void
}

export default function MainLayout({ onLogout }: MainLayoutProps) {
  const [activeView, setActiveView] = useState<NavView>('library')
  const [context, setContext] = useState<string>('personal')
  const [contextOpen, setContextOpen] = useState(false)

  const contexts = [
    { value: 'personal', label: '个人空间' },
    { value: 'group1',   label: '研发团队' },
    { value: 'group2',   label: '市场团队' },
  ]

  const currentContext = contexts.find(c => c.value === context) || contexts[0]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-dot-grid)' }}>
      {/* 顶栏 */}
      <header className="glass-panel rounded-none border-t-0 border-l-0 border-r-0 border-b sticky top-0 z-30 px-5 h-14 flex items-center justify-between gap-4"
        style={{ borderBottomColor: 'hsl(218 24% 14%)' }}>

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
          <span className="text-sm font-bold tracking-tight" style={{ color: 'hsl(210 30% 94%)' }}>
            VaultMind
          </span>
        </div>

        {/* 中间导航 */}
        <nav className="flex items-center gap-0.5 flex-1 justify-center max-w-2xl overflow-x-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            return (
              <button key={item.id}
                onClick={() => setActiveView(item.id)}
                className={cn("nav-pill whitespace-nowrap", activeView === item.id && "active")}>
                <Icon className="w-3.5 h-3.5" />
                <span className="text-xs">{item.label}</span>
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
              className="flex items-center gap-1.5 h-8 px-3 rounded text-xs font-medium transition-all"
              style={{
                background: 'hsl(218 30% 12%)',
                border: '1px solid hsl(218 24% 18%)',
                color: 'hsl(210 30% 82%)',
              }}>
              <span>{currentContext.label}</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", contextOpen && "rotate-180")} />
            </button>

            {contextOpen && (
              <div className="absolute top-full right-0 mt-1.5 w-44 glass-panel rounded-md py-1 z-50 animate-scale-in">
                {contexts.map(c => (
                  <button key={c.value}
                    onClick={() => { setContext(c.value); setContextOpen(false) }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[hsl(218_30%_14%)]",
                      context === c.value ? "text-[hsl(190_90%_72%)]" : "text-[hsl(218_16%_60%)]"
                    )}>
                    {c.label}
                    {context === c.value && <span className="float-right">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 搜索快捷 */}
          <Button variant="ghost" size="icon-sm">
            <Search className="w-3.5 h-3.5" />
          </Button>

          {/* 通知 */}
          <Button variant="ghost" size="icon-sm">
            <Bell className="w-3.5 h-3.5" />
          </Button>

          {/* 云同步状态 */}
          <div className="vm-badge vm-badge-gold text-xs">
            <Zap className="w-3 h-3" />
            未连接云端
          </div>

          {/* 主题切换 */}
          <ThemeToggle />

          {/* 退出 */}
          <Button variant="ghost" size="icon-sm" onClick={onLogout}>
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 p-4 min-h-0 overflow-hidden">
        {activeView === 'library'  && <LibraryView context={context} />}
        {activeView === 'vault'    && <PasswordVaultView />}
        {activeView === 'groups'   && <GroupsView />}
        {activeView === 'add'      && <AddContentView context={context} />}
        {activeView === 'projects' && <ProjectsView />}
        {activeView === 'sync'     && <SyncCenterView />}
        {activeView === 'dingtalk' && <DingtalkView />}
        {activeView === 'config'   && <ConfigView />}
      </main>
    </div>
  )
}
