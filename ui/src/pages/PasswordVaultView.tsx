import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Key, Lock, Unlock, Copy, Check, Plus, Search, Eye, EyeOff,
  Globe, Terminal, FileKey2, Shield, Trash2, Github, Gitlab
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import PasswordGen from '@/components/shared/PasswordGen'
import type { LibraryItem } from '@/lib/ipc'

type Category = 'all' | 'secret' | 'api' | 'ssh' | 'git'

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode }[] = [
  { id: 'all',     label: '全部',     icon: <Shield className="w-3.5 h-3.5" /> },
  { id: 'secret',  label: '密码/密钥', icon: <Key className="w-3.5 h-3.5" /> },
  { id: 'api',     label: 'API Key',  icon: <Globe className="w-3.5 h-3.5" /> },
  { id: 'ssh',     label: 'SSH 密钥', icon: <Terminal className="w-3.5 h-3.5" /> },
  { id: 'git',     label: 'Git Token',icon: <Github className="w-3.5 h-3.5" /> },
]

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  github: <Github className="w-3.5 h-3.5" />,
  gitlab: <Gitlab className="w-3.5 h-3.5" />,
  git:    <Github className="w-3.5 h-3.5" />,
  svn:    <Terminal className="w-3.5 h-3.5" />,
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}天前`
  return date.toLocaleDateString('zh-CN')
}

export default function PasswordVaultView() {
  const { state, createLibraryItem, unlockItem, forgetItem, saveProjectAccount } = useAppStore()
  const toast = useToast()

  const [category, setCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')
  const [unlockedText, setUnlockedText] = useState<{ id: string; name: string; text: string } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showGen, setShowGen] = useState(false)

  // Add form
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newKind, setNewKind] = useState<'secret' | 'text'>('secret')

  // Combined items: library items (kind=secret) + project accounts
  const secretItems = (state?.items || []).filter(i => i.kind === 'secret' || i.kind === 'text')
  const projectAccounts = state?.projects?.accounts || []

  const filteredSecrets = secretItems.filter(item => {
    if (category !== 'all' && category !== 'secret' && item.kind !== 'text') return false
    if (search && !item.title?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const filteredAccounts = projectAccounts.filter(acc => {
    if (category === 'all' || category === 'git') return true
    if (category === 'api' && acc.provider !== 'git' && acc.provider !== 'svn') return true
    if (category === 'ssh' && acc.provider === 'ssh') return true
    return false
  })

  const copy = (id: string, val: string) => {
    navigator.clipboard.writeText(val)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast('已复制到剪贴板', 'success', 2000)
  }

  const handleDeleteItem = async (item: LibraryItem) => {
    if (!window.confirm(`确定要删除密码条目「${item.title || '未命名'}」吗？\n删除后不可恢复。`)) return
    await forgetItem(item.id)
    toast('已删除密码条目', 'info')
  }

  const handleUnlock = async (itemId: string) => {
    const result = await unlockItem(itemId)
    if (result.error) {
      toast(result.error, 'error')
    } else {
      setUnlockedText({ id: result.id || itemId, name: result.name || '', text: result.text || '' })
    }
  }

  const handleSave = async () => {
    if (!newTitle || !newContent) {
      toast('请填写标题和内容', 'warning')
      return
    }
    const result = await createLibraryItem({
      kind: newKind,
      title: newTitle,
      content: newContent,
    })
    if (result.error) {
      toast(result.error, 'error')
    } else {
      toast('密码已加密保存', 'success')
      setShowAdd(false)
      setNewTitle('')
      setNewContent('')
    }
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: '220px 1fr', alignItems: 'start' }}>
      {/* 左侧分类 */}
      <div className="glass-card rounded-md overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground" >
            <Key className="w-4 h-4" style={{ color: 'hsl(43 90% 60%)' }} />
            密码库
          </h2>
        </div>

        {/* 密码生成器入口 */}
        <div className="p-2 space-y-0.5">
          <button onClick={() => setShowGen(!showGen)}
            className={cn("w-full flex items-center gap-2 px-3 py-2 rounded text-xs transition-all",
              showGen ? "text-[hsl(190_90%_72%)] bg-[hsl(218_30%_11%)] border border-[hsl(190_60%_24%/0.35)]" : "text-[hsl(218_16%_54%)] hover:bg-[hsl(218_28%_10%)]")}>
            <FileKey2 className="w-3.5 h-3.5" />
            密码生成器
          </button>
        </div>

        {/* 分类树 */}
        <div className="px-3 py-2" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-[10px] uppercase tracking-wide mb-2 text-muted-foreground" >分类</p>
          <div className="space-y-0.5">
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all",
                  category === c.id ? "text-[hsl(190_90%_68%)] bg-[hsl(190_60%_14%/0.3)]" : "text-[hsl(218_16%_50%)] hover:bg-[hsl(218_28%_10%)]"
                )}>
                {c.icon}
                {c.label}
                <span className="ml-auto text-[10px] text-muted-foreground" >
                  {c.id === 'all' ? secretItems.length + projectAccounts.length
                    : c.id === 'git' ? projectAccounts.length
                    : secretItems.filter(i => i.kind === 'secret').length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧内容 */}
      <div className="flex flex-col gap-4">
        {showGen && (
          <div className="glass-card rounded-md p-4 animate-fade-in">
            <h2 className="text-sm font-semibold mb-4 text-foreground" >密码生成器</h2>
            <PasswordGen onUse={(pwd) => { setNewContent(pwd); setShowAdd(true); setShowGen(false) }} />
          </div>
        )}

        {/* 搜索 + 添加 */}
        <div className="glass-card rounded-md p-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"  />
            <input className="vm-input pl-9" placeholder="搜索密码、密钥..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="w-3.5 h-3.5" />
            添加密码
          </Button>
        </div>

        {/* 添加表单 */}
        {showAdd && (
          <div className="glass-card rounded-md p-4 space-y-3 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground" >添加新密码/密钥</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5 text-muted-foreground" >名称</label>
                <input className="vm-input" placeholder="GitHub 账号 / AWS Key"
                  value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs mb-1.5 text-muted-foreground" >类型</label>
                <select className="vm-input" value={newKind} onChange={e => setNewKind(e.target.value as any)}>
                  <option value="secret">密码/密钥</option>
                  <option value="text">文本笔记</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1.5 text-muted-foreground" >内容</label>
              <textarea className="vm-textarea" placeholder="密码、API Key、SSH 私钥..."
                value={newContent} onChange={e => setNewContent(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="success" className="flex-1" onClick={handleSave}>
                <Key className="w-4 h-4" />
                加密保存
              </Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>取消</Button>
            </div>
          </div>
        )}

        {/* 本地密码/密钥列表 */}
        {filteredSecrets.length > 0 && (
          <div className="glass-card rounded-md overflow-hidden">
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" >
                本地加密库
              </h3>
            </div>
            <div className="divide-y">
              {filteredSecrets.map(item => (
                <div key={item.id}
                  className="px-4 py-3 flex items-center gap-3 group transition-all"
                  style={{ borderBottom: '1px solid hsl(218 24% 11%)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'hsl(218 28% 10%)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(43 60% 16% / 0.4)', border: '1px solid hsl(43 60% 24% / 0.3)', color: 'hsl(43 90% 65%)' }}>
                    <Key className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground" >{item.title}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs truncate max-w-[200px] text-muted-foreground" >
                        {item.maskedText || '••••••••••••'}
                      </span>
                      <span className="text-[10px] text-muted-foreground" >
                        {formatTime(item.downloadedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Button variant="ghost" size="icon-sm" onClick={() => handleUnlock(item.id)} title="解锁查看">
                      <Unlock className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" style={{ color: 'hsl(352 84% 60%)' }}
                      onClick={() => handleDeleteItem(item)} title="删除">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Git/项目账号 Token 列表 */}
        {filteredAccounts.length > 0 && (
          <div className="glass-card rounded-md overflow-hidden">
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" >
                项目账号 Token
              </h3>
            </div>
            <div className="divide-y">
              {filteredAccounts.map(acc => (
                <div key={acc.id}
                  className="px-4 py-3 flex items-center gap-3 group transition-all"
                  style={{ borderBottom: '1px solid hsl(218 24% 11%)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'hsl(218 28% 10%)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(190 60% 16% / 0.4)', border: '1px solid hsl(190 60% 24% / 0.3)', color: 'hsl(190 90% 65%)' }}>
                    {PROVIDER_ICONS[acc.provider] || <Globe className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground" >{acc.label}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground" >{acc.username || '••••••••'}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-sm uppercase"
                        style={{ background: 'hsl(218 28% 14%)', color: 'hsl(218 16% 52%)' }}>
                        {acc.provider}
                      </span>
                      <span className="text-[10px] text-muted-foreground" >
                        {formatTime(acc.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {filteredSecrets.length === 0 && filteredAccounts.length === 0 && (
          <div className="glass-card rounded-md">
            <div className="vm-empty py-16">
              <Key className="w-10 h-10 text-muted-foreground"  />
              <p className="text-sm text-muted-foreground" >密码库为空</p>
              <p className="text-xs mt-1 text-muted-foreground" >
                点击「添加密码」创建第一个加密条目
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 解锁弹窗 */}
      {unlockedText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'hsl(218 42% 2% / 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setUnlockedText(null)}>
          <div className="w-full max-w-lg glass-panel rounded-xl overflow-hidden animate-scale-in"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground" >
                <Unlock className="w-4 h-4" style={{ color: 'hsl(152 72% 55%)' }} />
                {unlockedText.name}
              </h3>
              <Button variant="ghost" size="icon-sm" onClick={() => setUnlockedText(null)}>✕</Button>
            </div>
            <div className="p-5">
              <pre className="text-sm whitespace-pre-wrap break-all p-4 rounded-lg max-h-[400px] overflow-y-auto"
                style={{ background: 'hsl(218 36% 7%)', border: '1px solid var(--border)', color: 'hsl(43 90% 70%)' }}>
                {unlockedText.text}
              </pre>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" className="flex-1" onClick={() => copy(unlockedText.id, unlockedText.text)}>
                  {copiedId === unlockedText.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedId === unlockedText.id ? '已复制' : '复制'}
                </Button>
                <Button variant="ghost" onClick={() => setUnlockedText(null)}>关闭</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
