import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { GitCommit, ChevronDown, ChevronRight, Filter, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'

const MOCK_COMMITS = [
  { hash: 'a1b2c3d', short: 'a1b2c3d', author: 'Alice', initials: 'AL', time: '2小时前', msg: 'feat: 添加用户认证模块', branch: 'main', files: ['src/api/auth.ts', 'src/middleware/jwt.ts'], insertions: 124, deletions: 3, merge: false },
  { hash: 'e4f5g6h', short: 'e4f5g6h', author: 'Bob', initials: 'BW', time: '5小时前', msg: 'fix: 修复密钥加密解密边界问题', branch: 'main', files: ['src/utils/crypto.ts', 'tests/crypto.test.ts'], insertions: 28, deletions: 14, merge: false },
  { hash: 'i7j8k9l', short: 'i7j8k9l', author: 'Alice', initials: 'AL', time: '昨天 14:23', msg: 'Merge pull request #42 from feature/groups', branch: 'main', files: ['src/core/groups.ts', 'src/core/invite-crypto.ts', 'src/db/schema.sql'], insertions: 256, deletions: 0, merge: true },
  { hash: 'm1n2o3p', short: 'm1n2o3p', author: 'Carol', initials: 'CL', time: '昨天 10:05', msg: 'refactor: 重构用户组密钥管理', branch: 'feature/groups', files: ['src/core/group-crypto.ts'], insertions: 87, deletions: 52, merge: false },
  { hash: 'q4r5s6t', short: 'q4r5s6t', author: 'Bob', initials: 'BW', time: '2天前', msg: 'chore: 更新依赖版本', branch: 'main', files: ['package.json', 'package-lock.json'], insertions: 48, deletions: 48, merge: false },
  { hash: 'u7v8w9x', short: 'u7v8w9x', author: 'David', initials: 'DZ', time: '3天前', msg: 'docs: 更新 README 与 API 文档', branch: 'main', files: ['README.md', 'docs/api.md'], insertions: 120, deletions: 35, merge: false },
  { hash: 'y0z1a2b', short: 'y0z1a2b', author: 'Alice', initials: 'AL', time: '5天前', msg: 'feat: 飞书 OAuth 集成完成', branch: 'main', files: ['src/feishu/oauth.ts', 'src/feishu/drive.ts', 'src/preload.js'], insertions: 312, deletions: 22, merge: false },
]

const AVATAR_COLORS: Record<string, string> = {
  AL: 'linear-gradient(135deg, hsl(190 60% 28%), hsl(190 80% 36%))',
  BW: 'linear-gradient(135deg, hsl(262 50% 32%), hsl(262 70% 42%))',
  CL: 'linear-gradient(135deg, hsl(152 50% 24%), hsl(152 60% 34%))',
  DZ: 'linear-gradient(135deg, hsl(43 60% 28%), hsl(43 80% 40%))',
}

export default function CommitTimeline() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [branchFilter, setBranchFilter] = useState('all')

  const filtered = MOCK_COMMITS.filter(c => branchFilter === 'all' || c.branch === branchFilter)

  return (
    <div className="flex flex-col gap-4">
      {/* 过滤器 */}
      <div className="glass-card rounded-md px-4 py-3 flex items-center gap-3">
        <Filter className="w-4 h-4" style={{ color: 'hsl(218 16% 46%)' }} />
        <div className="flex gap-2">
          {['all', 'main', 'feature/groups'].map(b => (
            <button key={b} onClick={() => setBranchFilter(b)}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-all",
                branchFilter === b
                  ? "text-[hsl(190_90%_72%)] border border-[hsl(190_60%_24%/0.4)]"
                  : "text-[hsl(218_16%_50%)] hover:text-[hsl(210_30%_72%)]"
              )}
              style={branchFilter === b ? { background: 'hsl(190 60% 16% / 0.4)' } : {}}>
              {b === 'all' ? '所有分支' : b}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs" style={{ color: 'hsl(218 16% 42%)' }}>
          {filtered.length} 条提交
        </span>
      </div>

      {/* 时间轴 */}
      <div className="glass-card rounded-md overflow-hidden">
        <div className="relative">
          {/* 时间轴竖线 */}
          <div className="absolute left-[52px] top-0 bottom-0 w-px"
            style={{ background: 'hsl(218 24% 16%)' }} />

          {filtered.map((c, i) => {
            const isExpanded = expanded === c.hash
            return (
              <div key={c.hash}>
                <div
                  className="flex items-start gap-4 px-4 py-4 cursor-pointer transition-all group relative"
                  onMouseEnter={e => (e.currentTarget.style.background = 'hsl(218 28% 10%)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                  onClick={() => setExpanded(isExpanded ? null : c.hash)}>

                  {/* 节点圆点 */}
                  <div className="relative z-10 flex-shrink-0" style={{ width: 16, marginLeft: 28, marginTop: 2 }}>
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 transition-all",
                      c.merge ? "w-5 h-5 -ml-0.5" : "",
                      isExpanded ? "" : ""
                    )}
                      style={{
                        background: c.merge ? 'hsl(262 60% 28%)' : 'hsl(218 36% 12%)',
                        borderColor: c.merge ? 'hsl(262 70% 52%)' : isExpanded ? 'hsl(190 90% 60%)' : 'hsl(218 24% 28%)',
                        boxShadow: isExpanded ? '0 0 8px hsl(190 90% 60% / 0.4)' : 'none',
                      }} />
                  </div>

                  {/* 作者头像 */}
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: AVATAR_COLORS[c.initials] || 'hsl(218 30% 20%)',
                      color: 'hsl(210 30% 96%)',
                    }}>
                    {c.initials}
                  </div>

                  {/* 提交信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      <p className="text-sm font-medium leading-snug" style={{ color: 'hsl(210 30% 90%)' }}>
                        {c.msg}
                      </p>
                      {c.merge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: 'hsl(262 50% 20%)', color: 'hsl(262 80% 72%)', border: '1px solid hsl(262 50% 28%)' }}>
                          Merge
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <code className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: 'hsl(218 28% 14%)', color: 'hsl(190 90% 62%)' }}>
                        {c.short}
                      </code>
                      <span className="text-xs" style={{ color: 'hsl(218 16% 44%)' }}>{c.author}</span>
                      <span className="text-xs" style={{ color: 'hsl(218 16% 38%)' }}>{c.time}</span>
                      <span className="vm-badge-emerald vm-badge text-[10px]">+{c.insertions}</span>
                      {c.deletions > 0 && (
                        <span className="vm-badge-rose vm-badge text-[10px]">-{c.deletions}</span>
                      )}
                    </div>
                  </div>

                  {/* 展开箭头 */}
                  <div className="flex-shrink-0 mt-0.5">
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4" style={{ color: 'hsl(190 90% 60%)' }} />
                      : <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'hsl(218 16% 50%)' }} />}
                  </div>
                </div>

                {/* 展开详情：变更文件 */}
                {isExpanded && (
                  <div className="px-4 pb-4 ml-20 animate-fade-in">
                    <div className="rounded-lg overflow-hidden"
                      style={{ background: 'hsl(218 36% 7%)', border: '1px solid hsl(218 24% 13%)' }}>
                      <div className="px-4 py-2 flex items-center gap-2"
                        style={{ borderBottom: '1px solid hsl(218 24% 11%)' }}>
                        <GitCommit className="w-3.5 h-3.5" style={{ color: 'hsl(218 16% 46%)' }} />
                        <span className="text-xs font-semibold" style={{ color: 'hsl(218 16% 56%)' }}>
                          变更文件 ({c.files.length})
                        </span>
                      </div>
                      {c.files.map(f => (
                        <div key={f} className="px-4 py-2 flex items-center gap-2 text-xs font-mono"
                          style={{ borderBottom: '1px solid hsl(218 24% 9%)', color: 'hsl(210 30% 78%)' }}>
                          <span className="font-bold w-4" style={{ color: 'hsl(43 90% 60%)' }}>M</span>
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {i < filtered.length - 1 && (
                  <div className="h-px mx-4" style={{ background: 'hsl(218 24% 11%)' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
