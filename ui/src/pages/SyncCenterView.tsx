import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Cloud, RefreshCw, CheckCircle2, XCircle, Upload,
  Download, Database, HardDrive, FileText, AlertCircle, Loader2,
  MonitorSmartphone, Link2, Users, FolderOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import PageHero from '@/components/shared/PageHero'
import { vaultApi, type SyncRecord } from '@/lib/ipc'

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

type Tab = 'records' | 'manifest' | 'conflicts'

export default function SyncCenterView({ onConfigureFeishu }: { onConfigureFeishu: () => void }) {
  const { state, refresh, fullSync, syncManifest, pullManifest, downloadRecord, openAsset, linkCloudAccount, refreshCloudAccount } = useAppStore()
  const toast = useToast()

  const [recordSearch, setRecordSearch] = useState('')
  const [recordFilter, setRecordFilter] = useState('all')
  const materializedRecord = (id: string, localPath: string) => Boolean(localPath || state?.items.some(item => item.recordId === id && !item.remoteOnly))
  const [tab, setTab] = useState<Tab>('records')
  const [syncing, setSyncing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [accountBusy, setAccountBusy] = useState(false)

  const records = state?.records || []
  const manifestMeta = state?.manifestMeta
  const isFeishuLoggedIn = state?.isFeishuLoggedIn || false
  const feishuUser = state?.feishuUser
  const hasPassphrase = state?.settings.hasFeishuPassphrase || false
  const passphrase = state?.settings.feishuPassphrase || ''
  const context = state?.context || { scope: 'personal' as const, groupId: '', groupName: '' }
  const accountSync = state?.accountSync
  const autoSyncState = state?.autoSync
  const syncAccess = state?.syncAccess
  const syncModeLabel = syncAccess?.mode === 'personal' ? '个人自建' : syncAccess?.mode === 'enterprise' ? '企业自建' : 'AxonMind 托管'
  const conflicts = state?.syncConflicts || []
  const pendingConflicts = conflicts.filter(conflict => !conflict.resolvedAt && conflict.resolution === 'pending')

  const visibleRecords = records.filter(r => r.fileName.toLowerCase().includes(recordSearch.toLowerCase()) && (recordFilter === 'all' || (recordFilter === 'local') === materializedRecord(r.id, r.localPath))).sort((a, b) => (Date.parse(b.uploadedAt) || 0) - (Date.parse(a.uploadedAt) || 0))

  const handleAccountAction = async (mode: 'create' | 'join' | 'refresh') => {
    if (!isFeishuLoggedIn || !hasPassphrase) {
      toast('请先登录飞书并在配置中设置加密口令', 'warning')
      return
    }
    setAccountBusy(true)
    const result = mode === 'refresh' ? await refreshCloudAccount() : await linkCloudAccount(mode)
    setAccountBusy(false)
    if (result.error) toast(result.error, 'error')
    else toast(mode === 'join' ? '本机已加入云端账号' : mode === 'create' ? '云端账号已创建' : '设备信息已刷新', 'success')
  }

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
    } else if (result.accountError) {
      toast(`内容同步成功，设备状态刷新失败：${result.accountError}`, 'warning')
    } else if ((result.pull?.stats?.conflicts || 0) > 0) {
      toast(`同步完成，识别到 ${result.pull.stats.conflicts} 个并发修改；已按当前冲突策略处理`, 'warning')
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
    } else if ((result.stats?.conflicts || 0) > 0) {
      toast(`清单已合并，识别到 ${result.stats.conflicts} 个并发修改并按当前策略处理`, 'warning')
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

  const handleOpen = async (record: SyncRecord) => {
    const localItem = state?.items.find(item => item.recordId === record.id)
    const result = localItem
      ? await openAsset({ assetId: localItem.id, sourceTable: 'decrypted_items' })
      : await openAsset({ assetId: record.id, sourceTable: 'records' })
    if (!result?.opened) toast('本地文件无法打开，请检查原文件是否仍在该路径', 'warning')
  }

  const handleResolveConflict = async (id: string, action: 'local' | 'cloud') => {
    try {
      await vaultApi.resolveSyncConflict({ id, action })
      await refresh()
      toast(action === 'local' ? '已采用本机版本，将自动回传' : '已采用云端版本，将自动落地', 'success')
    } catch (err: any) {
      toast(err.message || '冲突处理失败', 'error')
    }
  }

  return (
    <div className="vm-page-stack vm-sync-page animate-fade-in">
      <PageHero
        eyebrow="多端协同"
        title="多设备同步"
        description="连接飞书云盘，在授权设备间同步加密内容、目录清单和删除状态。"
        details={[syncModeLabel, `${records.length} 条同步记录`, `${accountSync?.devices.filter(device => device.status === 'active').length || 1} 台活跃设备`, accountSync?.linked ? '账号已协同' : '等待绑定']}
        tone="emerald"
        actions={<>
          <Button variant={isFeishuLoggedIn ? 'outline' : 'primary'} onClick={onConfigureFeishu}>
            <Link2 className="w-4 h-4" />{isFeishuLoggedIn ? '飞书连接设置' : '连接飞书'}
          </Button>
          {isFeishuLoggedIn && <>
            <Button variant="outline" onClick={handlePull} disabled={pulling}>
              <Download className="w-4 h-4" />拉取清单
            </Button>
            <Button variant="outline" onClick={handlePush} disabled={pushing}>
              <Upload className="w-4 h-4" />上传清单
            </Button>
            <Button variant="primary" onClick={handleFullSync} disabled={syncing} aria-busy={syncing}>
              <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />{syncing ? '同步中...' : '完整同步'}
            </Button>
          </>}
        </>}
      />
      <section className="vm-module-summary" aria-label="同步概况">
        <div><span>本机可用</span><strong>{records.filter(r => materializedRecord(r.id, r.localPath)).length}</strong></div>
        <div><span>待取回</span><strong>{records.filter(r => !materializedRecord(r.id, r.localPath)).length}</strong></div>
        <div><span>待处理冲突</span><strong>{pendingConflicts.length}</strong></div>
        <div><span>最近同步结果</span><strong>{!isFeishuLoggedIn ? '等待连接' : autoSyncState?.status === 'offline' ? '断网重试' : autoSyncState?.lastError ? '需要处理' : autoSyncState?.lastSuccessAt ? '已成功' : '尚未完成'}</strong></div>
      </section>
      {autoSyncState?.lastError && <div className="vm-notice vm-notice-attention vm-sync-recovery" role="status"><div><strong>同步需要处理</strong><p>{autoSyncState.lastError}</p></div><Button size="sm" onClick={onConfigureFeishu}>检查连接配置</Button><Button size="sm" variant="primary" disabled={syncing || !isFeishuLoggedIn} onClick={handleFullSync}>重试同步</Button></div>}
      <div className="vm-sync-grid">
      {/* 左栏：飞书状态 */}
      <div className="vm-sync-overview">
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
            <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <MonitorSmartphone className="w-4 h-4 text-cyan-400" />
              多端协同账号
            </h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">同步接入方式</span>
              <span className="vm-badge vm-badge-emerald">{syncModeLabel}</span>
            </div>
            <div className="vm-surface-card rounded-lg p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    {accountSync?.linked ? '已绑定云端账号' : '仅本机账号'}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate mt-1">
                    {accountSync?.deviceName || '当前设备'} · {accountSync?.vaultId?.slice(0, 8) || '未初始化'}
                  </p>
                </div>
                <span className={accountSync?.linked ? 'vm-badge vm-badge-emerald' : 'vm-badge vm-badge-gold'}>
                  {accountSync?.linked ? '已协同' : '未绑定'}
                </span>
              </div>
            </div>
            {accountSync?.linked && !accountSync.feishuAccountMatches && (
              <p className="text-[10px] leading-relaxed text-amber-400">当前登录的飞书账号与已绑定账号不一致，已暂停账号资料刷新。</p>
            )}
            {(!isFeishuLoggedIn || !hasPassphrase) && (
              <div className="vm-notice vm-notice-attention vm-sync-setup-notice" role="status">
                <p className="text-xs font-medium text-foreground">
                  {!isFeishuLoggedIn ? '先连接飞书，再绑定云端账号' : '请先设置飞书加密口令'}
                </p>
                <p className="text-xs text-foreground leading-relaxed">
                  {!isFeishuLoggedIn ? '在飞书设置中选择接入方式、登录授权并保存加密口令，然后返回这里绑定。' : '所有设备需使用同一加密口令，保存后即可创建或加入云端账号。'}
                </p>
                <Button variant="primary" className="w-full" onClick={onConfigureFeishu}>
                  <Link2 className="w-4 h-4" />
                  {!isFeishuLoggedIn ? '开始配置飞书' : '设置加密口令'}
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {!accountSync?.linked ? (
                <>
                  <Button variant="primary" size="sm" className="disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:border-border" onClick={() => handleAccountAction('create')} disabled={accountBusy || !isFeishuLoggedIn || !hasPassphrase}>
                    {accountBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                    创建云端账号
                  </Button>
                  <Button variant="outline" size="sm" className="disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:border-border" onClick={() => handleAccountAction('join')} disabled={accountBusy || !isFeishuLoggedIn || !hasPassphrase}>
                    <Users className="w-3.5 h-3.5" />
                    加入已有账号
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" className="col-span-2" onClick={() => handleAccountAction('refresh')} disabled={accountBusy || !isFeishuLoggedIn || !accountSync.feishuAccountMatches}>
                  {accountBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  刷新设备列表
                </Button>
              )}
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              同一飞书账号与同一加密口令用于发现账号；每台电脑仍使用自己的本地解锁密码。
            </p>

          </div>
        </div>

        <div className="glass-card rounded-lg overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
            <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground" >
              <Cloud className="w-4 h-4" style={{ color: 'hsl(190 90% 60%)' }} />
              飞书云同步
            </h2>
          </div>

          <div className="p-4 space-y-3">
            {/* 连接状态 */}
            <div className={cn("vm-notice flex items-center gap-3", isFeishuLoggedIn ? "vm-notice-success" : "vm-notice-neutral")}>
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
              <div className="vm-surface-card rounded-lg p-3">
                <Database className="w-4 h-4 mb-1.5" style={{ color: 'hsl(190 90% 60%)' }} />
                <div className="text-lg font-bold text-foreground" >{records.length}</div>
                <div className="text-[10px] text-muted-foreground" >同步记录</div>
              </div>
              <div className="vm-surface-card rounded-lg p-3">
                <HardDrive className="w-4 h-4 mb-1.5" style={{ color: 'hsl(152 72% 52%)' }} />
                <div className="text-lg font-bold text-foreground" >
                  {formatSize(records.reduce((sum, r) => sum + (r.size || 0), 0))}
                </div>
                <div className="text-[10px] text-muted-foreground" >总大小</div>
              </div>
            </div>

            <div className="vm-surface-card rounded-lg p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-foreground">自动双向同步</span>
                <span className={cn('vm-badge', autoSyncState?.status === 'offline' || autoSyncState?.status === 'attention' ? 'vm-badge-gold' : 'vm-badge-emerald')}>
                  {!isFeishuLoggedIn ? '等待连接' : !state?.settings.feishuAutoSync ? '已关闭' : autoSyncState?.status === 'syncing' ? '同步中' : autoSyncState?.status === 'offline' ? '离线重试' : autoSyncState?.status === 'attention' ? '需要处理' : '运行中'}
                </span>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">上次成功：{formatTime(autoSyncState?.lastSuccessAt || '')}{autoSyncState?.nextSyncAt ? ` · 下次：${formatTime(autoSyncState.nextSyncAt)}` : ''}</p>
              {autoSyncState?.lastError && <p className="mt-1 text-[10px] leading-relaxed text-amber-400">{autoSyncState.lastError}</p>}
            </div>

            {/* Manifest 状态 */}
            {manifestMeta && (
              <div className="vm-surface-card rounded-lg p-3 space-y-1.5">
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
                {(manifestMeta.conflictCount || 0) > 0 && (
                  <p className="text-[10px] text-amber-400">并发修改：{manifestMeta.conflictCount} · 按配置策略处理</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="glass-card vm-device-strip" aria-label="设备同步状态">
        <div className="vm-section-heading"><h2>设备同步状态</h2><span className="text-xs text-muted-foreground">{accountSync?.linked ? '已授权设备 · 在线状态不代表内容已同步' : '绑定云端账号后查看其他设备'}</span></div>
        <div className="vm-device-strip-list">
          {accountSync?.linked ? accountSync.devices.filter(device => device.status === 'active').map(device => (
            <div className="vm-device-tile" key={device.id}><MonitorSmartphone className="w-5 h-5" /><div><strong>{device.name}{device.current ? ' · 本机' : ''}</strong><small>最近活动：{formatTime(device.lastSeenAt)}</small></div><span className={device.online ? 'vm-badge vm-badge-emerald' : 'vm-badge'}>{device.online ? '在线' : '离线'}</span></div>
          )) : <div className="vm-device-tile"><MonitorSmartphone className="w-5 h-5" /><div><strong>{accountSync?.deviceName || '当前设备'}</strong><small>仅本机 · 尚未绑定云端账号</small></div><span className="vm-badge vm-badge-gold">未绑定</span></div>}
        </div>
      </section>

      {/* 右栏：记录详情 */}
      <div className="glass-card rounded-lg overflow-hidden flex flex-col vm-full-height-panel">
        {/* Tab 导航 */}
        <div className="flex border-b border-border px-5 flex-shrink-0">
          {([
            { id: 'records' as Tab, label: '同步记录', count: records.length },
            { id: 'manifest' as Tab, label: '清单状态', count: null },
            { id: 'conflicts' as Tab, label: '冲突历史', count: pendingConflicts.length },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-2.5 text-xs font-medium border-b-2 transition-all flex items-center gap-2",
                tab === t.id ? "border-cyan-400 text-cyan-400" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              {t.label}
              {t.count !== null && (
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'records' && <div className="vm-module-toolbar"><input className="vm-input" aria-label="搜索同步记录" placeholder="搜索文件名称" value={recordSearch} onChange={e => setRecordSearch(e.target.value)} /><select className="vm-input" aria-label="同步记录状态" value={recordFilter} onChange={e => setRecordFilter(e.target.value)}><option value="all">全部状态</option><option value="local">本机可用</option><option value="remote">待取回</option></select></div>}
          {tab === 'records' && (
            visibleRecords.length === 0 ? (
              <div className="vm-empty py-16">
                <Cloud className="w-10 h-10 text-muted-foreground"  />
                <p className="vm-empty-title">{records.length ? '没有匹配的记录' : '暂无同步记录'}</p>
                <p className="vm-empty-description">先从“添加内容”录入资料，再执行完整同步；加密记录会显示在这里。</p>
              </div>
            ) : (
              <div className="vm-sync-record-table">
                <div className="vm-sync-record-heading" aria-hidden="true"><span>内容 / 大小</span><span>上传时间</span><span>可用状态</span><span>操作</span></div>
                {visibleRecords.map(r => {
                  const materialized = Boolean(r.localPath || state?.items.some(item => item.recordId === r.id && !item.remoteOnly))
                  return (
                  <div key={r.id} className="vm-sync-record-row vm-hover-row">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'hsl(190 60% 16% / 0.4)', border: '1px solid hsl(190 60% 24% / 0.3)' }}>
                      <FileText className="w-4 h-4" style={{ color: 'hsl(190 90% 60%)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-foreground" >{r.fileName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground" >{formatSize(r.size)}</span>

                        {r.scope === 'group' && (
                          <span className="vm-badge vm-badge-violet text-[9px]">组</span>
                        )}

                      </div>
                    </div>
                    <time className="text-[10px] text-muted-foreground">{formatTime(r.uploadedAt)}</time>
                        <span className={cn('vm-badge text-[9px]', materialized ? 'vm-badge-emerald' : 'vm-badge-gold')}>
                          {materialized ? '本机可用' : state?.settings.syncDownloadMode === 'manual' ? '等待手动取回' : '等待自动落地'}
                        </span>
                    <div className="flex gap-1">
                      {materialized ? (
                        <Button variant="ghost" size="sm" onClick={() => handleOpen(r)} title="打开本地文件">
                          <FolderOpen className="w-3 h-3" />打开
                        </Button>
                      ) : (
                        <Button variant="cyan" size="sm" onClick={() => handleDownload(r.id)} title="从云端取回并解密">
                          <Download className="w-3 h-3" />取回
                        </Button>
                      )}
                    </div>
                  </div>
                  )
                })}
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
                  每台设备写入独立加密清单，AxonMind 会自动汇总、识别并发修改，并按设置自动把实际内容落地到其他设备。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="vm-surface-card rounded-lg p-4">
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

                <div className="vm-surface-card rounded-lg p-4">
                  <Download className="w-5 h-5 mb-2" style={{ color: 'hsl(152 72% 52%)' }} />
                  <h3 className="text-xs font-semibold mb-1 text-foreground" >拉取清单</h3>
                  <p className="text-[10px] leading-relaxed text-muted-foreground" >
                    从飞书云盘汇总所有设备清单，合并到本地，并按“内容落地”配置自动下载实际内容。
                  </p>
                  <Button variant="outline" size="sm" className="w-full mt-3" onClick={handlePull} disabled={pulling || !isFeishuLoggedIn}>
                    {pulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    拉取
                  </Button>
                </div>
              </div>

              {manifestMeta && (
                <div className="vm-surface-card rounded-lg p-4">
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
                      <span className="text-foreground">{formatTime(manifestMeta.syncedAt)}</span>
                    </div>
                    {manifestMeta.pulledAt && (
                      <div className="flex items-center justify-between text-xs">
                        <span >上次拉取</span>
                        <span className="text-foreground">{formatTime(manifestMeta.pulledAt)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span>并发修改</span>
                      <span className={(manifestMeta.conflictCount || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                        {(manifestMeta.conflictCount || 0) > 0 ? `${manifestMeta.conflictCount} 个待检查` : '未检测到'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'conflicts' && (
            conflicts.length === 0 ? (
              <div className="vm-empty py-16">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                <p className="vm-empty-title">暂无并发冲突</p>
                <p className="vm-empty-description">多台设备修改同一条内容时，处理记录会显示在这里。</p>
              </div>
            ) : (
              <div className="space-y-2 max-w-2xl">
                {conflicts.map(conflict => (
                  <div key={conflict.id} className="vm-surface-card rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{conflict.localTitle || conflict.remoteTitle || conflict.assetId}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">本机：{formatTime(conflict.localChangedAt)} · 云端：{formatTime(conflict.remoteChangedAt)}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">策略：{conflict.strategy} · {conflict.resolvedAt ? `已处理 ${formatTime(conflict.resolvedAt)}` : conflict.resolution === 'pending' ? '等待选择' : `自动处理：${conflict.resolution}`}</p>
                      </div>
                      {!conflict.resolvedAt && conflict.resolution === 'pending' && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <Button variant="outline" size="sm" onClick={() => handleResolveConflict(conflict.id, 'local')}>采用本机</Button>
                          <Button variant="cyan" size="sm" onClick={() => handleResolveConflict(conflict.id, 'cloud')}>采用云端</Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
