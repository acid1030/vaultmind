import { ArrowRight, BookOpen, FileText, KeyRound, Plus, RefreshCw, Search, Users, X } from 'lucide-react'
import { useState } from 'react'
import WorkbenchOverview from '@/components/shared/WorkbenchOverview'
import { Button } from '@/components/ui/button'
import { effectiveContentKind } from '@/lib/content-kind'
import { dailyCounts } from '@/lib/dashboard'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import { vaultApi, type LibraryItem } from '@/lib/ipc'

type AppView = 'chat' | 'home' | 'library' | 'vault' | 'groups' | 'projects' | 'add' | 'sync' | 'config'
interface HomeViewProps { onNavigate: (view: AppView) => void; onSearch: () => void }
function formatTime(value: string) {
  const date = new Date(value)
  return value && Number.isFinite(date.getTime()) ? date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '暂无记录'
}
function Sparkline({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values)
  const points = values.map((value, index) => `${index * 100 / (values.length - 1)},${29 - value / max * 24}`).join(' ')
  return <svg className="vm-dashboard-spark" viewBox="0 0 100 34" preserveAspectRatio="none" role="img" aria-label={`${label}，近7日：${values.join('、')}`}><polygon points={`0,34 ${points} 100,34`} fill="currentColor" opacity=".07" /><line x1="0" y1="29" x2="100" y2="29" stroke="currentColor" opacity=".12" strokeWidth=".4"/><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.3" vectorEffect="non-scaling-stroke" /><circle cx="100" cy={29 - values[values.length-1] / max * 24} r="1.3" fill="currentColor" /></svg>
}
export default function HomeView({ onNavigate, onSearch }: HomeViewProps) {
  const { state, openItem } = useAppStore()
  const toast = useToast()
  const [preview, setPreview] = useState<{ title: string; content: string; url?: string } | null>(null)
  const [recentFilter, setRecentFilter] = useState('all')
  const items = state?.items || [], records = state?.records || [], groups = state?.groups || []
  const secrets = items.filter(item => effectiveContentKind(item) === 'secret')
  const recentItems = items.filter(item => !item.remoteOnly && (recentFilter === 'all' || effectiveContentKind(item) === recentFilter)).sort((a, b) => (Date.parse(b.downloadedAt) || 0) - (Date.parse(a.downloadedAt) || 0)).slice(0, 5)
  const cloudReady = Boolean(state?.isFeishuLoggedIn)
  const stats = [
    { label: '知识规模', value: items.length.toLocaleString(), hint: '条可见内容', icon: BookOpen, view: 'library' as const, series: dailyCounts(items.map(item => item.downloadedAt)), trend: '近7日入库' },
    { label: '加密资产', value: (secrets.length + (state?.projects.accounts.length || 0)).toLocaleString(), hint: '条凭据 / 账号', icon: KeyRound, view: 'vault' as const, series: dailyCounts(secrets.map(item => item.downloadedAt)), trend: '近7日凭据入库' },
    { label: '团队协作', value: groups.length.toLocaleString(), hint: '个用户组', icon: Users, view: 'groups' as const, series: dailyCounts(groups.map(group => group.createdAt)), trend: '近7日建组' },
    { label: '同步健康', value: !cloudReady ? '未连接' : state?.autoSync?.lastError ? '需处理' : state?.autoSync?.status === 'syncing' ? '同步中' : state?.autoSync?.lastSuccessAt ? '已同步' : '待同步', hint: `${records.length} 条云端记录`, icon: RefreshCw, view: 'sync' as const, series: dailyCounts(records.map(record => record.uploadedAt)), trend: '近7日上传' },
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
    <div className="vm-home vm-home-console animate-fade-in">
      <section className="vm-home-heading"><div><span className="vm-home-overline">MIZHAN / PRIVATE KNOWLEDGE CORE</span><h1>知识中枢 <span className="vm-console-title">秘栈</span></h1><p>个人知识 · 加密资产 · 团队协作 · 多端同步</p></div><div className="vm-home-heading-actions"><Button variant="outline" onClick={onSearch}><Search className="w-4 h-4" />搜索</Button><Button variant="primary" onClick={() => onNavigate('add')}><Plus className="w-4 h-4" />添加内容</Button></div></section>
      <section className="vm-stat-grid" aria-label="工作台概览">{stats.map(stat => <button key={stat.label} className="vm-stat-card vm-dashboard-stat text-left" onClick={() => onNavigate(stat.view)}><div className="vm-dashboard-stat-heading"><stat.icon className="w-4 h-4" /><span>{stat.label}</span><small>{stat.trend} {stat.series.reduce((a, b) => a + b, 0)}</small></div><div className="vm-dashboard-stat-value">{stat.value}<small>{stat.hint}</small></div><Sparkline values={stat.series} label={stat.trend} /></button>)}</section>
      <WorkbenchOverview onNavigate={onNavigate}>
        <article className="glass-card vm-recent-panel"><div className="vm-section-heading"><h2>最近内容 <small>RECENT CONTENT</small></h2><button className="vm-network-link" onClick={() => onNavigate('library')}>查看更多 <ArrowRight className="w-3 h-3" /></button></div><div className="vm-recent-tabs" role="group" aria-label="最近内容筛选">{[{ id: 'all', label: '全部' }, { id: 'file', label: '文件' }, { id: 'text', label: '笔记' }, { id: 'secret', label: '密码' }, { id: 'web', label: '链接' }].map(tab => <button key={tab.id} aria-pressed={recentFilter === tab.id} onClick={() => setRecentFilter(tab.id)}>{tab.label}</button>)}</div>
        <div className="vm-recent-list">{recentItems.length ? recentItems.map(item => <button key={item.id} className="vm-recent-row" onClick={() => openRecentItem(item)}><span className="vm-recent-icon">{effectiveContentKind(item) === 'secret' ? <KeyRound className="w-4 h-4" /> : <FileText className="w-4 h-4" />}</span><span className="vm-recent-name">{item.title || item.name}</span><span className="vm-recent-kind">{{ file: '文件', text: '笔记', secret: '密码', web: '链接', video: '视频' }[effectiveContentKind(item)] || '内容'}</span><span className="vm-recent-time">{formatTime(item.downloadedAt)}</span><ArrowRight className="w-3 h-3" /></button>) : <div className="vm-empty py-8"><FileText className="w-7 h-7" /><p>{items.length ? '该类型暂无本机内容' : '保险库还是空的'}</p><button className="vm-network-link" onClick={() => onNavigate('add')}>添加第一条内容 <ArrowRight className="w-3 h-3" /></button></div>}</div></article>
      </WorkbenchOverview>
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
