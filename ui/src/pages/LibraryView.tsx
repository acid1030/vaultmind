import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Search, File, FileText, Link2, Video, Key, Download,
  Trash2, Unlock, Database, Send, Bot, User2, Loader2, Eye, FolderOpen, RotateCcw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { effectiveContentKind } from '@/lib/content-kind'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import PageHero from '@/components/shared/PageHero'
import { useConfirmDialog } from '@/components/shared/ConfirmDialog'
import KnowledgeAnswer from '@/components/shared/KnowledgeAnswer'
import { vaultApi } from '@/lib/ipc'
import type { Evidence, LibraryItem, SyncRecord } from '@/lib/ipc'

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

type ChatMessage = { role: 'user' | 'assistant'; content: string; evidence?: Evidence[] }

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: '你好！我可以帮你检索本地知识库中的内容。试试问我「SSH 密钥在哪？」或「最新的 API 规范是什么？」',
}

export default function LibraryView({ context }: LibraryViewProps) {
  const {
    state,
    unlockItem,
    openItem,
    saveItemFile,
    forgetItem,
    forgetRecord,
    downloadRecord,
    openAsset,
    queryKnowledge,
  } = useAppStore()
  const toast = useToast()
  const { confirm, confirmDialog } = useConfirmDialog()

  const items = state?.items || []
  const records = state?.records || []
  const aiReady = Boolean(state?.knowledgeCenter?.aiProfile?.baseUrl && state?.knowledgeCenter?.aiProfile?.model)
  const remoteCount = items.filter(item => item.remoteOnly).length + records.filter(record => !record.localPath).length

  const [search, setSearch] = useState('')
  const [question, setQuestion] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [isQuerying, setIsQuerying] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [preview, setPreview] = useState<{ open: boolean; item?: LibraryItem; content?: string; url?: string; kind?: string; loading: boolean }>({ open: false, loading: false })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [chatMessages, isQuerying])

  const filteredItems = items.filter((item: LibraryItem) => {
    const f = FILTERS.find(fi => fi.id === filter)
    if (f?.kind && effectiveContentKind(item) !== f.kind) return false
    if (search) {
      const q = search.toLowerCase()
      const tags = parseTags(item.tags).join(' ')
      if (!item.title.toLowerCase().includes(q) && !tags.toLowerCase().includes(q)) return false
    }
    return true
  })

  const handleUnlock = async (item: LibraryItem) => {
    setPreview({ open: true, item, loading: true })
    const result = await unlockItem(item.id)
    if (result.error) {
      setPreview({ open: false, loading: false })
      toast(result.error, 'error')
    } else {
      setPreview({ open: true, item, content: result.text || '', kind: effectiveContentKind(item), loading: false })
    }
  }

  const handleOpen = async (item: LibraryItem) => {
    setPreview({ open: true, item, loading: true })
    const result = await openItem(item.id)
    if (result.error) {
      setPreview({ open: false, loading: false })
      toast(result.error, 'error')
      return
    }
    if (result.opened) {
      setPreview({ open: false, loading: false })
      toast('已用系统应用打开文件', 'success')
      return
    }
    setPreview({ open: true, item, content: result.content, url: result.url, kind: result.kind, loading: false })
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
    if (!await confirm({
      title: '删除内容条目？',
      description: `「${item.title || '未命名'}」将从本地知识库中永久移除，此操作无法撤销。`,
      confirmLabel: '删除条目',
    })) return
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

  const handleOpenRecord = async (record: SyncRecord) => {
    const result = await openAsset({ assetId: record.id, sourceTable: 'records' })
    if (!result?.opened) toast('本地文件无法打开，请检查原文件是否仍在该路径', 'warning')
  }

  const handleDownloadItem = async (item: LibraryItem) => {
    const record = records.find(record => record.assetId === item.id || record.id === item.recordId)
    if (!record) {
      toast('没有找到对应的云端加密文件，请先拉取同步清单', 'warning')
      return
    }
    await handleDownloadRecord(record)
  }

  const handleOpenEvidence = async (evidence: Evidence) => {
    if (!evidence.assetId) return
    if (evidence.sourceTable === 'library_items') {
      const item = items.find(entry => entry.id === evidence.assetId)
      if (item && !item.remoteOnly) {
        if (effectiveContentKind(item) === 'secret') await handleUnlock(item)
        else await handleOpen(item)
        return
      }
    }
    const result = await openAsset({ assetId: evidence.assetId, sourceTable: evidence.sourceTable })
    if (!result?.opened) toast('该来源当前无法直接打开', 'warning')
  }

  const handleDeleteRecord = async (record: SyncRecord) => {
    if (!await confirm({
      title: '移除本地同步记录？',
      description: `「${record.fileName || '未命名'}」的本地索引会被移除，飞书云端中的加密文件仍会保留。`,
      confirmLabel: '移除记录',
    })) return
    await forgetRecord(record.id)
    toast('已删除同步记录', 'info')
  }

  const handleQuery = async () => {
    if (!question.trim()) return
    const userMsg = question
    setQuestion('')
    setChatMessages(prev => [...prev, { role: 'user' as const, content: userMsg }])
    setIsQuerying(true)
    const { answer, evidence, error } = await queryKnowledge(userMsg, {})
    setIsQuerying(false)
    if (error) {
      toast(error, 'error')
      setChatMessages(prev => [...prev, { role: 'assistant', content: `### 暂时无法完成检索\n\n${error}\n\n请检查知识源或模型配置后重试。` }])
    } else {
      setChatMessages(prev => [...prev, { role: 'assistant' as const, content: answer || '未找到相关结果', evidence }])
    }
  }

  return (
    <div className="vm-page-stack vm-library-page animate-fade-in">
      <PageHero
        eyebrow="知识资产"
        title="知识库与智能检索"
        description="浏览本地与云端资料，直接打开原文，或基于已授权来源进行问答。"
        details={[`${items.length + records.length} 项内容`, remoteCount ? `${remoteCount} 项待取回` : '全部本机可用', aiReady ? 'AI 模型已连接' : '本地检索模式']}
      />
      <div className="vm-library-grid">
      {/* 左栏：内容库 */}
      <div className="vm-library-sidebar flex flex-col gap-4">
        {/* 搜索 */}
        <div className="glass-card rounded-md p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input className="vm-input pl-9" placeholder="搜索标题与标签..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* 类型筛选 */}
          <div className="vm-library-filters flex gap-1 flex-wrap">
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
            <Button variant="ghost" size="icon-sm" title="在访达中查看本地数据库" onClick={() => vaultApi.showDatabase()}>
              <Database className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="divide-y divide-border">
            {filteredItems.length === 0 ? (
              <div className="vm-empty">
                <FileText className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
                <p className="vm-empty-title">没有找到匹配的内容</p>
                <p className="vm-empty-description">尝试缩短关键词、切换内容类型，或从“添加内容”录入新资料。</p>
              </div>
            ) : filteredItems.map((item: LibraryItem) => {
              const kc = kindConfig(effectiveContentKind(item))
              const cc = COLOR_CLASSES[kc.color]
              const Icon = kc.icon
              return (
                <div key={item.id}
                  onClick={() => !item.remoteOnly && effectiveContentKind(item) !== 'secret' && handleOpen(item)}
                  className={cn("px-4 py-3 flex items-center gap-3 group transition-colors hover:bg-muted border-b border-border last:border-b-0", !item.remoteOnly && effectiveContentKind(item) !== 'secret' && 'cursor-pointer')}>
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
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={event => event.stopPropagation()}>
                    {item.remoteOnly ? (
                      <Button variant="cyan" size="sm" title="从云端下载并解密到本机" onClick={() => handleDownloadItem(item)}>
                        <Download className="w-3 h-3" />取回
                      </Button>
                    ) : effectiveContentKind(item) === 'secret' ? (
                      <Button variant="ghost" size="sm" title="主动解锁并查看凭据" onClick={() => handleUnlock(item)}>
                        <Unlock className="w-3 h-3" />解锁
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" title={effectiveContentKind(item) === 'file' ? '打开本地文件' : '直接查看本地内容'} onClick={() => handleOpen(item)}>
                        {effectiveContentKind(item) === 'file' ? <FolderOpen className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {effectiveContentKind(item) === 'file' ? '打开' : '查看'}
                      </Button>
                    )}
                    {effectiveContentKind(item) === 'file' && !item.remoteOnly && Boolean(item.recordId || item.sourcePath) && (
                      <Button variant="ghost" size="icon-sm" title="另存为" className="opacity-0 group-hover:opacity-100" onClick={() => handleSaveFile(item)}>
                        <Download className="w-3 h-3" />
                      </Button>
                    )}
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
            <h2 className="text-sm font-semibold text-foreground">飞书同步记录 <span className="ml-1 text-xs font-normal text-muted-foreground">{records.length} 项</span></h2>
          </div>
          <div className="divide-y divide-border overflow-y-scroll overscroll-contain" style={{ maxHeight: '45vh' }}>
            {records.length === 0 ? (
              <div className="vm-empty py-8">
                <Database className="w-8 h-8 text-muted-foreground" />
                <p className="vm-empty-title">暂无同步记录</p>
                <p className="vm-empty-description">完成一次飞书加密同步后，远端文件会显示在这里。</p>
              </div>
            ) : records.map((r: SyncRecord) => (
              <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate text-foreground">{r.fileName}</p>
                  <p className="text-[10px] mt-0.5 text-muted-foreground">{formatSize(r.size)}</p>
                </div>
                <div className={cn("vm-badge text-[10px]",
                  r.localPath ? 'vm-badge-emerald' : 'vm-badge-gold')}>
                  {r.localPath ? '本机可用' : '云端待取回'}
                </div>
                <div className="flex gap-1">
                  {r.localPath ? (
                    <Button variant="ghost" size="sm" title="打开原始本地文件" onClick={() => handleOpenRecord(r)}><FolderOpen className="w-3 h-3" />打开</Button>
                  ) : (
                    <Button variant="cyan" size="sm" title="从云端下载并解密到本机" onClick={() => handleDownloadRecord(r)}><Download className="w-3 h-3" />取回</Button>
                  )}
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
      <div className="glass-panel rounded-xl flex flex-col vm-library-chat">
        {/* 头部 */}
        <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0 border-b border-border">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted border border-border">
            <Bot className="w-5 h-5 text-cyan" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">知识库对话</h2>
            <p className="text-xs mt-0.5 text-muted-foreground">
              优先检索本地库 · 飞书 Wiki · Obsidian
            </p>
          </div>
          <div className={cn('ml-auto vm-badge text-[10px]', aiReady ? 'vm-badge-emerald' : 'vm-badge-cyan')}>
            {aiReady ? '模型已连接' : '本地检索'}
          </div>
          {chatMessages.length > 1 && (
            <Button variant="ghost" size="icon-sm" title="清空当前对话" onClick={() => setChatMessages([WELCOME_MESSAGE])}>
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
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
              <div className={cn("flex flex-col gap-1", msg.role === 'assistant' ? 'max-w-[92%]' : 'max-w-[78%]',
                msg.role === 'user' ? 'items-end' : 'items-start')}>
                <span className="text-[10px] text-muted-foreground">
                  {msg.role === 'assistant' ? 'AxonMind AI' : '你'}
                </span>
                <div className={cn("px-4 py-3 rounded-xl text-sm leading-relaxed text-foreground min-w-0",
                  msg.role === 'user'
                    ? "rounded-tr-sm bg-emerald/10 border border-emerald/30"
                    : "rounded-tl-sm bg-card border border-border")}>
                  {msg.role === 'assistant'
                    ? <KnowledgeAnswer content={msg.content} evidence={msg.evidence} onOpenEvidence={handleOpenEvidence} />
                    : msg.content}
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
          <div ref={messagesEndRef} />
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

      {/* 内容预览弹窗 */}
      {preview.open && (
        <div className="vm-modal-mask fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setPreview({ open: false, loading: false })}>
          <div className="glass-card rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold truncate pr-4">{preview.item?.title}</h3>
              <button onClick={() => setPreview({ open: false, loading: false })} className="text-muted-foreground hover:text-foreground text-lg">×</button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {preview.loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-cyan" />
                </div>
              ) : preview.url ? (
                <a href={preview.url} target="_blank" rel="noreferrer" className="text-sm text-cyan hover:underline break-all" onClick={(e) => { e.preventDefault(); vaultApi.openExternal?.(preview.url || '') }}>{preview.url}</a>
              ) : (
                <pre className="text-xs whitespace-pre-wrap font-mono text-foreground">{preview.content}</pre>
              )}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setPreview({ open: false, loading: false })}>关闭</Button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
      </div>
    </div>
  )
}
