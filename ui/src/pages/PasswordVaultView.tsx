import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Key, Lock, Unlock, Copy, Check, Plus, Search, Eye, EyeOff,
  Globe, Terminal, FileKey2, Shield, Trash2, Edit3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import PasswordGen from '@/components/shared/PasswordGen'
import TotpCard from '@/components/shared/TotpCard'

type VaultTab = 'passwords' | 'totp' | 'generator'
type Category = 'all' | 'login' | 'api' | 'ssh' | 'cert' | 'other'

const MOCK_PASSWORDS = [
  { id: 'p1', name: 'GitHub 账号', username: 'john@example.com', category: 'login', strength: 5, site: 'github.com', updated: '2小时前' },
  { id: 'p2', name: 'AWS Root', username: 'admin@company.com', category: 'login', strength: 7, site: 'aws.amazon.com', updated: '1天前' },
  { id: 'p3', name: 'OpenAI API Key', username: 'sk-proj-...', category: 'api', strength: 7, site: 'api.openai.com', updated: '3天前' },
  { id: 'p4', name: 'DeepSeek API Key', username: 'sk-...', category: 'api', strength: 6, site: 'api.deepseek.com', updated: '5天前' },
  { id: 'p5', name: 'Production SSH', username: 'root@192.168.1.1', category: 'ssh', strength: 7, site: '', updated: '1周前' },
  { id: 'p6', name: 'Dev SSH Key', username: 'dev@dev-server', category: 'ssh', strength: 6, site: '', updated: '2周前' },
  { id: 'p7', name: 'SSL 证书', username: '*.company.com', category: 'cert', strength: 7, site: '', updated: '1月前' },
]

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: '全部', icon: <Shield className="w-3.5 h-3.5" /> },
  { id: 'login', label: '登录密码', icon: <Globe className="w-3.5 h-3.5" /> },
  { id: 'api', label: 'API Key', icon: <Key className="w-3.5 h-3.5" /> },
  { id: 'ssh', label: 'SSH 密钥', icon: <Terminal className="w-3.5 h-3.5" /> },
  { id: 'cert', label: '证书', icon: <FileKey2 className="w-3.5 h-3.5" /> },
  { id: 'other', label: '其他', icon: <Lock className="w-3.5 h-3.5" /> },
]

function strengthColor(s: number) {
  if (s <= 2) return 'hsl(352 80% 58%)'
  if (s <= 4) return 'hsl(43 90% 58%)'
  if (s <= 6) return 'hsl(152 72% 52%)'
  return 'hsl(190 90% 58%)'
}

