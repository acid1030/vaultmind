import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Cloud, RefreshCw, CheckCircle2, XCircle, AlertCircle, Upload,
  Download, Settings2, Plus, Trash2, ChevronRight, Database, HardDrive,
  Folder, BarChart2
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ProviderStatus = 'connected' | 'disconnected' | 'syncing' | 'error'

interface SyncProvider {
  id: string
  name: string
  type: string
  status: ProviderStatus
  lastSync: string
  usedBytes: number
  totalBytes: number
  icon: string  // emoji icon
  color: string
}

const MOCK_PROVIDERS: SyncProvider[] = [
  { id: 'p1', name: 'WebDAV 服务器',   type: 'webdav',   status: 'connected',    lastSync: '2 分钟前',  usedBytes: 1.2e9,  totalBytes: 10e9,  icon: '🌐', color: 'hsl(220 80% 60%)' },
  { id: 'p2', name: '阿里云 OSS',       type: 'aliyun',   status: 'syncing',      lastSync: '同步中...',  usedBytes: 4.5e9,  totalBytes: 50e9,  icon: '🟠', color: 'hsl(25 90% 56%)' },
  { id: 'p3', name: '腾讯 COS',         type: 'tencent',  status: 'connected',    lastSync: '1 小时前',   usedBytes: 2.1e9,  totalBytes: 20e9,  icon: '🔵', color: 'hsl(200 82% 52%)' },
  { id: 'p4', name: 'Dropbox',          type: 'dropbox',  status: 'disconnected', lastSync: '从未同步',    usedBytes: 0,      totalBytes: 2e9,   icon: '📦', color: 'hsl(214 60% 52%)' },
  { id: 'p5', name: 'OneDrive',         type: 'onedrive', status: 'error',        lastSync: '3 天前',     usedBytes: 0.8e9,  totalBytes: 5e9,   icon: '☁️', color: 'hsl(210 82% 56%)' },
  { id: 'p6', name: 'Google Drive',     type: 'gdrive',   status: 'disconnected', lastSync: '从未同步',    usedBytes: 0,      totalBytes: 15e9,  icon: '🔴', color: 'hsl(4 80% 56%)' },
  { id: 'p7', name: '飞书云文档',        type: 'feishu',   status: 'connected',    lastSync: '5 分钟前',   usedBytes: 0.4e9,  totalBytes: 2e9,   icon: '🪐', color: 'hsl(152 60% 48%)' },
  { id: 'p8', name: 'MinIO 私有化',     type: 'minio',    status: 'connected',    lastSync: '刚刚',       usedBytes: 15.2e9, totalBytes: 200e9, icon: '🗄️', color: 'hsl(280 60% 60%)' },
]

const STATUS_CONFIG: Record<ProviderStatus, { label: string; color: string; icon: React.ElementType }> = {
  connected:    { label: '已连接', color: 'hsl(152 72% 52%)', icon: CheckCircle2  },
  disconnected: { label: '未连接', color: 'hsl(218 16% 48%)', icon: XCircle       },
  syncing:      { label: '同步中', color: 'hsl(190 90% 60%)', icon: RefreshCw     },
  error:        { label: '错误',   color: 'hsl(352 84% 60%)', icon: AlertCircle   },
}

