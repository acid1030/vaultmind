import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Cloud,
  FileText,
  HardDrive,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { effectiveContentKind } from '@/lib/content-kind'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import { vaultApi, type LibraryItem } from '@/lib/ipc'

type AppView = 'home' | 'library' | 'vault' | 'groups' | 'projects' | 'add' | 'sync' | 'config'

interface HomeViewProps {
  onNavigate: (view: AppView) => void
  onSearch: () => void
}

function formatTime(value: string) {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '最近'
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function HomeView({ onNavigate, onSearch }: HomeViewProps) {
  const { state, openItem } = useAppStore()
  const toast = useToast()
  const [preview, setPreview] = useState<{ title: string; content: string; url?: string } | null>(null)
  const items = state?.items || []
  const records = state?.records || []
  const groups = state?.groups || []
  const context = state?.context
  const secretCount = items.filter(item => effectiveContentKind(item) === 'secret').length
  const recentItems = items.filter(item => !item.remoteOnly).slice(0, 8)
  const aiReady = Boolean(state?.knowledgeCenter?.aiProfile?.model && state?.knowledgeCenter?.aiProfile?.baseUrl)
  const cloudReady = Boolean(state?.isFeishuLoggedIn)

  const stats = [
    { label: '知识库', value: items.length, hint: '条内容', icon: BookOpen, view: 'library' as const },
    { label: '密码库', value: secretCount, hint: '条凭据', icon: KeyRound, view: 'vault' as const },
    { label: '用户组', value: groups.length, hint: '个分组', icon: Users, view: 'groups' as const },
    { label: '同步状态', value: cloudReady ? '已连接' : '仅本机', hint: cloudReady ? '飞书加密同步' : '尚未连接云端', icon: RefreshCw, view: 'sync' as const },
  ]

  const setup = [
    { label: '本地保险库已启用', detail: '内容默认保存在本机并加密', done: true, view: 'vault' as const },
    { label: '配置知识问答模型', detail: aiReady ? state?.knowledgeCenter.aiProfile.model : '连接模型后可对知识库提问', done: aiReady, view: 'config' as const },
    { label: '连接飞书加密同步', detail: cloudReady ? `已连接 ${state?.feishuUser?.name || '飞书'}` : '用于多设备安全同步', done: cloudReady, view: 'sync' as const },
  ]

  const openRecentItem = async (item: LibraryItem) => {
    if (effectiveContentKind(item) === 'secret') {
      onNavigate('vault')
      return
    }
    const result = await openItem(item.id)
    if (result.error) {
      toast(result.error, 'error')
    } else if (result.opened) {
      toast('已用系统应用打开文件', 'success')
    } else {
      setPreview({ title: result.name || item.title || '内容预览', content: result.content || '', url: result.url })
    }
  }

  return (
    <div className="vm-home animate-fade-in">
      <section className="vm-home-heading">
        <div>
          <span className="vm-home-overline">工作台</span>
          <h1>概览</h1>
          <p>查看内容、凭据与协作状态，继续最近的工作。</p>
        </div>
        <div className="vm-home-heading-actions">
          <Button variant="outline" onClick={onSearch}><Search className="w-4 h-4" />搜索</Button>
          <Button variant="primary" onClick={() => onNavigate('add')}><Plus className="w-4 h-4" />添加内容</Button>
        </div>
      </section>

      <section className="vm-stat-grid" aria-label="工作台概览">
        {stats.map(stat => {
          const Icon = stat.icon
          return (
            <button key={stat.label} className="vm-stat-card text-left" onClick={() => onNavigate(stat.view)}>
              <span className="vm-stat-icon"><Icon className="w-5 h-5" /></span>
              <span className="vm-stat-label">{stat.label}</span>
              <span className="vm-stat-value">{stat.value} <small>{stat.hint}</small></span>
              <ArrowRight className="vm-stat-arrow w-4 h-4" />
            </button>
          )
        })}
      </section>

      <section className="vm-home-grid">
        <Card className="overflow-hidden">
          <div className="vm-section-heading">
            <div>
              <h2>最近内容</h2>
              <p>最近加入本机的资料</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('library')}>查看全部<ArrowRight className="w-3.5 h-3.5" /></Button>
          </div>
          <CardContent className="vm-recent-list p-0">
            {recentItems.length === 0 ? (
              <div className="vm-empty py-10">
                <FileText className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-foreground">保险库还是空的</p>
                <p className="text-xs">先保存一条笔记、链接或文件</p>
                <Button variant="outline" size="sm" onClick={() => onNavigate('add')}><Plus className="w-3.5 h-3.5" />添加第一条内容</Button>
              </div>
            ) : <>
              <div className="vm-recent-columns"><span>名称</span><span>类型</span><span>更新于</span><span>操作</span></div>
              {recentItems.map(item => (
              <button key={item.id} className="vm-recent-row" onClick={() => openRecentItem(item)}>
                <span className="vm-recent-icon"><BookOpen className="w-3.5 h-3.5" /></span>
                <span className="vm-recent-name">{item.title || item.name}</span>
                <span className="vm-recent-kind">{effectiveContentKind(item)}</span>
                <span className="vm-recent-time">{formatTime(item.downloadedAt)}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              ))}
            </>}
          </CardContent>
        </Card>

        <div className="vm-home-side-panels">
        <Card className="overflow-hidden">
          <div className="vm-section-heading">
            <div>
              <h2>同步状态</h2>
              <p>个人空间 · {context?.scope === 'group' ? context.groupName : '本机保险库'}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('sync')}>查看详情<ArrowRight className="w-3.5 h-3.5" /></Button>
          </div>
          <CardContent className="vm-sync-summary">
            <div className={cloudReady ? 'vm-sync-banner connected' : 'vm-sync-banner'}>
              <Cloud className="w-5 h-5" />
              <span><strong>{cloudReady ? '飞书已连接' : '仅本机存储'}</strong><small>{cloudReady ? '可进行加密同步' : '连接飞书后可跨设备同步'}</small></span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </div>
            <div className="vm-sync-fact"><HardDrive className="w-4 h-4" /><span>本地内容</span><strong>{items.length} 条</strong></div>
            <div className="vm-sync-fact"><Cloud className="w-4 h-4" /><span>云端记录</span><strong>{records.length} 条</strong></div>
            <div className="vm-sync-fact"><Users className="w-4 h-4" /><span>协作空间</span><strong>{groups.length} 个</strong></div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <div className="vm-section-heading">
            <div><h2>待办事项</h2><p>完成工作台的关键设置</p></div>
            <span className="vm-badge-cyan">{setup.filter(item => item.done).length}/{setup.length}</span>
          </div>
          <CardContent className="p-2">
            {setup.map(item => (
              <button key={item.label} className="vm-setup-row" onClick={() => onNavigate(item.view)}>
                <CheckCircle2 className={item.done ? 'text-emerald' : 'text-muted-foreground'} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-foreground">{item.label}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{item.detail}</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
        </div>
      </section>
      {preview && (
        <div className="vm-dialog-overlay" role="dialog" aria-modal="true" aria-label={preview.title} onClick={() => setPreview(null)}>
          <div className="vm-content-preview" onClick={event => event.stopPropagation()}>
            <div className="vm-content-preview-header">
              <div><span>本地内容</span><h2>{preview.title}</h2></div>
              <Button variant="ghost" size="icon-sm" onClick={() => setPreview(null)} aria-label="关闭预览"><X className="w-4 h-4" /></Button>
            </div>
            <div className="vm-content-preview-body">
              {preview.url ? (
                <button className="vm-preview-link" onClick={() => vaultApi.openExternal(preview.url || '')}>{preview.url}</button>
              ) : (
                <pre>{preview.content || '暂无可预览内容'}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
