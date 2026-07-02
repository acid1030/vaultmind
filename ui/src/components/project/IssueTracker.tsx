import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, ChevronRight, ChevronDown, MessageCircle, GitCommit, User, Tag, AlertCircle, CheckCircle2, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type IssueStatus = 'open' | 'in_progress' | 'closed'

interface Issue {
  id: number
  title: string
  status: IssueStatus
  labels: string[]
  assignee: string
  initials: string
  comments: number
  created: string
  body: string
  linkedCommits: string[]
}

const MOCK_ISSUES: Issue[] = [
  { id: 42, title: '用户组密钥轮换后部分成员无法解密内容', status: 'open', labels: ['bug', 'P0'], assignee: 'Alice', initials: 'AL', comments: 5, created: '2天前', body: '当管理员执行密钥轮换后，部分成员的 wrapped_key 未正确更新，导致解密失败。\n\n**复现步骤：**\n1. 创建用户组，邀请 3 名成员\n2. 上传加密文件\n3. 执行轮换密钥操作\n4. 其中一名成员尝试解密 → 报错 "Invalid key"', linkedCommits: ['e4f5g6h'] },
  { id: 41, title: 'WebDAV 同步大文件时超时断连', status: 'open', labels: ['bug', 'P1'], assignee: 'Bob', initials: 'BW', comments: 2, created: '3天前', body: '上传超过 8MB 的文件到 Nextcloud WebDAV 时，连接超时（默认 30s timeout 不够）。', linkedCommits: [] },
  { id: 40, title: '飞书 Wiki 检索集成', status: 'in_progress', labels: ['feat', 'P1'], assignee: 'David', initials: 'DZ', comments: 8, created: '5天前', body: '实现调用飞书 Wiki 搜索 API，将结果纳入知识库检索上下文。', linkedCommits: ['i7j8k9l'] },
  { id: 39, title: '项目管理模块重构 — Git 操作面板', status: 'in_progress', labels: ['refactor', 'feat', 'P1'], assignee: 'Carol', initials: 'CL', comments: 3, created: '1周前', body: '将现有基础 git 操作改造为完整的 4 标签页架构（Git 面板 / 提交时间线 / Kanban / Issue）。', linkedCommits: ['a1b2c3d', 'm1n2o3p'] },
  { id: 38, title: '添加密码强度检测', status: 'closed', labels: ['feat', 'P2'], assignee: 'Alice', initials: 'AL', comments: 4, created: '2周前', body: '在保存密码时实时显示强度指示条（弱/中/强/极强）。', linkedCommits: ['q4r5s6t'] },
]

const STATUS_CONFIG: Record<IssueStatus, { icon: React.ReactNode; label: string; color: string; bg: string; border: string }> = {
  open: {
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    label: 'Open',
    color: 'hsl(152 72% 58%)',
    bg: 'hsl(152 50% 14% / 0.5)',
    border: 'hsl(152 50% 22% / 0.4)',
  },
  in_progress: {
    icon: <Clock className="w-3.5 h-3.5" />,
    label: '进行中',
    color: 'hsl(190 90% 60%)',
    bg: 'hsl(190 60% 14% / 0.5)',
    border: 'hsl(190 60% 24% / 0.4)',
  },
  closed: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: 'Closed',
    color: 'hsl(218 16% 50%)',
    bg: 'hsl(218 28% 10% / 0.5)',
    border: 'hsl(218 24% 18% / 0.4)',
  },
}

const LABEL_COLORS: Record<string, { bg: string; text: string }> = {
  bug: { bg: 'hsl(352 50% 18% / 0.5)', text: 'hsl(352 84% 70%)' },
  feat: { bg: 'hsl(190 60% 16% / 0.5)', text: 'hsl(190 90% 68%)' },
  refactor: { bg: 'hsl(262 50% 18% / 0.5)', text: 'hsl(262 80% 74%)' },
  docs: { bg: 'hsl(43 60% 18% / 0.5)', text: 'hsl(43 90% 68%)' },
  P0: { bg: 'hsl(352 80% 20% / 0.6)', text: 'hsl(352 100% 72%)' },
  P1: { bg: 'hsl(43 60% 18% / 0.5)', text: 'hsl(43 90% 66%)' },
  P2: { bg: 'hsl(218 28% 16% / 0.5)', text: 'hsl(218 16% 56%)' },
}

