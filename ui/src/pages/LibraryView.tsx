import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Search, File, FileText, Link2, Video, Key, Download,
  Trash2, Unlock, Database, Send, Bot, User2, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import type { LibraryItem, SyncRecord } from '@/lib/ipc'

interface LibraryViewProps {
  context: string
}

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'key', label: '密钥', kind: 'secret' },
  { id: 'file', label: '文件', kind: 'file' },
  { id: 'text', label: '文本', kind: 'text' },
  { id: 'link', label: '链接', kind: 'web' },
]

type KindColor = 'gold' | 'cyan' | 'emerald' | 'violet' | 'rose'

const KIND_CONFIG: Record<string, { icon: React.ElementType; label: string; color: KindColor }> = {
  secret: { icon: Key, label: '密钥', color: 'gold' },
  file: { icon: File, label: '文件', color: 'cyan' },
  text: { icon: FileText, label: '文本', color: 'emerald' },
  web: { icon: Link2, label: '链接', color: 'violet' },
  video: { icon: Video, label: '视频', color: 'rose' },
}

const COLOR_CLASSES: Record<KindColor, { container: string; icon: string }> = {
  gold: { container: 'bg-gold/10 border-gold/30', icon: 'text-gold' },
  cyan: { container: 'bg-cyan/10 border-cyan/30', icon: 'text-cyan' },
  emerald: { container: 'bg-emerald/10 border-emerald/30', icon: 'text-emerald' },
  violet: { container: 'bg-violet/10 border-violet/30', icon: 'text-violet' },
  rose: { container: 'bg-rose/10 border-rose/30', icon: 'text-rose' },
}

function kindConfig(kind: string) {
  return KIND_CONFIG[kind] || { icon: FileText, label: kind || '内容', color: 'cyan' as KindColor }
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString()
}

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function parseTags(tags: string): string[] {
  if (!tags) return []
  try {
    const parsed = JSON.parse(tags)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // fall through
  }
  return String(tags).split(/[,，\s]+/).filter(Boolean)
}

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: '你好！我可以帮你检索本地知识库中的内容。试试问我「SSH 密钥在哪？」或「最新的 API 规范是什么？」',
}

