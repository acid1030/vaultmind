import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Users, Plus, Mail, Crown, Shield, Eye, Trash2, RefreshCw,
  ChevronRight, UserPlus, Link2, Copy, Check, Share2, BookOpen,
  Lock, Unlock, FileText, Globe, X
} from 'lucide-react'
import { cn } from '@/lib/utils'

const MOCK_GROUPS = [
  { id: 'g1', name: '研发团队', members: 5, role: 'owner',  sharedItems: 12 },
  { id: 'g2', name: '市场团队', members: 3, role: 'admin',  sharedItems: 4  },
  { id: 'g3', name: '设计组',   members: 2, role: 'member', sharedItems: 7  },
]

const MOCK_MEMBERS = [
  { id: 'm1', name: 'Alice Chen',  email: 'alice@company.com', role: 'owner',  joined: '2024-01-10' },
  { id: 'm2', name: 'Bob Wang',    email: 'bob@company.com',   role: 'admin',  joined: '2024-01-15' },
  { id: 'm3', name: 'Carol Liu',   email: 'carol@company.com', role: 'member', joined: '2024-02-01' },
  { id: 'm4', name: 'David Zhao',  email: 'david@company.com', role: 'viewer', joined: '2024-02-08' },
]

const MOCK_SHARED_ITEMS = [
  { id: 'si1', title: 'API 设计文档 v2.3',   type: 'file',  perm: 'read',  sharedBy: 'Alice Chen',  sharedAt: '2 天前'  },
  { id: 'si2', title: '数据库连接字符串',      type: 'key',   perm: 'read',  sharedBy: 'Bob Wang',    sharedAt: '1 周前'  },
  { id: 'si3', title: '前端架构笔记',          type: 'text',  perm: 'edit',  sharedBy: 'Alice Chen',  sharedAt: '今天'    },
  { id: 'si4', title: '竞品分析报告',          type: 'file',  perm: 'read',  sharedBy: 'Carol Liu',   sharedAt: '3 天前'  },
]

const MOCK_INVITE_LINKS = [
  { id: 'il1', role: 'member', uses: 3, maxUses: 10, expiresIn: '7 天后', active: true  },
  { id: 'il2', role: 'viewer', uses: 1, maxUses: 5,  expiresIn: '已过期', active: false },
]

const ROLE_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  owner:  { label: '所有者', badge: 'vm-badge-gold',   icon: Crown  },
  admin:  { label: '管理员', badge: 'vm-badge-cyan',   icon: Shield },
  member: { label: '成员',   badge: 'vm-badge-emerald', icon: Users  },
  viewer: { label: '只读',   badge: 'vm-badge-violet', icon: Eye    },
}

const ITEM_TYPE_ICONS: Record<string, React.ElementType> = {
  file: FileText, key: Lock, text: BookOpen, link: Globe
}

type GroupTab = 'members' | 'shared' | 'links'