const formatBytes = (b: number) => {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`
  return `${(b / 1e3).toFixed(0)} KB`
}

// New provider form fields per type
const PROVIDER_FORMS: Record<string, { label: string; placeholder: string; type?: string }[]> = {
  webdav:   [
    { label: '服务器地址', placeholder: 'https://dav.example.com/dav/' },
    { label: '用户名',     placeholder: 'username' },
    { label: '密码',       placeholder: '••••••••', type: 'password' },
  ],
  aliyun:   [
    { label: 'Endpoint',    placeholder: 'oss-cn-hangzhou.aliyuncs.com' },
    { label: 'Bucket',      placeholder: 'my-bucket' },
    { label: 'AccessKey ID',placeholder: 'LTAI...' },
    { label: 'AccessKey Secret', placeholder: '••••••••', type: 'password' },
  ],
  tencent:  [
    { label: 'Endpoint',    placeholder: 'cos.ap-beijing.myqcloud.com' },
    { label: 'Bucket',      placeholder: 'my-bucket-1234567890' },
    { label: 'SecretId',    placeholder: 'AKIDxxxx' },
    { label: 'SecretKey',   placeholder: '••••••••', type: 'password' },
  ],
  dropbox:  [{ label: 'Access Token', placeholder: '点击下方按钮通过 OAuth 授权', type: 'password' }],
  onedrive: [{ label: 'Access Token', placeholder: '点击下方按钮通过 OAuth 授权', type: 'password' }],
  gdrive:   [{ label: 'Access Token', placeholder: '点击下方按钮通过 OAuth 授权', type: 'password' }],
  feishu:   [{ label: 'App ID',       placeholder: 'cli_xxx' }, { label: 'App Secret', placeholder: '••••', type: 'password' }],
  minio:    [
    { label: 'Endpoint',    placeholder: 'http://192.168.1.100:9000' },
    { label: 'Bucket',      placeholder: 'vaultmind-data' },
    { label: 'Access Key',  placeholder: 'minioadmin' },
    { label: 'Secret Key',  placeholder: '••••••••', type: 'password' },
  ],
}

type Tab = 'overview' | 'settings' | 'logs'

export default function SyncCenterView() {
  const [providers, setProviders] = useState<SyncProvider[]>(MOCK_PROVIDERS)
  const [selected, setSelected] = useState<string | null>('p1')
  const [tab, setTab] = useState<Tab>('overview')
  const [addingType, setAddingType] = useState<string | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)

  const selectedProvider = providers.find(p => p.id === selected)

  const triggerSync = (id: string) => {
    setProviders(prev => prev.map(p =>
      p.id === id ? { ...p, status: 'syncing', lastSync: '同步中...' } : p
    ))
    setTimeout(() => {
      setProviders(prev => prev.map(p =>
        p.id === id ? { ...p, status: 'connected', lastSync: '刚刚' } : p
      ))
    }, 2500)
  }

  const PROVIDER_TYPES = [
    { type: 'webdav', label: 'WebDAV',       icon: '🌐' },
    { type: 'aliyun', label: '阿里云 OSS',   icon: '🟠' },
    { type: 'tencent',label: '腾讯 COS',     icon: '🔵' },
    { type: 'dropbox',label: 'Dropbox',      icon: '📦' },
    { type: 'onedrive',label:'OneDrive',     icon: '☁️' },
    { type: 'gdrive', label: 'Google Drive', icon: '🔴' },
    { type: 'feishu', label: '飞书',          icon: '🪐' },
    { type: 'minio',  label: 'MinIO',        icon: '🗄️' },
  ]

  return (
    <div className="grid gap-4 h-full" style={{ gridTemplateColumns: '300px 1fr', alignItems: 'start' }}>
      {/* 左栏：云服务列表 */}
      <div className="glass-card rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 104px)' }}>
        <div className="px-4 py-3 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid hsl(218 24% 14%)' }}>
          <h2 className="text-sm font-semibold text-[hsl(210_30%_90%)]">同步服务</h2>
          <div className="relative">
            <Button variant="primary" size="sm" onClick={() => setShowAddMenu(!showAddMenu)}>
              <Plus className="w-3.5 h-3.5" />
              添加
            </Button>
            {showAddMenu && (
              <div className="absolute top-full right-0 mt-1.5 w-48 glass-panel rounded-md py-1 z-50 animate-scale-in">
                {PROVIDER_TYPES.map(pt => (
                  <button key={pt.type}
                    onClick={() => { setAddingType(pt.type); setShowAddMenu(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[hsl(218_30%_14%)] text-[hsl(218_16%_72%)] hover:text-[hsl(210_30%_88%)] flex items-center gap-2">
                    <span>{pt.icon}</span>
                    <span>{pt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {providers.map(p => {
            const statusCfg = STATUS_CONFIG[p.status]
            const StatusIcon = statusCfg.icon
            const pct = p.totalBytes > 0 ? (p.usedBytes / p.totalBytes) * 100 : 0
            return (
              <button key={p.id}
                onClick={() => setSelected(p.id)}
                className={cn(
                  "w-full text-left flex items-center gap-3 p-2.5 rounded-lg transition-all",
                  selected === p.id
                    ? "bg-[hsl(218_30%_13%)] border border-[hsl(190_60%_24%/0.35)]"
                    : "hover:bg-[hsl(218_30%_11%)] border border-transparent"
                )}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                  style={{ background: 'hsl(218 28% 14%)', border: '1px solid hsl(218 24% 20%)' }}>
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-[hsl(210_30%_88%)] truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <StatusIcon
                      className={cn("w-2.5 h-2.5 flex-shrink-0", p.status === 'syncing' && "animate-spin")}
                      style={{ color: statusCfg.color }} />
                    <span className="text-[10px]" style={{ color: 'hsl(218 16% 48%)' }}>{p.lastSync}</span>
                  </div>
                  {p.totalBytes > 0 && (
                    <div className="mt-1.5 h-0.5 rounded-full bg-[hsl(218_24%_16%)] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: p.color }} />
                    </div>
                  )}
                </div>
                <ChevronRight className="w-3 h-3 flex-shrink-0 text-[hsl(218_16%_36%)]" />
              </button>
            )
          })}
        </div>
      </div>

      {/* 右栏：详情 / 新增表单 */}
      <div className="glass-card rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 104px)' }}>
        {addingType ? (
          /* 新增配置表单 */
          <>
            <div className="px-5 py-3.5 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: '1px solid hsl(218 24% 14%)' }}>
              <h2 className="text-sm font-semibold text-[hsl(210_30%_90%)]">
                配置新云服务 — {PROVIDER_TYPES.find(p => p.type === addingType)?.label}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setAddingType(null)}>取消</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="space-y-2">
                <label className="block text-xs text-[hsl(218_16%_56%)] font-medium">名称（备注）</label>
                <input className="vm-input w-full" placeholder="例如：工作文档备份" />
              </div>
              {(PROVIDER_FORMS[addingType] || []).map((field, i) => (
                <div key={i} className="space-y-2">
                  <label className="block text-xs text-[hsl(218_16%_56%)] font-medium">{field.label}</label>
                  <input className="vm-input w-full" type={field.type || 'text'} placeholder={field.placeholder} />
                </div>
              ))}

              {['dropbox', 'onedrive', 'gdrive'].includes(addingType) && (
                <Button variant="outline" className="w-full">
                  <Cloud className="w-3.5 h-3.5" />
                  通过 OAuth 授权（推荐）
                </Button>
              )}

              <div className="space-y-2">
                <label className="block text-xs text-[hsl(218_16%_56%)] font-medium">同步策略</label>
                <select className="vm-input w-full">
                  <option>手动同步</option>
                  <option>每 15 分钟</option>
                  <option>每小时</option>
                  <option>实时同步</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-[hsl(218_16%_56%)] font-medium">加密传输</label>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="enc" defaultChecked
                    className="w-4 h-4 rounded border-[hsl(218_24%_20%)]" />
                  <label htmlFor="enc" className="text-xs text-[hsl(218_16%_60%)]">上传前进行端到端加密（AES-256-GCM）</label>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1">测试连接</Button>
                <Button variant="primary" className="flex-1" onClick={() => setAddingType(null)}>
                  保存并连接
                </Button>
              </div>
            </div>
          </>
        ) : selectedProvider ? (
          /* 服务详情 */
          <>
            <div className="px-5 py-3.5 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: '1px solid hsl(218 24% 14%)' }}>
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{selectedProvider.icon}</span>
                <div>
                  <h2 className="text-sm font-semibold text-[hsl(210_30%_90%)]">{selectedProvider.name}</h2>
                  <p className="text-[10px] text-[hsl(218_16%_46%)]">{selectedProvider.type.toUpperCase()}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">
                  <Settings2 className="w-3.5 h-3.5" />
                  配置
                </Button>
                <Button variant="primary" size="sm"
                  disabled={selectedProvider.status === 'syncing'}
                  onClick={() => triggerSync(selectedProvider.id)}>
                  <RefreshCw className={cn("w-3.5 h-3.5", selectedProvider.status === 'syncing' && "animate-spin")} />
                  {selectedProvider.status === 'syncing' ? '同步中...' : '立即同步'}
                </Button>
              </div>
            </div>

            {/* Tab 导航 */}
            <div className="flex border-b border-[hsl(218_24%_14%)] px-5 flex-shrink-0">
              {(['overview', 'settings', 'logs'] as Tab[]).map(t => (
                <button key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "px-4 py-2.5 text-xs font-medium border-b-2 transition-all",
                    tab === t ? "border-cyan-400 text-cyan-400" : "border-transparent text-[hsl(218_16%_48%)] hover:text-[hsl(210_30%_72%)]"
                  )}>
                  {{ overview: '概览', settings: '设置', logs: '日志' }[t]}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'overview' && (
                <div className="space-y-6">
                  {/* 状态卡片 */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: '连接状态', value: STATUS_CONFIG[selectedProvider.status].label, icon: CheckCircle2, color: STATUS_CONFIG[selectedProvider.status].color },
                      { label: '上次同步', value: selectedProvider.lastSync, icon: RefreshCw, color: 'hsl(190 90% 60%)' },
                      { label: '已用空间', value: formatBytes(selectedProvider.usedBytes), icon: HardDrive, color: 'hsl(280 70% 60%)' },
                      { label: '总空间', value: formatBytes(selectedProvider.totalBytes), icon: Database, color: 'hsl(152 72% 52%)' },
                    ].map((item, i) => {
                      const Icon = item.icon
                      return (
                        <div key={i} className="rounded-lg p-3.5"
                          style={{ background: 'hsl(218 36% 8%)', border: '1px solid hsl(218 24% 14%)' }}>
                          <Icon className="w-4 h-4 mb-2" style={{ color: item.color }} />
                          <div className="text-lg font-bold text-[hsl(210_30%_92%)]">{item.value}</div>
                          <div className="text-[10px] text-[hsl(218_16%_44%)]">{item.label}</div>
                        </div>
                      )
                    })}
                  </div>

                  {/* 使用量进度条 */}
                  {selectedProvider.totalBytes > 0 && (
                    <div className="rounded-lg p-4" style={{ background: 'hsl(218 36% 8%)', border: '1px solid hsl(218 24% 14%)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <BarChart2 className="w-3.5 h-3.5 text-[hsl(190_90%_60%)]" />
                          <span className="text-xs text-[hsl(210_30%_82%)]">存储使用量</span>
                        </div>
                        <span className="text-xs text-[hsl(218_16%_52%)]">
                          {formatBytes(selectedProvider.usedBytes)} / {formatBytes(selectedProvider.totalBytes)}
                          {' '}({((selectedProvider.usedBytes / selectedProvider.totalBytes) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[hsl(218_24%_16%)] overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${(selectedProvider.usedBytes / selectedProvider.totalBytes) * 100}%`,
                            background: 'linear-gradient(90deg, hsl(190 90% 60%), hsl(152 72% 52%))',
                          }} />
                      </div>
                    </div>
                  )}

                  {/* 快速操作 */}
                  <div>
                    <h3 className="text-xs font-semibold text-[hsl(218_16%_52%)] uppercase tracking-wider mb-3">快速操作</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: '上传文件', icon: Upload, desc: '选择文件上传到此云端' },
                        { label: '下载备份', icon: Download, desc: '从云端拉取所有数据' },
                        { label: '浏览文件', icon: Folder, desc: '查看云端文件列表' },
                        { label: '删除服务', icon: Trash2, desc: '移除此云端配置', danger: true },
                      ].map((action, i) => {
                        const Icon = action.icon
                        return (
                          <button key={i}
                            className={cn(
                              "flex items-start gap-2.5 p-3 rounded-lg text-left transition-all hover:scale-[1.01]",
                              action.danger
                                ? "hover:bg-[hsl(352_84%_14%/0.4)] border border-[hsl(352_60%_20%/0.3)] hover:border-[hsl(352_60%_30%/0.4)]"
                                : "hover:bg-[hsl(218_30%_12%)] border border-[hsl(218_24%_14%)]"
                            )}>
                            <Icon className="w-4 h-4 mt-0.5 flex-shrink-0"
                              style={{ color: action.danger ? 'hsl(352 84% 60%)' : 'hsl(190 90% 60%)' }} />
                            <div>
                              <div className="text-xs font-medium text-[hsl(210_30%_86%)]">{action.label}</div>
                              <div className="text-[10px] text-[hsl(218_16%_44%)]">{action.desc}</div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'settings' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs text-[hsl(218_16%_56%)] font-medium">服务名称</label>
                    <input className="vm-input w-full" defaultValue={selectedProvider.name} />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs text-[hsl(218_16%_56%)] font-medium">同步频率</label>
                    <select className="vm-input w-full" defaultValue="每 15 分钟">
                      <option>手动同步</option>
                      <option>每 15 分钟</option>
                      <option>每小时</option>
                      <option>实时同步</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs text-[hsl(218_16%_56%)] font-medium">同步目录过滤</label>
                    <input className="vm-input w-full" placeholder="/exclude/这个目录" />
                    <p className="text-[10px] text-[hsl(218_16%_44%)]">每行一个路径，支持 glob 模式</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="enc2" defaultChecked className="w-4 h-4" />
                    <label htmlFor="enc2" className="text-xs text-[hsl(218_16%_60%)]">端到端加密（AES-256-GCM）</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="compress" className="w-4 h-4" />
                    <label htmlFor="compress" className="text-xs text-[hsl(218_16%_60%)]">上传前 Gzip 压缩</label>
                  </div>
                  <Button variant="primary" className="w-full mt-2">保存设置</Button>
                </div>
              )}

              {tab === 'logs' && (
                <div className="space-y-2">
                  {[
                    { time: '14:32:05', type: 'info',    msg: '同步完成，共上传 12 个文件' },
                    { time: '14:31:58', type: 'info',    msg: '开始增量同步' },
                    { time: '14:28:00', type: 'success', msg: '连接测试成功，延迟 42ms' },
                    { time: '12:00:02', type: 'info',    msg: '定时同步触发' },
                    { time: '09:15:44', type: 'warn',    msg: '上传超时重试（第 1 次）' },
                    { time: '09:14:20', type: 'error',   msg: '网络中断，同步中止' },
                    { time: '08:00:00', type: 'info',    msg: '定时同步触发' },
                  ].map((log, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs py-1.5 px-2 rounded transition-colors hover:bg-[hsl(218_30%_10%)]">
                      <span className="text-[10px] font-mono text-[hsl(218_16%_40%)] flex-shrink-0 pt-px">{log.time}</span>
                      <span className={cn("flex-shrink-0 uppercase text-[9px] font-bold px-1.5 py-0.5 rounded",
                        log.type === 'error'   ? "bg-[hsl(352_60%_20%)] text-[hsl(352_84%_70%)]" :
                        log.type === 'warn'    ? "bg-[hsl(38_80%_16%)] text-[hsl(38_90%_70%)]" :
                        log.type === 'success' ? "bg-[hsl(152_50%_14%)] text-[hsl(152_72%_60%)]" :
                        "bg-[hsl(218_24%_16%)] text-[hsl(218_16%_56%)]"
                      )}>{log.type}</span>
                      <span className="text-[hsl(218_16%_64%)] leading-relaxed">{log.msg}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[hsl(218_16%_36%)] text-sm">
            选择左侧云服务以查看详情
          </div>
        )}
      </div>
    </div>
  )
}
