import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  GitBranch, GitCommit, GitPullRequest, Upload, RefreshCw,
  Download, Archive, Merge, RotateCcw, Terminal, CheckSquare,
  Square, Plus, Minus, ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'

const MOCK_REPOS = [
  { id: 'r1', name: 'backend-service', branch: 'main', remote: 'origin', changed: 3, untracked: 1, ahead: 2, behind: 0 },
  { id: 'r2', name: 'frontend-app', branch: 'feature/redesign', remote: 'origin', changed: 7, untracked: 2, ahead: 0, behind: 1 },
  { id: 'r3', name: 'infra-scripts', branch: 'master', remote: 'origin', changed: 0, untracked: 0, ahead: 0, behind: 0 },
]

const MOCK_CHANGED_FILES = [
  { path: 'src/api/users.ts', status: 'M', staged: true },
  { path: 'src/utils/crypto.ts', status: 'M', staged: true },
  { path: 'src/components/Login.tsx', status: 'M', staged: false },
  { path: 'tests/crypto.test.ts', status: '?', staged: false },
]

const STATUS_COLORS: Record<string, string> = {
  M: 'hsl(43 90% 60%)',
  A: 'hsl(152 72% 52%)',
  D: 'hsl(352 80% 60%)',
  '?': 'hsl(218 16% 50%)',
  R: 'hsl(190 90% 60%)',
}

