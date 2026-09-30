import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Key, Lock, Unlock, Copy, Check, Plus, Search, Eye, EyeOff,
  Globe, Terminal, FileKey2, Shield, Trash2, Github, Gitlab, Download
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { effectiveContentKind } from '@/lib/content-kind'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import PasswordGen from '@/components/shared/PasswordGen'
import PageHero from '@/components/shared/PageHero'
import { useConfirmDialog } from '@/components/shared/ConfirmDialog'
import { vaultApi, type LibraryItem } from '@/lib/ipc'

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
  const { state, createLibraryItem, unlockItem, forgetItem, downloadRecord } = useAppStore()
  const toast = useToast()
  const { confirm, confirmDialog } = useConfirmDialog()

  const [category, setCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [unlockedText, setUnlockedText] = useState<{ id: string; name: string; text: string } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showGen, setShowGen] = useState(false)

  // Add form
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')

  // Combined items: explicit secrets and clearly secret-like legacy text entries.
  const secretItems = (state?.items || []).filter(i => effectiveContentKind(i) === 'secret')
  const projectAccounts = state?.projects?.accounts || []
  const records = state?.records || []
  const remoteSecretCount = secretItems.filter(item => item.remoteOnly).length

  const filteredSecrets = secretItems.filter(item => {
    const title = item.title || ''
    if (category === 'api' && !/(?:api\s*[-_]?\s*key|access\s*[-_]?\s*key|token|secret)/i.test(title)) return false
    if (category === 'ssh' && !/(?:ssh|私钥|公钥|private\s*[-_]?\s*key)/i.test(title)) return false
    if (category === 'git' && !/(?:git|github|gitlab|gitee|token)/i.test(title)) return false
    if (search && !item.title?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const filteredAccounts = projectAccounts.filter(acc => {
    if (category === 'all' || category === 'git') return true
    if (category === 'api' && acc.provider !== 'git' && acc.provider !== 'svn') return true
    if (category === 'ssh' && acc.provider === 'ssh') return true
    return false
  })
  const selectedItem = filteredSecrets.find(item => item.id === selectedId) || filteredSecrets[0]

  const copy = async (id: string, val: string) => {
    await vaultApi.copySensitiveText(val)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast('已复制，剪贴板将在 30 秒后自动清除', 'success', 3000)
  }

  const handleDeleteItem = async (item: LibraryItem) => {
    if (!await confirm({
      title: '删除加密凭据？',
      description: `「${item.title || '未命名'}」将从密码库中永久移除，删除后无法恢复。`,
      confirmLabel: '删除凭据',
    })) return
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

  const handleDownload = async (item: LibraryItem) => {
    const record = records.find(entry => entry.assetId === item.id || entry.id === item.recordId)
    if (!record) {
      toast('没有找到对应的云端加密记录，请先到同步中心拉取清单', 'warning')
      return
    }
    const result = await downloadRecord(record.id, state?.settings?.feishuPassphrase || '')
    if (result.error) toast(result.error, 'error')
    else toast('凭据已安全取回到本机', 'success')
  }

  const handleSave = async () => {
    if (!newTitle || !newContent) {
      toast('请填写标题和内容', 'warning')
      return
    }
    const result = await createLibraryItem({
      kind: 'secret',
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
    <div className="vm-page-stack animate-fade-in">
      <PageHero
        eyebrow="加密凭据"
        title="密码与密钥"
        description="集中管理密码、API Key、SSH 密钥和项目令牌；默认隐藏，主动操作后才会解锁。"
        details={[`${secretItems.length + projectAccounts.length} 项凭据`, remoteSecretCount ? `${remoteSecretCount} 项待取回` : '本机可用', '按需解锁']}
        tone="cyan"
      />
      <div className="vm-sidebar-grid vm-vault-grid">
      {/* 左侧分类 */}
      <div className="glass-card rounded-md overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground" >
            <Key className="w-4 h-4 text-primary" />
            密码库
          </h2>
        </div>

        {/* 密码生成器入口 */}
        <div className="p-2 space-y-0.5">
          <button onClick={() => setShowGen(!showGen)}
            className={cn("w-full flex items-center gap-2 px-3 py-2 rounded text-xs transition-all",
              showGen ? "text-cyan-500 bg-accent border border-primary/35" : "text-muted-foreground vm-hover-row")}>
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
                  category === c.id ? "text-accent-foreground bg-accent border border-primary/25" : "text-muted-foreground vm-hover-row border border-transparent"
                )}>
                {c.icon}
                {c.label}
                <span className="ml-auto text-[10px] text-muted-foreground" >
                  {c.id === 'all' ? secretItems.length + projectAccounts.length
                    : c.id === 'git' ? projectAccounts.length
                    : c.id === 'secret' ? secretItems.length
                    : c.id === 'api' ? secretItems.filter(i => /(?:api\s*[-_]?\s*key|access\s*[-_]?\s*key|token|secret)/i.test(i.title || '')).length
                    : secretItems.filter(i => /(?:ssh|私钥|公钥|private\s*[-_]?\s*key)/i.test(i.title || '')).length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧内容 */}
      <div className="vm-vault-content flex flex-col gap-4">
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
            <div>
                <label className="block text-xs mb-1.5 text-muted-foreground" >名称</label>
                <input className="vm-input" placeholder="GitHub 账号 / AWS Key"
                  value={newTitle} onChange={e => setNewTitle(e.target.value)} />
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
                  className={cn('vm-hover-row px-4 py-3 flex items-center gap-3 group', selectedItem?.id === item.id && 'vm-vault-row-selected')}
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-primary bg-primary/10 border border-primary/20">
                    <Key className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <button className="text-sm font-medium text-foreground text-left hover:text-primary" onClick={() => setSelectedId(item.id)}>{item.title}</button>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs truncate max-w-[200px] text-muted-foreground" >
                        {item.maskedText || '••••••••••••'}
                      </span>
                      <span className="text-[10px] text-muted-foreground" >
                        {formatTime(item.downloadedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.remoteOnly ? (
                      <Button variant="cyan" size="sm" onClick={() => handleDownload(item)} title="从云端取回并解密">
                        <Download className="w-3 h-3" />取回
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => handleUnlock(item.id)} title="解锁查看">
                        <Unlock className="w-3 h-3" />解锁
                      </Button>
                    )}
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
                  className="vm-hover-row px-4 py-3 flex items-center gap-3 group"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-primary bg-primary/10 border border-primary/20">
                    {PROVIDER_ICONS[acc.provider] || <Globe className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground" >{acc.label}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground" >{acc.username || '••••••••'}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-sm uppercase"
                        style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
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
              <p className="vm-empty-title">密码库为空</p>
              <p className="vm-empty-description">创建第一条加密凭据，之后只在需要时解锁查看。</p>
              <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="w-3.5 h-3.5" />添加第一条凭据
              </Button>
            </div>
          </div>
        )}
      </div>

      <aside className="vm-vault-details glass-card rounded-md" aria-label="所选凭据详情">
        {selectedItem ? (
          <>
            <div className="vm-vault-details-heading">
              <span className="vm-vault-details-icon"><Key className="w-5 h-5" /></span>
              <div className="min-w-0"><h2 className="truncate">{selectedItem.title}</h2><p>加密凭据</p></div>
            </div>
            <dl className="vm-vault-details-list">
              <div><dt>类型</dt><dd>密码 / 密钥</dd></div>
              <div><dt>内容</dt><dd>{selectedItem.maskedText || '••••••••••••'}</dd></div>
              <div><dt>更新时间</dt><dd>{formatTime(selectedItem.downloadedAt)}</dd></div>
              <div><dt>可用性</dt><dd className={selectedItem.remoteOnly ? 'text-gold' : 'text-emerald'}>{selectedItem.remoteOnly ? '云端待取回' : '本机可用'}</dd></div>
            </dl>
            <div className="vm-vault-details-actions">
              {selectedItem.remoteOnly ? (
                <Button variant="primary" size="sm" onClick={() => handleDownload(selectedItem)}><Download className="w-3.5 h-3.5" />取回凭据</Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => handleUnlock(selectedItem.id)}><Unlock className="w-3.5 h-3.5" />解锁查看</Button>
              )}
            </div>
          </>
        ) : (
          <div className="vm-vault-details-empty"><Shield className="w-6 h-6" /><p>选择一条凭据查看详情</p><small>凭据内容默认隐藏</small></div>
        )}
      </aside>

      {/* 解锁弹窗 */}
      {unlockedText && (
        <div className="vm-modal-mask fixed inset-0 z-50 flex items-center justify-center p-4"
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
              <pre className="vm-terminal text-sm whitespace-pre-wrap break-all p-4 rounded-lg max-h-[400px] overflow-y-auto"
                style={{ color: 'hsl(43 90% 70%)' }}>
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
      {confirmDialog}
      </div>
    </div>
  )
}