export default function LibraryView({ context }: LibraryViewProps) {
  const {
    state,
    unlockItem,
    saveItemFile,
    forgetItem,
    forgetRecord,
    downloadRecord,
    queryKnowledge,
  } = useAppStore()
  const toast = useToast()

  const items = state?.items || []
  const records = state?.records || []

  const [search, setSearch] = useState('')
  const [question, setQuestion] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [isQuerying, setIsQuerying] = useState(false)
  const [filter, setFilter] = useState<string>('all')

  const filteredItems = items.filter((item: LibraryItem) => {
    const f = FILTERS.find(fi => fi.id === filter)
    if (f?.kind && item.kind !== f.kind) return false
    if (search) {
      const q = search.toLowerCase()
      const tags = parseTags(item.tags).join(' ')
      if (!item.title.toLowerCase().includes(q) && !tags.toLowerCase().includes(q)) return false
    }
    return true
  })

  const handleUnlock = async (item: LibraryItem) => {
    const result = await unlockItem(item.id)
    if (result.error) {
      toast(result.error, 'error')
    } else {
      toast('内容已解锁', 'success')
    }
  }

  const handleSaveFile = async (item: LibraryItem) => {
    const result = await saveItemFile(item.id)
    if (result.error) {
      toast(result.error, 'error')
    } else {
      toast('文件已保存', 'success')
    }
  }

  const handleDeleteItem = async (item: LibraryItem) => {
    await forgetItem(item.id)
    toast('已删除内容条目', 'info')
  }

  const handleDownloadRecord = async (record: SyncRecord) => {
    const passphrase = state?.settings?.feishuPassphrase || ''
    const result = await downloadRecord(record.id, passphrase)
    if (result.error) {
      toast(result.error, 'error')
    } else {
      toast('文件已取回并解密', 'success')
    }
  }

  const handleDeleteRecord = async (record: SyncRecord) => {
    await forgetRecord(record.id)
    toast('已删除同步记录', 'info')
  }

  const handleQuery = async () => {
    if (!question.trim()) return
    const userMsg = question
    setQuestion('')
    setChatMessages(prev => [...prev, { role: 'user' as const, content: userMsg }])
    setIsQuerying(true)
    const { answer, error } = await queryKnowledge(userMsg, {})
    setIsQuerying(false)
    if (error) {
      toast(error, 'error')
    } else {
      setChatMessages(prev => [...prev, { role: 'assistant' as const, content: answer || '未找到相关结果' }])
    }
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: '400px 1fr', alignItems: 'start' }}>
      {/* 左栏：内容库 */}
      <div className="flex flex-col gap-4">
        {/* 搜索 */}
        <div className="glass-card rounded-md p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input className="vm-input pl-9" placeholder="搜索标题与标签..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* 类型筛选 */}
          <div className="flex gap-1 flex-wrap">
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-medium transition-all border",
                  filter === f.id
                    ? "bg-cyan/10 text-cyan border-cyan/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
                )}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 条目列表 */}
        <div className="glass-card rounded-md overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              内容条目 <span className="text-xs font-normal ml-1 text-muted-foreground">
                {filteredItems.length} 项
              </span>
            </h2>
            <Button variant="ghost" size="icon-sm" title="查看 SQLite 数据库">
              <Database className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="divide-y divide-border">
            {filteredItems.length === 0 ? (
              <div className="vm-empty">
                <Search className="w-8 h-8 text-muted-foreground" />
                <p className="text-xs">没有找到匹配的内容</p>
              </div>
            ) : filteredItems.map((item: LibraryItem) => {
              const kc = kindConfig(item.kind)
              const cc = COLOR_CLASSES[kc.color]
              const Icon = kc.icon
              return (
                <div key={item.id}
                  className="px-4 py-3 flex items-center gap-3 group transition-colors cursor-pointer hover:bg-muted border-b border-border last:border-b-0">
                  {/* 图标 */}
                  <div className={cn(
                    "w-9 h-9 rounded flex items-center justify-center flex-shrink-0",
                    cc.container,
                    cc.icon
                  )}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate text-foreground">
                        {item.title}
                      </span>
                      {item.scope === 'group' && (
                        <span className="vm-badge vm-badge-violet text-[10px] flex-shrink-0">组</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatTime(item.downloadedAt)}</span>
                      {parseTags(item.tags).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 操作 */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Button variant="ghost" size="icon-sm" title="解锁查看" onClick={() => handleUnlock(item)}>
                      <Unlock className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="保存到文件" onClick={() => handleSaveFile(item)}>
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="删除" className="text-rose hover:text-rose"
                      onClick={() => handleDeleteItem(item)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 飞书同步记录 */}
        <div className="glass-card rounded-md overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">飞书同步记录</h2>
          </div>
          <div className="divide-y divide-border">
            {records.length === 0 ? (
              <div className="vm-empty py-8">
                <Database className="w-8 h-8 text-muted-foreground" />
                <p className="text-xs">暂无同步记录</p>
              </div>
            ) : records.map((r: SyncRecord) => (
              <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate text-foreground">{r.fileName}</p>
                  <p className="text-[10px] mt-0.5 text-muted-foreground">{formatSize(r.size)}</p>
                </div>
                <div className={cn("vm-badge text-[10px]",
                  r.token ? 'vm-badge-emerald' : 'vm-badge-gold')}>
                  {r.token ? '已同步' : '待下载'}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" title="下载解密" onClick={() => handleDownloadRecord(r)}>
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" title="删除" className="text-rose hover:text-rose"
                    onClick={() => handleDeleteRecord(r)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右栏：AI 知识库对话 */}
      <div className="glass-panel rounded-xl flex flex-col" style={{ height: 'calc(100vh - 88px)' }}>
        {/* 头部 */}
        <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0 border-b border-border">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted border border-border">
            <Bot className="w-5 h-5 text-cyan" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">知识库对话</h2>
            <p className="text-xs mt-0.5 text-muted-foreground">
              优先检索本地库 · 飞书 Wiki · Obsidian
            </p>
          </div>
          <div className="ml-auto vm-badge vm-badge-cyan text-[10px]">AI 就绪</div>
        </div>

        {/* 对话区域 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 min-h-0">
          {chatMessages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3 animate-fade-in",
              msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
              {/* 头像 */}
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border",
                msg.role === 'assistant'
                  ? "bg-muted border-border"
                  : "bg-emerald/10 border-emerald/30")}>
                {msg.role === 'assistant'
                  ? <Bot className="w-4 h-4 text-cyan" />
                  : <User2 className="w-4 h-4 text-emerald" />}
              </div>

              {/* 气泡 */}
              <div className={cn("flex flex-col gap-1 max-w-[78%]",
                msg.role === 'user' ? 'items-end' : 'items-start')}>
                <span className="text-[10px] text-muted-foreground">
                  {msg.role === 'assistant' ? 'VaultMind AI' : '你'}
                </span>
                <div className={cn("px-4 py-3 rounded-xl text-sm leading-relaxed text-foreground",
                  msg.role === 'user'
                    ? "rounded-tr-sm bg-emerald/10 border border-emerald/30"
                    : "rounded-tl-sm bg-card border border-border")}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {isQuerying && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted border border-border">
                <Loader2 className="w-4 h-4 animate-spin text-cyan" />
              </div>
              <div className="px-4 py-3 rounded-xl rounded-tl-sm text-xs bg-card border border-border text-muted-foreground">
                正在检索知识库...
              </div>
            </div>
          )}
        </div>

        {/* 输入区 */}
        <div className="px-5 pb-4 pt-3 flex-shrink-0 border-t border-border">
          <div className="flex gap-2 items-end">
            <textarea
              className="vm-textarea flex-1 min-h-[52px] max-h-[120px]"
              placeholder="输入问题，例如：SSH 密钥在哪？"
              rows={2}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleQuery()
                }
              }}
            />
            <Button variant="primary" className="h-[52px] px-4 flex-shrink-0" onClick={handleQuery} disabled={isQuerying}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] mt-2 text-muted-foreground">
            Enter 发送 · Shift+Enter 换行 · 优先检索本地加密库
          </p>
        </div>
      </div>
    </div>
  )
}