export default function GitPanel() {
  const [selectedRepo, setSelectedRepo] = useState(MOCK_REPOS[0].id)
  const [files, setFiles] = useState(MOCK_CHANGED_FILES)
  const [commitMsg, setCommitMsg] = useState('')
  const [output, setOutput] = useState('$ git status\nOn branch main\nYour branch is ahead of \'origin/main\' by 2 commits.\n\nChanges to be committed:\n  modified: src/api/users.ts\n  modified: src/utils/crypto.ts\n\nChanges not staged:\n  modified: src/components/Login.tsx\n\nUntracked files:\n  tests/crypto.test.ts')
  const [running, setRunning] = useState<string | null>(null)

  const repo = MOCK_REPOS.find(r => r.id === selectedRepo)

  const runCmd = async (cmd: string, fakeOutput: string) => {
    setRunning(cmd)
    setOutput(`$ git ${cmd}\n...`)
    await new Promise(r => setTimeout(r, 800))
    setOutput(`$ git ${cmd}\n${fakeOutput}`)
    setRunning(null)
  }

  const toggleStage = (path: string) => {
    setFiles(prev => prev.map(f => f.path === path ? { ...f, staged: !f.staged } : f))
  }

  const stagedFiles = files.filter(f => f.staged)
  const unstagedFiles = files.filter(f => !f.staged)

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: '260px 1fr', height: 'calc(100vh - 168px)' }}>
      {/* 左：仓库列表 */}
      <div className="glass-card rounded-md flex flex-col overflow-hidden">
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid hsl(218 24% 14%)' }}>
          <p className="text-xs font-semibold" style={{ color: 'hsl(218 16% 52%)' }}>仓库列表</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {MOCK_REPOS.map(r => (
            <button key={r.id} onClick={() => setSelectedRepo(r.id)}
              className={cn(
                "w-full text-left px-3 py-3 rounded-lg transition-all border",
                selectedRepo === r.id ? "" : "border-transparent hover:bg-[hsl(218_28%_10%)]"
              )}
              style={selectedRepo === r.id ? {
                background: 'hsl(218 30% 11%)',
                borderColor: 'hsl(190 60% 24% / 0.35)',
              } : {}}>
              <div className="flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(190 90% 60%)' }} />
                <span className="text-xs font-semibold truncate" style={{ color: 'hsl(210 30% 90%)' }}>{r.name}</span>
                {(r.changed > 0 || r.untracked > 0) && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'hsl(43 60% 20%)', color: 'hsl(43 90% 68%)' }}>
                    {r.changed + r.untracked}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px]" style={{ color: 'hsl(218 16% 44%)' }}>{r.branch}</span>
                {r.ahead > 0 && (
                  <span className="text-[10px]" style={{ color: 'hsl(152 72% 52%)' }}>↑{r.ahead}</span>
                )}
                {r.behind > 0 && (
                  <span className="text-[10px]" style={{ color: 'hsl(43 90% 60%)' }}>↓{r.behind}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 右：操作区 */}
      <div className="flex flex-col gap-3 min-h-0">
        {/* 顶部：分支信息 */}
        <div className="glass-card rounded-md px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <GitBranch className="w-4 h-4" style={{ color: 'hsl(190 90% 60%)' }} />
          <span className="text-sm font-semibold" style={{ color: 'hsl(210 30% 90%)' }}>{repo?.name}</span>
          <div className="flex items-center gap-1 px-2 py-1 rounded"
            style={{ background: 'hsl(190 60% 16% / 0.3)', border: '1px solid hsl(190 60% 24% / 0.3)' }}>
            <span className="text-xs" style={{ color: 'hsl(190 90% 68%)' }}>{repo?.branch}</span>
            <ChevronDown className="w-3 h-3" style={{ color: 'hsl(190 60% 50%)' }} />
          </div>
          {/* 快捷操作按钮 */}
          <div className="flex gap-1.5 ml-auto">
            {[
              { cmd: 'fetch', icon: <Download className="w-3.5 h-3.5" />, label: 'Fetch', fake: 'From origin\n * branch main -> FETCH_HEAD' },
              { cmd: 'pull', icon: <GitPullRequest className="w-3.5 h-3.5" />, label: 'Pull', fake: 'Already up to date.' },
              { cmd: 'push', icon: <Upload className="w-3.5 h-3.5" />, label: 'Push', fake: 'Enumerating objects: 5, done.\nCounting objects: 100% (5/5), done.\nTo https://github.com/org/repo.git\n   a1b2c3d..e4f5g6h  main -> main' },
              { cmd: 'stash', icon: <Archive className="w-3.5 h-3.5" />, label: 'Stash', fake: 'Saved working directory and index state WIP on main: a1b2c3d initial commit' },
            ].map(a => (
              <Button key={a.cmd} variant="ghost" size="sm"
                onClick={() => runCmd(a.cmd, a.fake)}
                disabled={running !== null}
                className={cn(running === a.cmd && "animate-pulse")}>
                {a.icon}
                {a.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 flex-1 min-h-0" style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr auto' }}>
          {/* 变更文件列表 */}
          <div className="glass-card rounded-md overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 flex-shrink-0 flex items-center justify-between"
              style={{ borderBottom: '1px solid hsl(218 24% 13%)' }}>
              <p className="text-xs font-semibold" style={{ color: 'hsl(218 16% 58%)' }}>
                变更文件 <span style={{ color: 'hsl(43 90% 62%)' }}>({files.length})</span>
              </p>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" title="全部暂存" onClick={() => setFiles(prev => prev.map(f => ({ ...f, staged: true })))}>
                  <CheckSquare className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" title="全部取消" onClick={() => setFiles(prev => prev.map(f => ({ ...f, staged: false })))}>
                  <Square className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* 已暂存 */}
              {stagedFiles.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-[10px] uppercase tracking-wide"
                    style={{ color: 'hsl(152 72% 46%)', background: 'hsl(152 50% 10% / 0.3)' }}>
                    已暂存 ({stagedFiles.length})
                  </div>
                  {stagedFiles.map(f => (
                    <div key={f.path} className="flex items-center gap-2 px-4 py-2 group cursor-pointer transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.background = 'hsl(218 28% 10%)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                      onClick={() => toggleStage(f.path)}>
                      <span className="text-xs font-mono w-4 flex-shrink-0 font-bold"
                        style={{ color: STATUS_COLORS[f.status] || 'hsl(218 16% 50%)' }}>{f.status}</span>
                      <span className="text-xs font-mono truncate" style={{ color: 'hsl(210 30% 82%)' }}>{f.path}</span>
                      <Minus className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 flex-shrink-0"
                        style={{ color: 'hsl(352 80% 60%)' }} />
                    </div>
                  ))}
                </div>
              )}
              {/* 未暂存 */}
              {unstagedFiles.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-[10px] uppercase tracking-wide"
                    style={{ color: 'hsl(218 16% 44%)', background: 'hsl(218 28% 8% / 0.5)' }}>
                    未暂存 ({unstagedFiles.length})
                  </div>
                  {unstagedFiles.map(f => (
                    <div key={f.path} className="flex items-center gap-2 px-4 py-2 group cursor-pointer transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.background = 'hsl(218 28% 10%)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                      onClick={() => toggleStage(f.path)}>
                      <span className="text-xs font-mono w-4 flex-shrink-0 font-bold"
                        style={{ color: STATUS_COLORS[f.status] || 'hsl(218 16% 50%)' }}>{f.status}</span>
                      <span className="text-xs font-mono truncate" style={{ color: 'hsl(218 16% 58%)' }}>{f.path}</span>
                      <Plus className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 flex-shrink-0"
                        style={{ color: 'hsl(152 72% 52%)' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* 提交区 */}
            <div className="px-3 py-3 flex-shrink-0 space-y-2"
              style={{ borderTop: '1px solid hsl(218 24% 13%)' }}>
              <textarea className="vm-textarea text-xs" style={{ minHeight: 56 }}
                placeholder="提交信息 (Ctrl+Enter 提交)"
                value={commitMsg} onChange={e => setCommitMsg(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    runCmd('commit', `[main a1b2c3d] ${commitMsg}\n ${stagedFiles.length} files changed`)
                    setCommitMsg('')
                  }
                }} />
              <div className="flex gap-2">
                <Button variant="success" className="flex-1 text-xs h-8" disabled={!commitMsg || stagedFiles.length === 0}
                  onClick={() => {
                    runCmd('commit', `[main a1b2c3d] ${commitMsg}\n ${stagedFiles.length} files changed`)
                    setCommitMsg('')
                  }}>
                  <GitCommit className="w-3.5 h-3.5" />
                  提交 ({stagedFiles.length})
                </Button>
                <Button variant="ghost" size="sm" title="Amend"
                  onClick={() => runCmd('commit --amend', 'Amended commit')}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* 终端输出 */}
          <div className="glass-card rounded-md flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 flex-shrink-0 flex items-center gap-2"
              style={{ borderBottom: '1px solid hsl(218 24% 13%)' }}>
              <Terminal className="w-3.5 h-3.5" style={{ color: 'hsl(152 72% 52%)' }} />
              <p className="text-xs font-semibold" style={{ color: 'hsl(218 16% 58%)' }}>输出</p>
              {running && (
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'hsl(152 72% 52%)' }} />
                  <span className="text-[10px]" style={{ color: 'hsl(152 72% 52%)' }}>运行中</span>
                </div>
              )}
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed"
              style={{
                color: 'hsl(152 60% 58%)',
                background: 'hsl(218 40% 4%)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
              {output}
            </pre>
          </div>

          {/* 底部：额外操作 */}
          <div className="glass-card rounded-md px-4 py-3 flex items-center gap-2 col-span-2 flex-shrink-0">
            <span className="text-xs" style={{ color: 'hsl(218 16% 46%)' }}>高级操作：</span>
            {[
              { label: 'Merge', icon: <Merge className="w-3.5 h-3.5" />, fake: 'Merge made by the \'ort\' strategy.\n src/api/users.ts | 12 ++++++++----' },
              { label: 'Rebase', icon: <GitBranch className="w-3.5 h-3.5" />, fake: 'Successfully rebased and updated refs/heads/main.' },
              { label: 'Reset --soft', icon: <RotateCcw className="w-3.5 h-3.5" />, fake: '' },
              { label: 'Reset --hard', icon: <RotateCcw className="w-3.5 h-3.5" />, fake: 'HEAD is now at a1b2c3d initial commit' },
            ].map(a => (
              <Button key={a.label} variant="outline" size="sm"
                onClick={() => runCmd(a.label.toLowerCase(), a.fake)}>
                {a.icon}
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
