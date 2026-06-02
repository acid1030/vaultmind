import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Search, File, FileText, Link2, Video, Key, Download,
  Trash2, Lock, Unlock, Database, Send, Bot, User2,
  ChevronRight, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LibraryViewProps {
  context: string
}

const MOCK_ITEMS = [
  { id: '1', title: 'AWS 生产环境密钥', kind: 'key', tags: ['aws', 'prod'], time: '2小时前', group: false },
  { id: '2', title: '系统架构设计文档.docx', kind: 'file', tags: ['架构', '文档'], time: '昨天', group: false },
  { id: '3', title: 'GitHub Token (个人)', kind: 'key', tags: ['github', 'token'], time: '3天前', group: false },
  { id: '4', title: 'API 设计规范', kind: 'text', tags: ['api', '规范'], time: '上周', group: false },
  { id: '5', title: 'Stripe Webhook Secret', kind: 'key', tags: ['stripe', 'webhook'], time: '2周前', group: false },
  { id: '6', title: '产品路线图 Q3 2026', kind: 'text', tags: ['产品', '路线图'], time: '3周前', group: true },
]

const MOCK_RECORDS = [
  { id: 'r1', name: 'backup-2026-01.axonvault', type: 'file', size: '2.4 MB', status: 'synced' },
  { id: 'r2', name: 'keys-encrypted.axonvault', type: 'key', size: '12 KB', status: 'synced' },
  { id: 'r3', name: 'docs-bundle.axonvault', type: 'file', size: '8.1 MB', status: 'pending' },
]

const KIND_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  key: { icon: <Key className="w-3.5 h-3.5" />, label: '密钥', color: 'hsl(43 90% 60%)' },
  file: { icon: <File className="w-3.5 h-3.5" />, label: '文件', color: 'hsl(190 90% 60%)' },
  text: { icon: <FileText className="w-3.5 h-3.5" />, label: '文本', color: 'hsl(152 72% 52%)' },
  link: { icon: <Link2 className="w-3.5 h-3.5" />, label: '链接', color: 'hsl(262 80% 72%)' },
  video: { icon: <Video className="w-3.5 h-3.5" />, label: '视频', color: 'hsl(352 84% 66%)' },
}

const MOCK_CHAT = [
  { role: 'assistant', content: '你好！我可以帮你检索本地知识库中的内容。试试问我「SSH 密钥在哪？」或「最新的 API 规范是什么？」' },
]

