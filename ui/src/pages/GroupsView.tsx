import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Users, Plus, Mail, Crown, Shield, Eye, Trash2, RefreshCw,
  ChevronRight, UserPlus, Copy, Check, Share2, BookOpen,
  Lock, Unlock, FileText, Key, Globe, X, LogOut, Gift
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import { CardSkeleton } from '@/components/shared/Skeleton'

const ROLE_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  owner:  { label: '所有者', badge: 'vm-badge-gold',   icon: Crown  },
  admin:  { label: '管理员', badge: 'vm-badge-cyan',   icon: Shield },
  member: { label: '成员',   badge: 'vm-badge-emerald', icon: Users  },
  viewer: { label: '只读',   badge: 'vm-badge-violet', icon: Eye    },
}

const KIND_ICONS: Record<string, React.ElementType> = {
  text: FileText, secret: Key, web: Globe, video: Globe, file: FileText,
}

type GroupTab = 'members' | 'shared'

export default function GroupsView() {
  const { state, createGroup, inviteToGroup, leaveGroup, listGroupMembers,
    rotateGroupKey, removeGroupMember, updateMemberRole, acceptPendingInvites,
    copyItemToGroup } = useAppStore()
  const toast = useToast()

  const groups = state?.groups || []
  const pendingInvites = state?.pendingInvites || []
  const context = state?.context || { scope: 'personal' as const, groupId: '', groupName: '' }

  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [groupTab, setGroupTab] = useState<GroupTab>('members')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupFolder, setNewGroupFolder] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)

  // Auto-select first group
  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id)
    }
    if (groups.length === 0) {
      setSelectedGroupId('')
    }
  }, [groups, selectedGroupId])

  // Fetch members when selected group changes
  const fetchMembers = useCallback(async (groupId: string) => {
    if (!groupId) { setMembers([]); return }
    setMembersLoading(true)
    const result = await listGroupMembers(groupId)
    if (Array.isArray(result)) {
      setMembers(result)
    } else {
      setMembers([])
    }
    setMembersLoading(false)
  }, [listGroupMembers])

  useEffect(() => {
    if (selectedGroupId) {
      fetchMembers(selectedGroupId)
    } else {
      setMembers([])
    }
  }, [selectedGroupId, fetchMembers])

  const currentGroup = groups.find(g => g.id === selectedGroupId)
  const groupItems = (state?.items || []).filter(i => i.scope === 'group' && i.groupId === selectedGroupId)
  const personalItems = (state?.items || []).filter(i => i.scope === 'personal' || !i.scope)

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast('请输入组名称', 'warning')
      return
    }
    setActionLoading(true)
    const { error } = await createGroup(newGroupName.trim(), newGroupFolder.trim() || undefined)
    setActionLoading(false)
    if (error) {
      toast(`创建失败: ${error}`, 'error')
    } else {
      toast('用户组创建成功', 'success')
      setNewGroupName('')
      setNewGroupFolder('')
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast('请输入成员邮箱', 'warning')
      return
    }
    setActionLoading(true)
    const result = await inviteToGroup(selectedGroupId, inviteEmail.trim(), inviteRole)
    setActionLoading(false)
    if ('error' in result && result.error) {
      toast(`邀请失败: ${result.error}`, 'error')
    } else {
      const code = (result as any).inviteCode || (result as any).invite_code
      toast('邀请已创建', 'success')
      setInviteCode(code || null)
      setInviteEmail('')
    }
  }

  const handleRotateKey = async () => {
    if (!selectedGroupId) return
    setActionLoading(true)
    const result = await rotateGroupKey(selectedGroupId)
    setActionLoading(false)
    if ('error' in result && result.error) {
      toast(`密钥轮换失败: ${result.error}`, 'error')
    } else {
      toast(`组密钥已轮换到 v${(result as any).newVersion || '?'}`, 'success')
      fetchMembers(selectedGroupId)
    }
  }

  const handleLeaveGroup = async () => {
    if (!selectedGroupId) return
    setActionLoading(true)
    await leaveGroup(selectedGroupId)
    setActionLoading(false)
    toast('已退出用户组', 'info')
    setSelectedGroupId('')
  }

  const handleRemoveMember = async (memberId: string) => {
    setActionLoading(true)
    const { error } = await removeGroupMember(selectedGroupId, memberId)
    setActionLoading(false)
    if (error) {
      toast(`移除失败: ${error}`, 'error')
    } else {
      toast('成员已移除', 'info')
      fetchMembers(selectedGroupId)
    }
  }

  const handleUpdateRole = async (memberId: string, role: string) => {
    const { error } = await updateMemberRole(selectedGroupId, memberId, role)
    if (error) {
      toast(`更新角色失败: ${error}`, 'error')
    } else {
      toast('角色已更新', 'success')
      fetchMembers(selectedGroupId)
    }
  }

  const handleAcceptInvite = async () => {
    setActionLoading(true)
    const result = await acceptPendingInvites()
    setActionLoading(false)
    if ('error' in result && result.error) {
      toast(`接受邀请失败: ${result.error}`, 'error')
    } else {
      toast(`已接受 ${(result as any).accepted?.length || 0} 个邀请`, 'success')
    }
  }

  const handleCopyItemToGroup = async (itemId: string) => {
    const { error } = await copyItemToGroup(itemId, selectedGroupId)
    if (error) {
      toast(`共享失败: ${error}`, 'error')
    } else {
      toast('内容已共享到组', 'success')
      setShowShareModal(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: '300px 1fr', alignItems: 'start' }}>
      {/* ====== Left Column ====== */}
      <div className="flex flex-col gap-4">
        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-sm font-semibold flex items-center gap-2 text-[hsl(210_30%_90%)]">
                <Gift className="w-4 h-4 text-amber-400" />
                待接受邀请
              </h2>
              <span className="vm-badge vm-badge-gold text-[9px]">{pendingInvites.length}</span>
            </div>
            <div className="p-2 space-y-1">
              {pendingInvites.map(inv => (
                <div key={inv.id} className="px-3 py-2 rounded-lg bg-muted"
                  >
                  <p className="text-xs font-medium text-[hsl(210_30%_88%)]">{inv.groupName}</p>
                  <p className="text-[10px] mt-0.5 text-[hsl(218_16%_44%)]">角色: {ROLE_CONFIG[inv.role]?.label || inv.role}</p>
                </div>
              ))}
              <Button variant="success" size="sm" className="w-full mt-2"
                onClick={handleAcceptInvite} disabled={actionLoading}>
                <Check className="w-3.5 h-3.5" />
                接受全部邀请
              </Button>
            </div>
          </div>
        )}

        {/* Group List */}
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold flex items-center gap-2 text-[hsl(210_30%_90%)]">
              <Users className="w-4 h-4 text-cyan-400" />
              我的用户组
            </h2>
          </div>
          <div className="p-1.5 space-y-0.5">
            {groups.length === 0 && (
              <div className="px-3 py-6 text-center">
                <Users className="w-7 h-7 mx-auto mb-2 text-[hsl(218_16%_32%)]" />
                <p className="text-xs text-[hsl(218_16%_44%)]">还没有用户组</p>
                <p className="text-[10px] text-[hsl(218_16%_36%)] mt-1">在下方创建一个</p>
              </div>
            )}
            {groups.map(g => {
              const rc = ROLE_CONFIG[g.role] || ROLE_CONFIG.member
              const RoleIcon = rc.icon
              return (
                <button key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left",
                    selectedGroupId === g.id
                      ? "bg-[hsl(218_28%_12%)] border border-[hsl(190_60%_24%/0.3)]"
                      : "hover:bg-[hsl(218_28%_10%)] border border-transparent"
                  )}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base font-bold text-cyan-300"
                    style={{ background: 'linear-gradient(145deg, hsl(190 60% 18%), hsl(218 36% 14%))', border: '1px solid var(--border)' }}>
                    {g.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-[hsl(210_30%_90%)] truncate">{g.name}</span>
                      <span className={cn("vm-badge text-[9px]", rc.badge)}>
                        <RoleIcon className="w-2.5 h-2.5" />{rc.label}
                      </span>
                    </div>
                    <p className="text-[10px] mt-0.5 text-[hsl(218_16%_44%)]">密钥 v{g.keyVersion}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-[hsl(218_16%_38%)]" />
                </button>
              )
            })}
          </div>
        </div>

        {/* Create Group */}
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
            <input className="vm-input w-full" placeholder="飞书文件夹 Token（可选）"
              value={newGroupFolder} onChange={e => setNewGroupFolder(e.target.value)} />
            <Button variant="success" className="w-full"
              onClick={handleCreateGroup} disabled={actionLoading || !newGroupName.trim()}>
              <Users className="w-4 h-4" />
              创建用户组
            </Button>
          </div>
        </div>
      </div>

      {/* ====== Right Column ====== */}
      {currentGroup ? (
        <div className="glass-card rounded-lg overflow-hidden flex flex-col">
          {/* Group Header */}
          <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <h2 className="text-sm font-semibold text-[hsl(210_30%_90%)]">{currentGroup.name}</h2>
              <p className="text-[10px] mt-0.5 text-[hsl(218_16%_44%)]">
                密钥版本 v{currentGroup.keyVersion} · {members.length} 成员 · {groupItems.length} 共享内容
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleRotateKey} disabled={actionLoading}>
                <RefreshCw className="w-3.5 h-3.5" />
                轮换密钥
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowShareModal(true)}>
                <Share2 className="w-3.5 h-3.5" />
                共享内容
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLeaveGroup} disabled={actionLoading}
                className="text-rose-400 hover:text-rose-300">
                <LogOut className="w-3.5 h-3.5" />
                退出
              </Button>
            </div>
          </div>

          {/* Sub Tabs */}
          <div className="flex border-b border-[hsl(218_24%_13%)] px-4 flex-shrink-0">
            {([
              { id: 'members' as GroupTab, label: '成员管理' },
              { id: 'shared'  as GroupTab, label: '共享内容' },
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

          {/* Members Tab */}
          {groupTab === 'members' && (
            <div className="p-4 space-y-4">
              {/* Invite code display */}
              {inviteCode && (
                <div className="rounded-lg p-3.5 space-y-2"
                  style={{ background: 'hsl(152 50% 10% / 0.3)', border: '1px solid hsl(152 60% 24% / 0.3)' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-[hsl(152_72%_52%)] flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      邀请码已生成
                    </p>
                    <button onClick={() => setInviteCode(null)} className="text-[hsl(218_16%_48%)] hover:text-[hsl(210_30%_72%)]">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded bg-[hsl(218_40%_5%)] border border-[hsl(218_24%_12%)]">
                    <code className="text-[10px] text-[hsl(218_16%_52%)] flex-1 truncate font-mono">
                      {inviteCode}
                    </code>
                    <button onClick={() => copyToClipboard(inviteCode)}
                      className="flex-shrink-0 text-[hsl(218_16%_48%)] hover:text-cyan-400 transition-colors">
                      {copied
                        ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                        : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-[hsl(218_16%_44%)]">
                    将此邀请码发送给被邀请人，他们在登录后可自动接受。
                  </p>
                </div>
              )}

              {/* Member list */}
              {membersLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <CardSkeleton key={i} />)}
                </div>
              ) : (
                <div className="space-y-1">
                  {members.length === 0 && (
                    <div className="px-3 py-6 text-center">
                      <Users className="w-7 h-7 mx-auto mb-2 text-[hsl(218_16%_32%)]" />
                      <p className="text-xs text-[hsl(218_16%_44%)]">暂无成员</p>
                    </div>
                  )}
                  {members.map(m => {
                    const rc = ROLE_CONFIG[m.role] || ROLE_CONFIG.member
                    const RoleIcon = rc.icon
                    return (
                      <div key={m.userId || m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[hsl(218_28%_10%)] group transition-colors">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold text-cyan-300"
                          style={{ background: 'hsl(218 30% 14%)', border: '1px solid hsl(218 24% 20%)' }}>
                          {(m.username || m.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[hsl(210_30%_88%)]">
                              {m.username || m.email || '未知用户'}
                            </span>
                            <span className={cn("vm-badge text-[9px]", rc.badge)}>
                              <RoleIcon className="w-2.5 h-2.5" />{rc.label}
                            </span>
                          </div>
                          {m.email && (
                            <p className="text-[10px] mt-0.5 text-[hsl(218_16%_44%)]">{m.email}</p>
                          )}
                        </div>
                        {m.role !== 'owner' && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <select className="text-[10px] h-6 px-1.5 rounded border border-[hsl(218_24%_20%)] bg-[hsl(218_36%_8%)] text-[hsl(218_16%_56%)]"
                              value={m.role}
                              onChange={e => handleUpdateRole(m.userId || m.id, e.target.value)}>
                              <option value="admin">管理员</option>
                              <option value="member">成员</option>
                              <option value="viewer">只读</option>
                            </select>
                            <Button variant="ghost" size="icon-sm" className="text-rose-400 hover:text-rose-300"
                              onClick={() => handleRemoveMember(m.userId || m.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Invite form */}
              <div className="rounded-lg p-3.5 space-y-2.5"
                style={{ background: 'hsl(218 36% 8%)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-medium text-[hsl(210_30%_82%)] flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                  邀请新成员
                </p>
                <p className="text-[10px] text-[hsl(218_16%_44%)]">
                  输入被邀请人的邮箱，系统将生成加密邀请码。
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
                  <Button variant="primary" size="sm" onClick={handleInvite}
                    disabled={actionLoading || !inviteEmail.trim()}>
                    <Mail className="w-3.5 h-3.5" />
                    邀请
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Shared Items Tab */}
          {groupTab === 'shared' && (
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[hsl(218_16%_52%)]">共 {groupItems.length} 条共享内容</span>
                <Button variant="primary" size="sm" onClick={() => setShowShareModal(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  从个人库共享
                </Button>
              </div>
              {groupItems.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <BookOpen className="w-7 h-7 mx-auto mb-2 text-[hsl(218_16%_32%)]" />
                  <p className="text-xs text-[hsl(218_16%_44%)]">暂无共享内容</p>
                  <p className="text-[10px] text-[hsl(218_16%_36%)] mt-1">点击「从个人库共享」添加</p>
                </div>
              )}
              {groupItems.map(item => {
                const KindIcon = KIND_ICONS[item.kind] || FileText
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-[hsl(218_24%_13%)] hover:bg-[hsl(218_30%_10%)] group transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-cyan-400"
                      style={{ background: 'hsl(218 28% 13%)', border: '1px solid var(--border)' }}>
                      <KindIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-[hsl(210_30%_86%)] truncate block">
                        {item.title || item.name}
                      </span>
                      <p className="text-[10px] mt-0.5 text-[hsl(218_16%_40%)]">
                        {item.kind} · {item.size > 0 ? `${(item.size / 1024).toFixed(1)} KB` : '—'}
                      </p>
                    </div>
                    {item.tags && (
                      <span className="vm-badge vm-badge-cyan text-[9px] flex-shrink-0">
                        {item.tags.split(',')[0]}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card rounded-lg flex items-center justify-center"
          style={{ minHeight: '400px' }}>
          <div className="text-center">
            <Users className="w-12 h-12 mx-auto mb-3 text-[hsl(218_16%_28%)]" />
            <p className="text-sm text-[hsl(218_16%_44%)]">选择一个用户组查看详情</p>
            <p className="text-xs text-[hsl(218_16%_36%)] mt-1">或创建新用户组开始协作</p>
          </div>
        </div>
      )}

      {/* Share from personal library modal */}
      {showShareModal && currentGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'hsl(218 42% 4% / 0.8)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowShareModal(false)}>
          <div className="glass-panel rounded-xl w-full max-w-md p-5 animate-scale-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[hsl(210_30%_90%)] flex items-center gap-2">
                <Share2 className="w-4 h-4 text-cyan-400" />
                共享内容到 {currentGroup.name}
              </h3>
              <button onClick={() => setShowShareModal(false)} className="text-[hsl(218_16%_48%)] hover:text-[hsl(210_30%_72%)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto mb-4">
              {personalItems.length === 0 && (
                <p className="text-xs text-center py-6 text-[hsl(218_16%_44%)]">个人库暂无内容</p>
              )}
              {personalItems.map(item => {
                const KindIcon = KIND_ICONS[item.kind] || FileText
                return (
                  <div key={item.id}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded hover:bg-[hsl(218_30%_12%)] cursor-pointer"
                    onClick={() => handleCopyItemToGroup(item.id)}>
                    <KindIcon className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                    <span className="text-xs text-[hsl(210_30%_82%)] flex-1 truncate">
                      {item.title || item.name}
                    </span>
                    <Share2 className="w-3 h-3 text-[hsl(218_16%_40%)] flex-shrink-0" />
                  </div>
                )
              })}
            </div>
            <Button variant="ghost" className="w-full" onClick={() => setShowShareModal(false)}>关闭</Button>
          </div>
        </div>
      )}
    </div>
  )
}
