import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  GitBranch, Plus, Trash2, Terminal, RefreshCw, Download,
  Upload, GitCommit, Play, Settings, Key, FolderGit2, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import PageHero from '@/components/shared/PageHero'
import { useConfirmDialog } from '@/components/shared/ConfirmDialog'

type ProjectTab = 'repos' | 'accounts'

export default function ProjectsView() {
  const { state, saveProjectAccount, saveProjectRepository, deleteProjectRepository,
    runProjectAction, chooseDirectory } = useAppStore()
  const toast = useToast()
  const { confirm, confirmDialog } = useConfirmDialog()

  const projects = state?.projects || { accounts: [], repositories: [] }
  const context = state?.context || { scope: 'personal' as const, groupId: '', groupName: '' }

  const [activeTab, setActiveTab] = useState<ProjectTab>('repos')
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showRepoModal, setShowRepoModal] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<string>('')
  const [output, setOutput] = useState<string>('')
  const [running, setRunning] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')

  // Account form
  const [accProvider, setAccProvider] = useState('github')
  const [accLabel, setAccLabel] = useState('')
  const [accUsername, setAccUsername] = useState('')
  const [accSecret, setAccSecret] = useState('')

  // Repo form
  const [repoAccountId, setRepoAccountId] = useState('')
  const [repoTool, setRepoTool] = useState('git')
  const [repoName, setRepoName] = useState('')
  const [repoRemote, setRepoRemote] = useState('')
  const [repoLocalPath, setRepoLocalPath] = useState('')
  const [repoMigrationDir, setRepoMigrationDir] = useState('')

  const repos = projects.repositories
  const accounts = projects.accounts
  const currentRepo = repos.find(r => r.id === selectedRepo)

  const handleSaveAccount = async () => {
    if (!accLabel.trim() || !accSecret.trim()) {
      toast('请填写账号名称和密钥', 'warning')
      return
    }
    const { error } = await saveProjectAccount({
      provider: accProvider,
      label: accLabel.trim(),
      username: accUsername.trim(),
      secret: accSecret.trim(),
      scope: context.scope,
      groupId: context.groupId,
    })
    if (error) {
      toast(`保存失败: ${error}`, 'error')
    } else {
      toast('账号已保存', 'success')
      setShowAccountModal(false)
      setAccLabel('')
      setAccUsername('')
      setAccSecret('')
    }
  }

  const handleChooseDir = async () => {
    try {
      const result = await chooseDirectory()
      if (!result.canceled && result.filePaths.length > 0) {
        setRepoLocalPath(result.filePaths[0])
      }
    } catch (err: any) {
      toast(err.message || '选择目录失败', 'error')
    }
  }

  const handleSaveRepo = async () => {
    if (!repoName.trim() || !repoRemote.trim() || !repoLocalPath.trim()) {
      toast('请填写完整信息', 'warning')
      return
    }
    const { error } = await saveProjectRepository({
      accountId: repoAccountId,
      tool: repoTool,
      name: repoName.trim(),
      remoteUrl: repoRemote.trim(),
      localPath: repoLocalPath.trim(),
      migrationDir: repoMigrationDir.trim(),
      scope: context.scope,
      groupId: context.groupId,
    })
    if (error) {
      toast(`保存失败: ${error}`, 'error')
    } else {
      toast('项目已添加', 'success')
      setShowRepoModal(false)
      setRepoName('')
      setRepoRemote('')
      setRepoLocalPath('')
      setRepoMigrationDir('')
      setRepoAccountId('')
    }
  }

  const handleDeleteRepo = async (repoId: string) => {
    const repo = repos.find(r => r.id === repoId)
    if (!await confirm({
      title: '移除项目配置？',
      description: `「${repo?.name || '未命名'}」会从 AxonMind 中移除，本地仓库文件不会被删除。`,
      confirmLabel: '移除项目',
    })) return
    const { error } = await deleteProjectRepository(repoId)
    if (error) {
      toast(`删除失败: ${error}`, 'error')
      return
    }
    toast('项目已删除', 'info')
    if (selectedRepo === repoId) setSelectedRepo('')
  }

  const handleAction = async (action: string, message?: string) => {
    if (!selectedRepo) return
    setRunning(true)
    setOutput(`$ ${action}...\n`)
    const result = await runProjectAction(selectedRepo, action, message)
    setRunning(false)
    if (result.error) {
      setOutput(prev => prev + `Error: ${result.error}`)
      toast(`操作失败: ${result.error}`, 'error')
    } else {
      setOutput(result.output || '(无输出)')
    }
  }

  const handleCommit = async () => {
    if (!commitMsg.trim()) {
      toast('请输入提交信息', 'warning')
      return
    }
    await handleAction('commit', commitMsg.trim())
    setCommitMsg('')
  }

  return (
    <div className="vm-page-stack animate-fade-in">
      <PageHero
        eyebrow="项目工作区"
        title="项目仓库"
        description="管理 Git 与 SVN 项目、授权账号和本地工作目录，并执行常用仓库操作。"
        details={[`${repos.length} 个仓库`, `${accounts.length} 个账号`, context.scope === 'group' ? '团队上下文' : '个人上下文']}
        tone="violet"
      />
      <div className="vm-project-grid">
      {/* ====== Left: Repo & Account List ====== */}
      <div className="flex flex-col gap-3 overflow-y-auto vm-full-height-panel">
        {/* Tabs */}
        <div className="glass-card rounded-lg p-1 flex gap-1">
          {([
            { id: 'repos' as ProjectTab, label: '项目仓库', icon: FolderGit2 },
            { id: 'accounts' as ProjectTab, label: '账号', icon: Key },
          ]).map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-accent text-accent-foreground border border-primary/30"
                    : "text-muted-foreground hover:text-foreground"
                )}>
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Repo List */}
        {activeTab === 'repos' && (
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-sm font-semibold text-foreground">仓库列表</h2>
              <Button variant="primary" size="icon-sm" onClick={() => setShowRepoModal(true)}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="p-2 space-y-1">
              {repos.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <FolderGit2 className="w-7 h-7 mx-auto mb-2 text-[hsl(218_16%_32%)]" />
                  <p className="text-xs text-[hsl(218_16%_44%)]">还没有项目</p>
                </div>
              )}
              {repos.map(repo => (
                <button key={repo.id} onClick={() => { setSelectedRepo(repo.id); setOutput('') }}
                  className={cn(
                    "w-full text-left px-3 py-3 rounded-lg transition-all border",
                    selectedRepo === repo.id
                      ? "bg-accent border-primary/35"
                      : "border-transparent vm-hover-row"
                  )}>
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-3.5 h-3.5 flex-shrink-0 text-[hsl(190_90%_60%)]" />
                    <span className="text-xs font-semibold truncate text-foreground">{repo.name}</span>
                    <span className={cn("vm-badge text-[9px] flex-shrink-0 ml-auto",
                      repo.tool === 'svn' ? "vm-badge-violet" : "vm-badge-cyan")}>
                      {repo.tool.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] mt-1.5 text-[hsl(218_16%_44%)] truncate">{repo.remoteUrl}</p>
                  <p className="text-[10px] mt-0.5 text-[hsl(218_16%_36%)] truncate">{repo.localPath}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Account List */}
        {activeTab === 'accounts' && (
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-sm font-semibold text-foreground">Git/SVN 账号</h2>
              <Button variant="primary" size="icon-sm" onClick={() => setShowAccountModal(true)}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="p-2 space-y-1">
              {accounts.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <Key className="w-7 h-7 mx-auto mb-2 text-[hsl(218_16%_32%)]" />
                  <p className="text-xs text-[hsl(218_16%_44%)]">还没有账号</p>
                </div>
              )}
              {accounts.map(acc => (
                <div key={acc.id} className="vm-hover-row px-3 py-2.5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                    <span className="text-xs font-medium text-foreground truncate">{acc.label}</span>
                    <span className="vm-badge vm-badge-cyan text-[9px] flex-shrink-0 ml-auto">{acc.provider}</span>
                  </div>
                  {acc.username && (
                    <p className="text-[10px] mt-1 text-[hsl(218_16%_44%)]">{acc.username}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ====== Right: Detail & Actions ====== */}
      {currentRepo ? (
        <div className="flex flex-col gap-3 min-h-0">
          {/* Repo Info Bar */}
          <div className="glass-card rounded-md px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <GitBranch className="w-4 h-4 text-[hsl(190_90%_60%)]" />
            <span className="text-sm font-semibold text-foreground">{currentRepo.name}</span>
            <span className="vm-badge vm-badge-cyan text-[9px]">{currentRepo.tool.toUpperCase()}</span>
            {currentRepo.migrationDir && (
              <span className="text-[10px] text-[hsl(218_16%_44%)]">迁移目录: {currentRepo.migrationDir}</span>
            )}
            <div className="flex gap-1.5 ml-auto">
              <Button variant="ghost" size="sm" onClick={() => handleAction('status')}
                disabled={running}>
                <RefreshCw className="w-3.5 h-3.5" />
                Status
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleAction('pull')}
                disabled={running}>
                <Download className="w-3.5 h-3.5" />
                Pull
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleAction('push')}
                disabled={running}>
                <Upload className="w-3.5 h-3.5" />
                Push
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleAction('log')}
                disabled={running}>
                <GitBranch className="w-3.5 h-3.5" />
                Log
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleAction('clone')}
                disabled={running}>
                <Play className="w-3.5 h-3.5" />
                Clone
              </Button>
              <Button variant="ghost" size="icon-sm" className="text-rose-400 hover:text-rose-300"
                onClick={() => handleDeleteRepo(currentRepo.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Commit Area */}
          <div className="glass-card rounded-md p-3 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-[hsl(210_30%_82%)]">提交</span>
            </div>
            <div className="flex gap-2">
              <input className="vm-input flex-1" placeholder="提交信息..."
                value={commitMsg} onChange={e => setCommitMsg(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommit()
                }} />
              <Button variant="success" size="sm" onClick={handleCommit}
                disabled={running || !commitMsg.trim()}>
                <GitCommit className="w-3.5 h-3.5" />
                Commit
              </Button>
            </div>
          </div>

          {/* Output */}
          <div className="glass-card rounded-md flex flex-col overflow-hidden flex-1 min-h-0">
            <div className="px-4 py-2.5 flex-shrink-0 flex items-center gap-2"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <Terminal className="w-3.5 h-3.5 text-[hsl(152_72%_52%)]" />
              <p className="text-xs font-semibold text-[hsl(218_16%_58%)]">输出</p>
              {running && (
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-[hsl(152_72%_52%)]" />
                  <span className="text-[10px] text-[hsl(152_72%_52%)]">运行中</span>
                </div>
              )}
            </div>
            <pre className="vm-terminal flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed"
              style={{
                color: 'hsl(152 60% 58%)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
              {output || '$ 等待操作...'}
            </pre>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-lg flex items-center justify-center"
          style={{ minHeight: '400px' }}>
          <div className="vm-empty py-12">
            <FolderGit2 className="w-12 h-12 mx-auto mb-3 text-[hsl(218_16%_28%)]" />
            <p className="vm-empty-title">还没有选中的项目</p>
            <p className="vm-empty-description">选择已有仓库查看状态，或者添加一个本地 Git / SVN 项目。</p>
            <div className="flex items-center gap-2 mt-1">
              <Button variant="primary" size="sm" onClick={() => setShowRepoModal(true)}><Plus className="w-3.5 h-3.5" />新建项目配置</Button>
              <Button variant="outline" size="sm" onClick={() => setShowAccountModal(true)}><Key className="w-3.5 h-3.5" />添加账号凭据</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Account Modal */}
      {showAccountModal && (
        <div className="vm-modal-mask fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAccountModal(false)}>
          <div className="glass-panel rounded-xl w-full max-w-md p-5 animate-scale-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[hsl(210_30%_90%)] flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                添加 Git/SVN 账号
              </h3>
              <button onClick={() => setShowAccountModal(false)} className="text-[hsl(218_16%_48%)] hover:text-[hsl(210_30%_72%)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">平台</label>
                <select className="vm-input w-full" value={accProvider} onChange={e => setAccProvider(e.target.value)}>
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                  <option value="gitea">Gitea</option>
                  <option value="bitbucket">Bitbucket</option>
                  <option value="svn">SVN</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">账号名称 *</label>
                <input className="vm-input w-full" placeholder="例如：work-github"
                  value={accLabel} onChange={e => setAccLabel(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">用户名</label>
                <input className="vm-input w-full" placeholder="Git 用户名"
                  value={accUsername} onChange={e => setAccUsername(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">Token / 密码 *</label>
                <input className="vm-input w-full" type="password" placeholder="access token 或密码"
                  value={accSecret} onChange={e => setAccSecret(e.target.value)} />
              </div>
              <Button variant="success" className="w-full" onClick={handleSaveAccount}>
                <Key className="w-4 h-4" />
                保存账号
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Repo Modal */}
      {showRepoModal && (
        <div className="vm-modal-mask fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowRepoModal(false)}>
          <div className="glass-panel rounded-xl w-full max-w-md p-5 animate-scale-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[hsl(210_30%_90%)] flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-cyan-400" />
                添加项目仓库
              </h3>
              <button onClick={() => setShowRepoModal(false)} className="text-[hsl(218_16%_48%)] hover:text-[hsl(210_30%_72%)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">工具</label>
                  <select className="vm-input w-full" value={repoTool} onChange={e => setRepoTool(e.target.value)}>
                    <option value="git">Git</option>
                    <option value="svn">SVN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">关联账号</label>
                  <select className="vm-input w-full" value={repoAccountId} onChange={e => setRepoAccountId(e.target.value)}>
                    <option value="">无</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">项目名称 *</label>
                <input className="vm-input w-full" placeholder="例如：my-project"
                  value={repoName} onChange={e => setRepoName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">仓库地址 *</label>
                <input className="vm-input w-full" placeholder="https://github.com/org/repo.git"
                  value={repoRemote} onChange={e => setRepoRemote(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">本地路径 *</label>
                <div className="flex gap-2">
                  <input className="vm-input flex-1" placeholder="/path/to/local"
                    value={repoLocalPath} onChange={e => setRepoLocalPath(e.target.value)} />
                  <Button variant="outline" size="sm" onClick={handleChooseDir}>
                    <FolderGit2 className="w-3.5 h-3.5" />
                    选择
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">迁移目录（可选）</label>
                <input className="vm-input w-full" placeholder="如 db/migrations"
                  value={repoMigrationDir} onChange={e => setRepoMigrationDir(e.target.value)} />
              </div>
              <Button variant="success" className="w-full" onClick={handleSaveRepo}>
                <FolderGit2 className="w-4 h-4" />
                添加项目
              </Button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
      </div>
    </div>
  )
}