export default function LibraryView({ context }: LibraryViewProps) {
  const [search, setSearch] = useState('')
  const [question, setQuestion] = useState('')
  const [chatMessages, setChatMessages] = useState(MOCK_CHAT)
  const [isQuerying, setIsQuerying] = useState(false)
  const [filter, setFilter] = useState<string>('all')

  const filteredItems = MOCK_ITEMS.filter(item => {
    if (filter !== 'all' && item.kind !== filter) return false
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleQuery = async () => {
    if (!question.trim()) return
    const userMsg = question
    setQuestion('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setIsQuerying(true)
    await new Promise(r => setTimeout(r, 1400))
    setIsQuerying(false)
    setChatMessages(prev => [...prev, {
      role: 'assistant',
      content: `根据本地知识库检索，我找到了以下相关内容：\n\n**AWS 生产环境密钥** 中包含 ${userMsg} 相关信息。该密钥于 2小时前更新，存储在个人加密库中。\n\n如需查看明文，请输入本地密码解锁。`
    }])
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: '400px 1fr', alignItems: 'start' }}>
      {/* 左栏：内容库 */}
      <div className="flex flex-col gap-4">
        {/* 搜索 */}
        <div className="glass-card rounded-md p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(218 16% 44%)' }} />
            <input className="vm-input pl-9" placeholder="搜索标题与标签..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* 类型筛选 */}
          <div className="flex gap-1 flex-wrap">
            {[
              { id: 'all', label: '全部' },
              { id: 'key', label: '密钥' },
              { id: 'file', label: '文件' },
              { id: 'text', label: '文本' },
              { id: 'link', label: '链接' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-medium transition-all",
                  filter === f.id
                    ? "text-[hsl(190_90%_72%)] bg-[hsl(190_60%_16%/0.5)] border border-[hsl(190_60%_24%/0.4)]"
                    : "text-[hsl(218_16%_50%)] hover:text-[hsl(210_30%_75%)] hover:bg-[hsl(218_28%_12%)]"
                )}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 条目列表 */}
        <div className="glass-card rounded-md overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid hsl(218 24% 14%)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'hsl(210 30% 90%)' }}>
              内容条目 <span className="text-xs font-normal ml-1" style={{ color: 'hsl(218 16% 48%)' }}>
                {filteredItems.length} 项
              </span>
            </h2>
            <Button variant="ghost" size="icon-sm" title="查看 SQLite 数据库">
              <Database className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="divide-y divide-[hsl(218_24%_12%)]">
            {filteredItems.length === 0 ? (
              <div className="vm-empty">
                <Search className="w-8 h-8" style={{ color: 'hsl(218 16% 32%)' }} />
                <p className="text-xs">没有找到匹配的内容</p>
              </div>
            ) : filteredItems.map(item => {
              const kc = KIND_CONFIG[item.kind] || KIND_CONFIG.file
              return (
                <div key={item.id} className="px-4 py-3 flex items-center gap-3 group transition-colors cursor-pointer"
                  style={{ borderBottom: '1px solid hsl(218 24% 12%)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'hsl(218 30% 10%)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  {/* 图标 */}
                  <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `${kc.color}14`,
                      border: `1px solid ${kc.color}28`,
                      color: kc.color,
                    }}>
                    {kc.icon}
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate" style={{ color: 'hsl(210 30% 90%)' }}>
                        {item.title}
                      </span>
                      {item.group && (
                        <span className="vm-badge vm-badge-violet text-[10px] flex-shrink-0">组</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{ color: 'hsl(218 16% 44%)' }}>{item.time}</span>
                      {item.tags.map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-sm"
                          style={{ background: 'hsl(218 28% 14%)', color: 'hsl(218 16% 52%)' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 操作 */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Button variant="ghost" size="icon-sm" title="解锁查看">
                      <Unlock className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="保存到文件">
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="删除"
                      style={{ color: 'hsl(352 84% 60%)' }}>
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
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid hsl(218 24% 14%)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'hsl(210 30% 90%)' }}>飞书同步记录</h2>
          </div>
          <div className="divide-y divide-[hsl(218_24%_11%)]">
            {MOCK_RECORDS.map(r => (
              <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'hsl(210 30% 85%)' }}>{r.name}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'hsl(218 16% 44%)' }}>{r.size}</p>
                </div>
                <div className={cn("vm-badge text-[10px]",
                  r.status === 'synced' ? 'vm-badge-emerald' : 'vm-badge-gold')}>
                  {r.status === 'synced' ? '已同步' : '待下载'}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm">
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" style={{ color: 'hsl(352 84% 60%)' }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右栏：AI 知识库对话 */}
      <div className="glass-panel rounded-xl flex flex-col"
        style={{ height: 'calc(100vh - 88px)' }}>
        {/* 头部 */}
        <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0"
          style={{ borderBottom: '1px solid hsl(218 24% 14%)' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(145deg, hsl(190 60% 20%), hsl(262 50% 22%))',
              border: '1px solid hsl(190 60% 28% / 0.4)',
            }}>
            <Bot className="w-5 h-5" style={{ color: 'hsl(190 90% 72%)' }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'hsl(210 30% 92%)' }}>知识库对话</h2>
            <p className="text-xs mt-0.5" style={{ color: 'hsl(218 16% 48%)' }}>
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
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                msg.role === 'assistant'
                  ? "bg-gradient-to-br from-[hsl(190_60%_24%)] to-[hsl(262_50%_28%)] border border-[hsl(190_60%_30%/0.4)]"
                  : "bg-gradient-to-br from-[hsl(152_50%_22%)] to-[hsl(190_50%_22%)] border border-[hsl(152_50%_30%/0.4)]")}>
                {msg.role === 'assistant'
                  ? <Bot className="w-4 h-4" style={{ color: 'hsl(190 90% 72%)' }} />
                  : <User2 className="w-4 h-4" style={{ color: 'hsl(152 72% 65%)' }} />}
              </div>

              {/* 气泡 */}
              <div className={cn("flex flex-col gap-1 max-w-[78%]",
                msg.role === 'user' ? 'items-end' : 'items-start')}>
                <span className="text-[10px]" style={{ color: 'hsl(218 16% 44%)' }}>
                  {msg.role === 'assistant' ? 'VaultMind AI' : '你'}
                </span>
                <div className={cn("px-4 py-3 rounded-xl text-sm leading-relaxed",
                  msg.role === 'user'
                    ? "rounded-tr-sm"
                    : "rounded-tl-sm")}
                  style={msg.role === 'user'
                    ? {
                      background: 'linear-gradient(135deg, hsl(152 50% 18% / 0.6), hsl(190 50% 16% / 0.6))',
                      border: '1px solid hsl(152 50% 26% / 0.4)',
                      color: 'hsl(210 30% 90%)',
                    }
                    : {
                      background: 'hsl(218 30% 10% / 0.8)',
                      border: '1px solid hsl(218 24% 16%)',
                      color: 'hsl(218 16% 72%)',
                    }}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {isQuerying && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'linear-gradient(145deg, hsl(190 60% 24%), hsl(262 50% 28%))',
                  border: '1px solid hsl(190 60% 30% / 0.4)',
                }}>
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'hsl(190 90% 72%)' }} />
              </div>
              <div className="px-4 py-3 rounded-xl rounded-tl-sm text-xs"
                style={{
                  background: 'hsl(218 30% 10% / 0.8)',
                  border: '1px solid hsl(218 24% 16%)',
                  color: 'hsl(218 16% 50%)',
                }}>
                正在检索知识库...
              </div>
            </div>
          )}
        </div>

        {/* 输入区 */}
        <div className="px-5 pb-4 pt-3 flex-shrink-0"
          style={{ borderTop: '1px solid hsl(218 24% 13%)' }}>
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
          <p className="text-[10px] mt-2" style={{ color: 'hsl(218 16% 36%)' }}>
            Enter 发送 · Shift+Enter 换行 · 优先检索本地加密库
          </p>
        </div>
      </div>
    </div>
  )
}