export default function GroupsView() {
  const [selectedGroup, setSelectedGroup]   = useState(MOCK_GROUPS[0].id)
  const [groupTab, setGroupTab]             = useState<GroupTab>('members')
  const [inviteEmail, setInviteEmail]       = useState('')
  const [inviteRole, setInviteRole]         = useState('member')
  const [newGroupName, setNewGroupName]     = useState('')
  const [copied, setCopied]                 = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)

  const currentGroup = MOCK_GROUPS.find(g => g.id === selectedGroup)

  const copyLink = (id: string) => {
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: '300px 1fr', alignItems: 'start' }}>
      {/* ====== 左列 ====== */}
      <div className="flex flex-col gap-4">
        {/* 用户组列表 */}
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid hsl(218 24% 14%)' }}>
            <h2 className="text-sm font-semibold flex items-center gap-2 text-[hsl(210_30%_90%)]">
              <Users className="w-4 h-4 text-cyan-400" />
              我的用户组
            </h2>
          </div>
          <div className="p-1.5 space-y-0.5">
            {MOCK_GROUPS.map(g => {
              const rc = ROLE_CONFIG[g.role]
              const RoleIcon = rc.icon
              return (
                <button key={g.id}
                  onClick={() => setSelectedGroup(g.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left",
                    selectedGroup === g.id
                      ? "bg-[hsl(218_28%_12%)] border border-[hsl(190_60%_24%/0.3)]"
                      : "hover:bg-[hsl(218_28%_10%)] border border-transparent"
                  )}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base font-bold text-cyan-300"
                    style={{ background: 'linear-gradient(145deg, hsl(190 60% 18%), hsl(218 36% 14%))', border: '1px solid hsl(218 24% 18%)' }}>
                    {g.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-[hsl(210_30%_90%)]">{g.name}</span>
                      <span className={cn("vm-badge text-[9px]", rc.badge)}>
                        <RoleIcon className="w-2.5 h-2.5" />{rc.label}
                      </span>
                    </div>
                    <p className="text-[10px] mt-0.5 text-[hsl(218_16%_44%)]">{g.members} 成员 · {g.sharedItems} 共享项</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-[hsl(218_16%_38%)]" />
                </button>
              )
            })}
          </div>
        </div>

        {/* 新建用户组 */}
        <div className="glass-card rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[hsl(210_30%_90%)]">
            <Plus className="w-4 h-4 text-emerald-400" />
            新建用户组
          </h2>
          <p className="text-xs mb-3 leading-relaxed text-[hsl(218_16%_46%)]">
            组内内容使用独立组密钥加密，仅组员可见；个人库内容不自动共享。
          </p>
          <div className="space-y-2.5">
            <input className="vm-input w-full" placeholder="组名称，例如：研发团队"
              value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
            <input className="vm-input w-full" placeholder="描述（可选）" />
            <Button variant="success" className="w-full">
              <Users className="w-4 h-4" />
              创建用户组
            </Button>
          </div>
        </div>
      </div>

      {/* ====== 右列 ====== */}
      {currentGroup && (
        <div className="glass-card rounded-lg overflow-hidden flex flex-col">
          {/* 组头部 */}
          <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
            style={{ borderBottom: '1px solid hsl(218 24% 14%)' }}>
            <div>
              <h2 className="text-sm font-semibold text-[hsl(210_30%_90%)]">{currentGroup.name}</h2>
              <p className="text-[10px] mt-0.5 text-[hsl(218_16%_44%)]">{currentGroup.members} 成员 · {currentGroup.sharedItems} 共享内容</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm">
                <RefreshCw className="w-3.5 h-3.5" />
                轮换密钥
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowShareModal(true)}>
                <Share2 className="w-3.5 h-3.5" />
                共享内容
              </Button>
            </div>
          </div>

          {/* 子 Tab */}
          <div className="flex border-b border-[hsl(218_24%_13%)] px-4 flex-shrink-0">
            {([
              { id: 'members' as GroupTab, label: '成员管理' },
              { id: 'shared'  as GroupTab, label: '共享内容' },
              { id: 'links'   as GroupTab, label: '邀请链接' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setGroupTab(t.id)}
                className={cn(
                  "px-4 py-2.5 text-xs font-medium border-b-2 transition-all",
                  groupTab === t.id ? "border-cyan-400 text-cyan-400" : "border-transparent text-[hsl(218_16%_48%)] hover:text-[hsl(210_30%_72%)]"
                )}>
                {t.label}
              </button>
            ))}
          </div>

          {/* 成员管理 */}
          {groupTab === 'members' && (
            <div className="p-4 space-y-4">
              {/* 成员列表 */}
              <div className="space-y-1">
                {MOCK_MEMBERS.map(m => {
                  const rc = ROLE_CONFIG[m.role]
                  const RoleIcon = rc.icon
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[hsl(218_28%_10%)] group transition-colors">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold text-cyan-300"
                        style={{ background: 'hsl(218 30% 14%)', border: '1px solid hsl(218 24% 20%)' }}>
                        {m.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[hsl(210_30%_88%)]">{m.name}</span>
                          <span className={cn("vm-badge text-[9px]", rc.badge)}>
                            <RoleIcon className="w-2.5 h-2.5" />{rc.label}
                          </span>
                        </div>
                        <p className="text-[10px] mt-0.5 text-[hsl(218_16%_44%)]">{m.email} · 加入于 {m.joined}</p>
                      </div>
                      {m.role !== 'owner' && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <select className="text-[10px] h-6 px-1.5 rounded border border-[hsl(218_24%_20%)] bg-[hsl(218_36%_8%)] text-[hsl(218_16%_56%)]"
                            defaultValue={m.role}>
                            <option value="admin">管理员</option>
                            <option value="member">成员</option>
                            <option value="viewer">只读</option>
                          </select>
                          <Button variant="ghost" size="icon-sm" className="text-rose-400 hover:text-rose-300">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 邀请表单 */}
              <div className="rounded-lg p-3.5 space-y-2.5" style={{ background: 'hsl(218 36% 8%)', border: '1px solid hsl(218 24% 14%)' }}>
                <p className="text-xs font-medium text-[hsl(210_30%_82%)] flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                  邀请新成员
                </p>
                <div className="flex gap-2">
                  <input className="vm-input flex-1" placeholder="成员邮箱"
                    value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                  <select className="vm-input w-24"
                    value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                    <option value="member">成员</option>
                    <option value="admin">管理员</option>
                    <option value="viewer">只读</option>
                  </select>
                  <Button variant="primary" size="sm">
                    <Mail className="w-3.5 h-3.5" />
                    邀请
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 共享内容 */}
          {groupTab === 'shared' && (
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[hsl(218_16%_52%)]">共 {MOCK_SHARED_ITEMS.length} 条共享内容</span>
                <Button variant="primary" size="sm" onClick={() => setShowShareModal(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  从内容库共享
                </Button>
              </div>
              {MOCK_SHARED_ITEMS.map(item => {
                const TypeIcon = ITEM_TYPE_ICONS[item.type] || FileText
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-[hsl(218_24%_13%)] hover:bg-[hsl(218_30%_10%)] group transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-cyan-400"
                      style={{ background: 'hsl(218 28% 13%)', border: '1px solid hsl(218 24% 18%)' }}>
                      <TypeIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[hsl(210_30%_86%)] truncate">{item.title}</span>
                        <span className={cn("vm-badge text-[9px] flex-shrink-0",
                          item.perm === 'edit' ? "vm-badge-cyan" : "vm-badge-violet")}>
                          {item.perm === 'edit' ? <Unlock className="w-2 h-2" /> : <Lock className="w-2 h-2" />}
                          {item.perm === 'edit' ? '可编辑' : '只读'}
                        </span>
                      </div>
                      <p className="text-[10px] mt-0.5 text-[hsl(218_16%_40%)]">
                        {item.sharedBy} 共享 · {item.sharedAt}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon-sm"
                      className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300">
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          {/* 邀请链接 */}
          {groupTab === 'links' && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[hsl(218_16%_52%)]">邀请链接可免登录加入组</span>
                <Button variant="primary" size="sm">
                  <Link2 className="w-3.5 h-3.5" />
                  生成新链接
                </Button>
              </div>
              <div className="space-y-2">
                {MOCK_INVITE_LINKS.map(link => (
                  <div key={link.id}
                    className={cn(
                      "rounded-lg p-3.5 border transition-all",
                      link.active
                        ? "border-[hsl(218_24%_16%)] bg-[hsl(218_36%_8%)]"
                        : "border-[hsl(218_24%_12%)] bg-[hsl(218_36%_6%)] opacity-60"
                    )}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("vm-badge text-[9px]", ROLE_CONFIG[link.role].badge)}>
                          {link.role}
                        </span>
                        <span className={cn("vm-badge text-[9px]", link.active ? "vm-badge-emerald" : "vm-badge-gold")}>
                          {link.active ? '有效' : '已过期'}
                        </span>
                      </div>
                      <span className="text-[10px] text-[hsl(218_16%_40%)]">到期: {link.expiresIn}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 p-2 rounded bg-[hsl(218_40%_5%)] border border-[hsl(218_24%_12%)]">
                      <code className="text-[10px] text-[hsl(218_16%_52%)] flex-1 truncate font-mono">
                        https://vaultmind.app/join/{link.id}?token=abc123...
                      </code>
                      <button onClick={() => copyLink(link.id)}
                        className="flex-shrink-0 text-[hsl(218_16%_48%)] hover:text-cyan-400 transition-colors">
                        {copied === link.id
                          ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                          : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-[hsl(218_16%_44%)]">已使用 {link.uses}/{link.maxUses} 次</span>
                      <div className="flex-1 h-1 rounded-full bg-[hsl(218_24%_14%)] overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
                          style={{ width: `${(link.uses / link.maxUses) * 100}%` }} />
                      </div>
                      {link.active && (
                        <Button variant="ghost" size="sm" className="text-rose-400 h-5 px-1.5 text-[10px]">
                          撤销
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 共享内容弹窗 */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'hsl(218 42% 4% / 0.8)', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel rounded-xl w-full max-w-md p-5 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[hsl(210_30%_90%)] flex items-center gap-2">
                <Share2 className="w-4 h-4 text-cyan-400" />
                共享内容到 {currentGroup?.name}
              </h3>
              <button onClick={() => setShowShareModal(false)} className="text-[hsl(218_16%_48%)] hover:text-[hsl(210_30%_72%)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input className="vm-input w-full mb-3" placeholder="搜索内容库..." />
            <div className="space-y-1.5 max-h-48 overflow-y-auto mb-4">
              {['API设计文档 v2.3', '服务器密钥配置', '研发规范手册', '竞品分析报告', '前端架构设计'].map((item, i) => (
                <label key={i} className="flex items-center gap-2.5 px-2.5 py-2 rounded hover:bg-[hsl(218_30%_12%)] cursor-pointer">
                  <input type="checkbox" className="w-3.5 h-3.5" />
                  <span className="text-xs text-[hsl(210_30%_82%)]">{item}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-4">
              <label className="text-xs text-[hsl(218_16%_52%)]">权限：</label>
              <select className="vm-input flex-1 text-xs">
                <option>只读（组员可查看）</option>
                <option>可编辑（组员可修改）</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowShareModal(false)}>取消</Button>
              <Button variant="primary" className="flex-1" onClick={() => setShowShareModal(false)}>
                <Share2 className="w-3.5 h-3.5" />
                确认共享
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