export default function PasswordVaultView() {
  const [tab, setTab] = useState<VaultTab>('passwords')
  const [category, setCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')
  const [unlocked, setUnlocked] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newPwd, setNewPwd] = useState('')
  const [showNewPwd, setShowNewPwd] = useState(false)

  const filtered = MOCK_PASSWORDS.filter(p => {
    if (category !== 'all' && p.category !== category) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const copy = (id: string, val: string) => {
    navigator.clipboard.writeText(val)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const TABS = [
    { id: 'passwords' as VaultTab, label: '密码 & 密钥', count: MOCK_PASSWORDS.length },
    { id: 'totp' as VaultTab, label: '两步验证 (TOTP)', count: 4 },
    { id: 'generator' as VaultTab, label: '密码生成器', count: null },
  ]

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: '220px 1fr', alignItems: 'start' }}>
      {/* 左侧分类 */}
      <div className="glass-card rounded-md overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid hsl(218 24% 14%)' }}>
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'hsl(210 30% 90%)' }}>
            <Key className="w-4 h-4" style={{ color: 'hsl(43 90% 60%)' }} />
            密码库
          </h2>
        </div>

        {/* 标签页切换 */}
        <div className="p-2 space-y-0.5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-all",
                tab === t.id
                  ? "text-[hsl(190_90%_72%)] border"
                  : "text-[hsl(218_16%_54%)] hover:bg-[hsl(218_28%_10%)]"
              )}
              style={tab === t.id ? {
                background: 'hsl(218 30% 11%)',
                borderColor: 'hsl(190 60% 24% / 0.35)',
              } : {}}>
              <span className="font-medium">{t.label}</span>
              {t.count !== null && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-sm"
                  style={{ background: 'hsl(218 28% 14%)', color: 'hsl(218 16% 50%)' }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 分类树（仅密码标签页） */}
        {tab === 'passwords' && (
          <>
            <div className="px-3 py-2" style={{ borderTop: '1px solid hsl(218 24% 12%)' }}>
              <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: 'hsl(218 16% 38%)' }}>分类</p>
              <div className="space-y-0.5">
                {CATEGORIES.map(c => (
                  <button key={c.id} onClick={() => setCategory(c.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all",
                      category === c.id ? "text-[hsl(190_90%_68%)] bg-[hsl(190_60%_14%/0.3)]" : "text-[hsl(218_16%_50%)] hover:bg-[hsl(218_28%_10%)]"
                    )}>
                    {c.icon}
                    {c.label}
                    <span className="ml-auto text-[10px]" style={{ color: 'hsl(218 16% 38%)' }}>
                      {c.id === 'all' ? MOCK_PASSWORDS.length : MOCK_PASSWORDS.filter(p => p.category === c.id).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 右侧内容 */}
      <div className="flex flex-col gap-4">
        {tab === 'passwords' && (
          <>
            {/* 搜索 + 添加 */}
            <div className="glass-card rounded-md p-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(218 16% 40%)' }} />
                <input className="vm-input pl-9" placeholder="搜索密码、域名..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button variant="primary" size="sm" onClick={() => setShowAdd(!showAdd)}>
                <Plus className="w-3.5 h-3.5" />
                添加密码
              </Button>
            </div>

            {/* 添加表单 */}
            {showAdd && (
              <div className="glass-card rounded-md p-4 space-y-3 animate-fade-in">
                <h3 className="text-sm font-semibold" style={{ color: 'hsl(210 30% 90%)' }}>添加新密码</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 50%)' }}>名称</label>
                    <input className="vm-input" placeholder="GitHub 账号" />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 50%)' }}>网站/服务</label>
                    <input className="vm-input" placeholder="github.com" />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 50%)' }}>用户名/邮箱</label>
                    <input className="vm-input" placeholder="you@example.com" />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 50%)' }}>密码</label>
                    <div className="relative">
                      <input className="vm-input pr-10" type={showNewPwd ? 'text' : 'password'}
                        placeholder="输入或生成密码" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                      <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowNewPwd(!showNewPwd)}>
                        {showNewPwd ? <EyeOff className="w-4 h-4" style={{ color: 'hsl(218 16% 40%)' }} /> : <Eye className="w-4 h-4" style={{ color: 'hsl(218 16% 40%)' }} />}
                      </button>
                    </div>
                  </div>
                </div>
                <PasswordGen onUse={(pwd) => setNewPwd(pwd)} />
                <div className="flex gap-2">
                  <Button variant="success" className="flex-1">
                    <Key className="w-4 h-4" />
                    加密保存
                  </Button>
                  <Button variant="ghost" onClick={() => setShowAdd(false)}>取消</Button>
                </div>
              </div>
            )}

            {/* 密码列表 */}
            <div className="glass-card rounded-md overflow-hidden">
              <div className="divide-y">
                {filtered.map(p => {
                  const isUnlocked = unlocked === p.id
                  const catIcon = CATEGORIES.find(c => c.id === p.category)?.icon
                  return (
                    <div key={p.id}
                      className="px-4 py-3 flex items-center gap-3 group transition-all"
                      style={{ borderBottom: '1px solid hsl(218 24% 11%)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'hsl(218 28% 10%)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      {/* 图标 */}
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: 'hsl(43 60% 16% / 0.4)',
                          border: '1px solid hsl(43 60% 24% / 0.3)',
                          color: 'hsl(43 90% 65%)',
                        }}>
                        {catIcon}
                      </div>

                      {/* 信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: 'hsl(210 30% 90%)' }}>{p.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs truncate max-w-[180px]"
                            style={{ color: isUnlocked ? 'hsl(152 72% 62%)' : 'hsl(218 16% 44%)' }}>
                            {isUnlocked ? p.username : '••••••••••••'}
                          </span>
                          {p.site && (
                            <span className="text-[10px]" style={{ color: 'hsl(218 16% 36%)' }}>{p.site}</span>
                          )}
                        </div>
                      </div>

                      {/* 强度指示 */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {[1,2,3,4,5,6,7].map(i => (
                          <div key={i} className="w-1 h-3 rounded-sm transition-all"
                            style={{
                              background: i <= p.strength ? strengthColor(p.strength) : 'hsl(218 24% 16%)',
                              opacity: i <= p.strength ? 1 : 0.3,
                            }} />
                        ))}
                      </div>

                      {/* 操作 */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Button variant="ghost" size="icon-sm" onClick={() => setUnlocked(isUnlocked ? null : p.id)}>
                          {isUnlocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => copy(p.id, p.username)}>
                          {copiedId === p.id ? <Check className="w-3 h-3" style={{ color: 'hsl(152 72% 55%)' }} /> : <Copy className="w-3 h-3" />}
                        </Button>
                        <Button variant="ghost" size="icon-sm">
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" style={{ color: 'hsl(352 84% 60%)' }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {tab === 'totp' && (
          <div className="glass-card rounded-md p-4">
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'hsl(210 30% 90%)' }}>
              两步验证 (TOTP)
            </h2>
            <TotpCard />
          </div>
        )}

        {tab === 'generator' && (
          <div className="glass-card rounded-md p-4 max-w-xl">
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'hsl(210 30% 90%)' }}>密码生成器</h2>
            <PasswordGen />
          </div>
        )}
      </div>
    </div>
  )
}
