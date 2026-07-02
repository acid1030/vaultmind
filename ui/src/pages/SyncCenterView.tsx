import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Cloud, RefreshCw, CheckCircle2, XCircle, Upload,
  Download, Database, HardDrive, FileText, AlertCircle, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import type { SyncRecord } from '@/lib/ipc'

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`
  return `${bytes} B`
}

function formatTime(iso: string): string {
  if (!iso) return '从未'
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`
  return date.toLocaleString('zh-CN')
}

type Tab = 'records' | 'manifest' | 'logs'

export default function SyncCenterView() {
  const { state, fullSync, syncManifest, pullManifest, downloadRecord } = useAppStore()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('records')
  const [syncing, setSyncing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [pushing, setPushing] = useState(false)

  const records = state?.records || []
  const manifestMeta = state?.manifestMeta
  const isFeishuLoggedIn = state?.isFeishuLoggedIn || false
  const feishuUser = state?.feishuUser
  const hasPassphrase = state?.settings.hasFeishuPassphrase || false
  const passphrase = state?.settings.feishuPassphrase || ''
  const context = state?.context || { scope: 'personal' as const, groupId: '', groupName: '' }

  const handleFullSync = async () => {
    if (!hasPassphrase) {
      toast('请先在配置中设置飞书加密口令', 'warning')
      return
    }
    setSyncing(true)
    toast('正在执行完整同步...', 'info')
    const result = await fullSync(passphrase, { scope: context.scope, groupId: context.groupId })
    setSyncing(false)
    if (result.pullError && result.pushError) {
      toast(`同步失败：${result.pullError}`, 'error')
    } else if (result.pushError) {
      toast(`上传失败：${result.pushError}`, 'warning')
    } else if (result.pullError) {
      toast(`拉取失败：${result.pullError}`, 'warning')
    } else {
      toast('完整同步成功', 'success')
    }
  }

  const handlePush = async () => {
    if (!hasPassphrase) {
      toast('请先在配置中设置飞书加密口令', 'warning')
      return
    }
    setPushing(true)
    toast('正在上传目录清单...', 'info')
    const result = await syncManifest(passphrase, { scope: context.scope, groupId: context.groupId })
    setPushing(false)
    if (result.error) {
      toast(result.error, 'error')
    } else {
      toast('目录清单已上传到飞书', 'success')
    }
  }

  const handlePull = async () => {
    if (!hasPassphrase) {
      toast('请先在配置中设置飞书加密口令', 'warning')
      return
    }
    setPulling(true)
    toast('正在从飞书拉取目录清单...', 'info')
    const result = await pullManifest(passphrase, { scope: context.scope, groupId: context.groupId })
    setPulling(false)
    if (result.error) {
      toast(result.error, 'error')
    } else {
      toast('已从飞书拉取并合并目录清单', 'success')
    }
  }

  const handleDownload = async (recordId: string) => {
    if (!hasPassphrase) {
      toast('请先在配置中设置飞书加密口令', 'warning')
      return
    }
    toast('正在下载解密...', 'info')
    const result = await downloadRecord(recordId, passphrase)
    if (result.error) {
      toast(result.error, 'error')
    } else {
      toast('文件已取回并解密成功', 'success')
    }
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: '280px 1fr', alignItems: 'start' }}>
      {/* 左栏：飞书状态 */}
      <div className="flex flex-col gap-4">
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground" >
              <Cloud className="w-4 h-4" style={{ color: 'hsl(190 90% 60%)' }} />
              飞书云同步
            </h2>
          </div>

          <div className="p-4 space-y-3">
            {/* 连接状态 */}
            <div className={cn("flex items-center gap-3 p-3 rounded-lg",
              isFeishuLoggedIn ? "" : "")}
              style={{
                background: isFeishuLoggedIn ? 'hsl(152 50% 14% / 0.4)' : 'hsl(43 60% 16% / 0.3)',
                border: `1px solid ${isFeishuLoggedIn ? 'hsl(152 50% 24% / 0.4)' : 'hsl(43 60% 24% / 0.35)'}`,
              }}>
              {isFeishuLoggedIn ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: 'hsl(152 72% 55%)' }} />
              ) : (
                <XCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'hsl(43 90% 60%)' }} />
              )}
              <div>
                <p className="text-xs font-medium text-foreground" >
                  {isFeishuLoggedIn ? '飞书已连接' : '飞书未连接'}
                </p>
                <p className="text-[10px] text-muted-foreground" >
                  {feishuUser?.name ? `用户: ${feishuUser.name}` : '请在配置中登录飞书'}
                </p>
              </div>
            </div>

            {/* 同步统计 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg p-3" style={{ background: 'hsl(218 36% 8%)', border: '1px solid var(--border)' }}>
                <Database className="w-4 h-4 mb-1.5" style={{ color: 'hsl(190 90% 60%)' }} />
                <div className="text-lg font-bold text-foreground" >{records.length}</div>
                <div className="text-[10px] text-muted-foreground" >同步记录</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'hsl(218 36% 8%)', border: '1px solid var(--border)' }}>
                <HardDrive className="w-4 h-4 mb-1.5" style={{ color: 'hsl(152 72% 52%)' }} />
                <div className="text-lg font-bold text-foreground" >
                  {formatSize(records.reduce((sum, r) => sum + (r.size || 0), 0))}
                </div>
                <div className="text-[10px] text-muted-foreground" >总大小</div>
              </div>
            </div>

            {/* 同步操作 */}
            <div className="space-y-2">
              <Button variant="primary" className="w-full" onClick={handleFullSync} disabled={syncing || !isFeishuLoggedIn}>
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {syncing ? '同步中...' : '完整同步'}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={handlePull} disabled={pulling || !isFeishuLoggedIn}>
                  {pulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  拉取清单
                </Button>
                <Button variant="outline" onClick={handlePush} disabled={pushing || !isFeishuLoggedIn}>
                  {pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  上传清单
                </Button>
              </div>
            </div>

            {/* Manifest 状态 */}
            {manifestMeta && (
              <div className="rounded-lg p-3 space-y-1.5"
                style={{ background: 'hsl(218 36% 8%)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground" >Manifest</span>
                  <CheckCircle2 className="w-3 h-3" style={{ color: 'hsl(152 72% 52%)' }} />
                </div>
                <p className="text-[10px] text-muted-foreground" >
                  上传: {formatTime(manifestMeta.syncedAt)}
                </p>
                {manifestMeta.pulledAt && (
                  <p className="text-[10px] text-muted-foreground" >
                    拉取: {formatTime(manifestMeta.pulledAt)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右栏：记录详情 */}
      <div className="glass-card rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 104px)' }}>
        {/* Tab 导航 */}
        <div className="flex border-b border-[hsl(218_24%_14%)] px-5 flex-shrink-0">
          {([
            { id: 'records' as Tab, label: '同步记录', count: records.length },
            { id: 'manifest' as Tab, label: '清单状态', count: null },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-2.5 text-xs font-medium border-b-2 transition-all flex items-center gap-2",
                tab === t.id ? "border-cyan-400 text-cyan-400" : "border-transparent text-[hsl(218_16%_48%)] hover:text-[hsl(210_30%_72%)]"
              )}>
              {t.label}
              {t.count !== null && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-sm"
                  style={{ background: 'hsl(218 28% 14%)', color: 'hsl(218 16% 50%)' }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'records' && (
            records.length === 0 ? (
              <div className="vm-empty py-16">
                <Cloud className="w-10 h-10 text-muted-foreground"  />
                <p className="text-sm">暂无同步记录</p>
                <p className="text-xs mt-1 text-muted-foreground" >
                  上传文件后，加密记录将显示在这里
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {records.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-[hsl(218_30%_10%)]"
                    style={{ background: 'hsl(218 36% 8%)', border: '1px solid var(--border)' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'hsl(190 60% 16% / 0.4)', border: '1px solid hsl(190 60% 24% / 0.3)' }}>
                      <FileText className="w-4 h-4" style={{ color: 'hsl(190 90% 60%)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-foreground" >{r.fileName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground" >{formatSize(r.size)}</span>
                        <span className="text-[10px] text-muted-foreground" >·</span>
                        <span className="text-[10px] text-muted-foreground" >{formatTime(r.uploadedAt)}</span>
                        {r.scope === 'group' && (
                          <span className="vm-badge vm-badge-violet text-[9px]">组</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDownload(r.id)} title="下载解密">
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'manifest' && (
            <div className="space-y-4 max-w-2xl">
              <div className="p-4 rounded-lg"
                style={{ background: 'hsl(190 60% 12% / 0.3)', border: '1px solid hsl(190 60% 22% / 0.3)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4" style={{ color: 'hsl(190 90% 60%)' }} />
                  <span className="text-xs font-semibold" style={{ color: 'hsl(190 60% 60%)' }}>目录清单同步说明</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground" >
                  目录清单（Manifest）是所有内容条目的加密索引，包含标题、标签、大小等元数据，但不包含明文内容。
                  上传清单后，其他设备可以拉取清单查看有哪些内容，然后按需下载具体文件。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg p-4" style={{ background: 'hsl(218 36% 8%)', border: '1px solid var(--border)' }}>
                  <Upload className="w-5 h-5 mb-2" style={{ color: 'hsl(190 90% 60%)' }} />
                  <h3 className="text-xs font-semibold mb-1 text-foreground" >上传清单</h3>
                  <p className="text-[10px] leading-relaxed text-muted-foreground" >
                    将本地内容条目的元数据加密上传到飞书云盘，供其他设备拉取。
                  </p>
                  <Button variant="outline" size="sm" className="w-full mt-3" onClick={handlePush} disabled={pushing || !isFeishuLoggedIn}>
                    {pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    上传
                  </Button>
                </div>

                <div className="rounded-lg p-4" style={{ background: 'hsl(218 36% 8%)', border: '1px solid var(--border)' }}>
                  <Download className="w-5 h-5 mb-2" style={{ color: 'hsl(152 72% 52%)' }} />
                  <h3 className="text-xs font-semibold mb-1 text-foreground" >拉取清单</h3>
                  <p className="text-[10px] leading-relaxed text-muted-foreground" >
                    从飞书云盘拉取清单，合并到本地。远端条目标记为「待下载」。
                  </p>
                  <Button variant="outline" size="sm" className="w-full mt-3" onClick={handlePull} disabled={pulling || !isFeishuLoggedIn}>
                    {pulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    拉取
                  </Button>
                </div>
              </div>

              {manifestMeta && (
                <div className="rounded-lg p-4" style={{ background: 'hsl(218 36% 8%)', border: '1px solid var(--border)' }}>
                  <h3 className="text-xs font-semibold mb-3 text-foreground" >同步状态</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span >清单文件 Token</span>
                      <code className="font-mono text-[10px]" style={{ color: 'hsl(190 90% 60%)' }}>
                        {manifestMeta.fileToken?.slice(0, 20)}...
                      </code>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span >上次上传</span>
                      <span style={{ color: 'hsl(210 30% 75%)' }}>{formatTime(manifestMeta.syncedAt)}</span>
                    </div>
                    {manifestMeta.pulledAt && (
                      <div className="flex items-center justify-between text-xs">
                        <span >上次拉取</span>
                        <span style={{ color: 'hsl(210 30% 75%)' }}>{formatTime(manifestMeta.pulledAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