const AVATAR_COLORS: Record<string, string> = {
  AL: 'linear-gradient(135deg, hsl(190 60% 24%), hsl(190 80% 32%))',
  BW: 'linear-gradient(135deg, hsl(262 50% 28%), hsl(262 70% 38%))',
  CL: 'linear-gradient(135deg, hsl(152 50% 20%), hsl(152 60% 30%))',
  DZ: 'linear-gradient(135deg, hsl(43 60% 24%), hsl(43 80% 36%))',
}

export default function IssueTracker() {
  const [selected, setSelected] = useState<Issue | null>(null)
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all')
  const [showNewIssue, setShowNewIssue] = useState(false)

  const filtered = MOCK_ISSUES.filter(i => statusFilter === 'all' || i.status === statusFilter)

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: selected ? '1fr 420px' : '1fr', alignItems: 'start', height: 'calc(100vh - 180px)' }}>
      {/* 左：Issue 列表 */}
      <div className="glass-card rounded-md flex flex-col overflow-hidden h-full">
        {/* 头部 */}
        <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0"
          style={{ borderBottom: '1px solid hsl(218 24% 14%)' }}>
          <div className="flex gap-2">
            {([
              { id: 'all', label: '全部' },
              { id: 'open', label: 'Open' },
              { id: 'in_progress', label: '进行中' },
              { id: 'closed', label: 'Closed' },
            ] as { id: typeof statusFilter; label: string }[]).map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-medium transition-all",
                  statusFilter === f.id
                    ? "text-[hsl(190_90%_70%)] bg-[hsl(190_60%_14%/0.4)] border border-[hsl(190_60%_22%/0.4)]"
                    : "text-[hsl(218_16%_50%)] hover:text-[hsl(210_30%_72%)]"
                )}>
                {f.label}
              </button>
            ))}
          </div>
          <Button variant="primary" size="sm" className="ml-auto" onClick={() => setShowNewIssue(true)}>
            <Plus className="w-3.5 h-3.5" />
            新建 Issue
          </Button>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto divide-y divide-[hsl(218_24%_11%)]">
          {filtered.map(issue => {
            const sc = STATUS_CONFIG[issue.status]
            return (
              <div key={issue.id}
                className={cn("px-4 py-3.5 cursor-pointer transition-all group", selected?.id === issue.id && "")}
                style={selected?.id === issue.id
                  ? { background: 'hsl(218 28% 11%)', borderLeft: '3px solid hsl(190 90% 60%)' }
                  : { borderLeft: '3px solid transparent' }}
                onMouseEnter={e => { if (selected?.id !== issue.id) e.currentTarget.style.background = 'hsl(218 28% 9%)' }}
                onMouseLeave={e => { if (selected?.id !== issue.id) e.currentTarget.style.background = '' }}
                onClick={() => setSelected(selected?.id === issue.id ? null : issue)}>

                <div className="flex items-start gap-3">
                  {/* 状态图标 */}
                  <div className="mt-0.5 flex-shrink-0" style={{ color: sc.color }}>{sc.icon}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-medium" style={{ color: 'hsl(210 30% 90%)' }}>
                        #{issue.id} {issue.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {issue.labels.map(l => {
                        const lc = LABEL_COLORS[l] || { bg: 'hsl(218 28% 14%)', text: 'hsl(218 16% 54%)' }
                        return (
                          <span key={l} className="text-[10px] px-1.5 py-0.5 rounded-sm font-medium"
                            style={{ background: lc.bg, color: lc.text }}>
                            {l}
                          </span>
                        )
                      })}
                      <span className="text-xs" style={{ color: 'hsl(218 16% 42%)' }}>创建于 {issue.created}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {issue.comments > 0 && (
                      <div className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" style={{ color: 'hsl(218 16% 44%)' }} />
                        <span className="text-xs" style={{ color: 'hsl(218 16% 44%)' }}>{issue.comments}</span>
                      </div>
                    )}
                    {issue.initials && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{ background: AVATAR_COLORS[issue.initials] || 'hsl(218 30% 18%)', color: 'white' }}>
                        {issue.initials}
                      </div>
                    )}
                    <ChevronRight className={cn(
                      "w-4 h-4 transition-transform",
                      selected?.id === issue.id && "rotate-90"
                    )} style={{ color: 'hsl(218 16% 42%)' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 右：Issue 详情侧栏 */}
      {selected && (
        <div className="glass-card rounded-md flex flex-col overflow-hidden h-full animate-slide-in-right">
          <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0"
            style={{ borderBottom: '1px solid hsl(218 24% 14%)' }}>
            <span className="text-xs font-semibold" style={{ color: 'hsl(218 16% 52%)' }}>
              #{selected.id}
            </span>
            <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => setSelected(null)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <p className="text-sm font-semibold leading-snug" style={{ color: 'hsl(210 30% 92%)' }}>{selected.title}</p>
              <div className="flex items-center gap-2 mt-2">
                {selected.labels.map(l => {
                  const lc = LABEL_COLORS[l] || { bg: 'hsl(218 28% 14%)', text: 'hsl(218 16% 54%)' }
                  return (
                    <span key={l} className="text-[10px] px-1.5 py-0.5 rounded-sm font-medium"
                      style={{ background: lc.bg, color: lc.text }}>{l}</span>
                  )
                })}
                <div className="flex items-center gap-1 px-2 py-0.5 rounded"
                  style={{
                    background: STATUS_CONFIG[selected.status].bg,
                    border: `1px solid ${STATUS_CONFIG[selected.status].border}`,
                    color: STATUS_CONFIG[selected.status].color,
                  }}>
                  {STATUS_CONFIG[selected.status].icon}
                  <span className="text-[10px] font-medium">{STATUS_CONFIG[selected.status].label}</span>
                </div>
              </div>
            </div>

            {/* 描述 */}
            <div className="p-3 rounded-lg text-xs leading-relaxed"
              style={{ background: 'hsl(218 36% 7%)', border: '1px solid hsl(218 24% 13%)', color: 'hsl(218 16% 64%)', whiteSpace: 'pre-wrap' }}>
              {selected.body}
            </div>

            {/* 关联 Commit */}
            {selected.linkedCommits.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'hsl(218 16% 50%)' }}>关联提交</p>
                <div className="space-y-1.5">
                  {selected.linkedCommits.map(c => (
                    <div key={c} className="flex items-center gap-2 px-3 py-2 rounded"
                      style={{ background: 'hsl(218 36% 8%)', border: '1px solid hsl(218 24% 13%)' }}>
                      <GitCommit className="w-3.5 h-3.5" style={{ color: 'hsl(190 90% 60%)' }} />
                      <code className="text-xs font-mono" style={{ color: 'hsl(190 90% 68%)' }}>{c}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 模拟评论 */}
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'hsl(218 16% 50%)' }}>
                评论 ({selected.comments})
              </p>
              <div className="space-y-2">
                {Array.from({ length: Math.min(selected.comments, 3) }).map((_, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold"
                      style={{ background: 'hsl(218 30% 16%)', color: 'hsl(218 16% 60%)' }}>
                      {['AL', 'BW', 'CL'][i % 3]}
                    </div>
                    <div className="flex-1 p-2.5 rounded-lg text-xs"
                      style={{ background: 'hsl(218 36% 8%)', border: '1px solid hsl(218 24% 12%)', color: 'hsl(218 16% 62%)' }}>
                      {['这个问题已确认，正在排查根因...', '初步定位在 group-crypto.ts 的 unwrapKey 方法', '已提交修复 PR #43，请 review'][i % 3]}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input className="vm-input flex-1 h-8 text-xs" placeholder="添加评论..." />
                <Button variant="primary" size="sm" className="h-8">发送</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 新建 Issue 弹窗 */}
      {showNewIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'hsl(218 42% 5% / 0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowNewIssue(false)}>
          <div className="glass-panel rounded-xl p-5 w-full max-w-lg animate-scale-in space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'hsl(210 30% 92%)' }}>新建 Issue</h3>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowNewIssue(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>标题</label>
              <input className="vm-input" placeholder="描述问题或功能需求..." />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>描述</label>
              <textarea className="vm-textarea" placeholder="详细描述、复现步骤..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>指派人</label>
                <select className="vm-input h-9" style={{ background: 'hsl(218 36% 7%)', color: 'hsl(210 30% 85%)' }}>
                  <option>未指派</option>
                  <option>Alice</option><option>Bob</option><option>Carol</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>优先级</label>
                <select className="vm-input h-9" style={{ background: 'hsl(218 36% 7%)', color: 'hsl(210 30% 85%)' }}>
                  <option>P0 - 紧急</option><option>P1 - 高</option><option>P2 - 中</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="primary" className="flex-1">创建 Issue</Button>
              <Button variant="ghost" onClick={() => setShowNewIssue(false)}>取消</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
