import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  File, FileText, Link2, Video, Key, Upload, Cloud,
  FolderOpen, HardDrive, MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { effectiveContentKind } from '@/lib/content-kind'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import PageHero from '@/components/shared/PageHero'
import { vaultApi, type UploadProgress } from '@/lib/ipc'

type ContentMode = 'file' | 'text' | 'secret' | 'web' | 'video'

const MODES: { id: ContentMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'file', label: '文件', icon: <File className="w-4 h-4" />, desc: '导入本地或加密同步' },
  { id: 'text', label: '文本', icon: <FileText className="w-4 h-4" />, desc: '笔记、代码、文档片段' },
  { id: 'secret', label: '密钥', icon: <Key className="w-4 h-4" />, desc: 'API Key、Token、密码' },
  { id: 'web', label: '网页', icon: <Link2 className="w-4 h-4" />, desc: '书签与链接收藏' },
  { id: 'video', label: '视频', icon: <Video className="w-4 h-4" />, desc: '视频链接与播放列表' },
]

const KIND_ICONS: Record<string, React.ElementType> = {
  text: FileText, secret: Key, web: Link2, video: Video, file: File,
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString()
}

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function AddContentView() {
  const { state, uploadFiles, importFiles, createLibraryItem, scanWechatAttachments } = useAppStore()
  const toast = useToast()

  const context = state?.context || { scope: 'personal' as const, groupId: '', groupName: '' }
  const settings = state?.settings
  const items = state?.items || []
  const records = state?.records || []

  const [mode, setMode] = useState<ContentMode>('file')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [tags, setTags] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [fileDestination, setFileDestination] = useState<'local' | 'cloud'>('local')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)

  // Auto-fill passphrase from settings
  useEffect(() => {
    if (settings?.hasFeishuPassphrase) {
      setPassphrase('********')
    }
  }, [settings?.hasFeishuPassphrase])

  // Subscribe to upload progress
  useEffect(() => {
    const unsub = vaultApi.onUploadProgress((p) => setProgress(p))
    return unsub
  }, [])

  const isPersonal = context.scope === 'personal'

  const handleChooseFiles = async () => {
    const result = await vaultApi.chooseFiles()
    if (!result.canceled && result.filePaths.length > 0) {
      setSelectedFiles(result.filePaths)
    }
  }

  const handleScanWechat = async () => {
    try {
      const result = await scanWechatAttachments()
      if (result && !result.canceled && result.files && result.files.length > 0) {
        setSelectedFiles(result.files)
        toast(`已扫描 ${result.files.length} 个微信附件`, 'success')
      } else {
        toast('未找到微信附件', 'info')
      }
    } catch (err: any) {
      toast(err.message || '扫描失败', 'error')
    }
  }

  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0) {
      toast('请先选择文件', 'warning')
      return
    }
    setUploading(true)
    setProgress(null)
    const scope = { scope: context.scope, groupId: context.groupId }
    const result = fileDestination === 'local'
      ? await importFiles(selectedFiles, scope)
      : await uploadFiles(selectedFiles, passphrase, scope)
    setUploading(false)
    if (result.error) {
      toast(`${fileDestination === 'local' ? '导入' : '上传'}失败：${result.error}`, 'error')
    } else {
      let ok = 0
      if ('items' in result) ok = result.items?.length || 0
      else if ('records' in result) ok = result.records?.length || 0
      const fail = result.failures?.length || 0
      toast(`${fileDestination === 'local' ? '本机导入' : '加密上传'}完成：${ok} 成功${fail > 0 ? `，${fail} 失败` : ''}`, fail > 0 ? 'warning' : 'success')
      setSelectedFiles([])
    }
  }

  const handleCreateItem = async () => {
    const kindMap: Record<ContentMode, string> = {
      file: 'text', // shouldn't reach here
      text: 'text',
      secret: 'secret',
      web: 'web',
      video: 'video',
    }
    const kind = kindMap[mode]

    if (!title.trim()) {
      toast('请输入标题', 'warning')
      return
    }
    if ((kind === 'web' || kind === 'video') && !url.trim()) {
      toast('请输入链接', 'warning')
      return
    }
    if ((kind === 'text' || kind === 'secret') && !content.trim()) {
      toast('请输入内容', 'warning')
      return
    }

    const { error } = await createLibraryItem({
      kind,
      title: title.trim(),
      url: url.trim(),
      content: content.trim(),
      tags: tags.trim(),
      scope: context.scope,
      groupId: context.groupId,
    })

    if (error) {
      toast(`保存失败: ${error}`, 'error')
    } else {
      toast('内容已保存', 'success')
      setTitle('')
      setContent('')
      setUrl('')
      setTags('')
    }
  }

  const handleSave = () => {
    if (mode === 'file') {
      handleUploadFiles()
    } else {
      handleCreateItem()
    }
  }

  const canSave = mode === 'file'
    ? selectedFiles.length > 0 && (fileDestination === 'local' || Boolean(state?.isFeishuLoggedIn))
    : title.trim().length > 0 && (
      (mode === 'text' || mode === 'secret') ? content.trim().length > 0 : url.trim().length > 0
    )

  // Separate local items from synced records
  const localItems = items.filter(i => !i.remoteOnly)
  const cloudRecords = records

  return (
    <div className="vm-page-stack animate-fade-in">
      <PageHero
        eyebrow="安全导入"
        title="添加到 AxonMind"
        description="保存文件、笔记、密钥和链接；文件可仅导入本机，也可选择加密同步到飞书。"
        details={['五类内容', isPersonal ? '个人空间' : '团队空间', '自动索引']}
        tone="emerald"
      />
      <div className="vm-add-grid">
      {/* Left: Add Form */}
      <div className="glass-card rounded-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">添加内容</h2>
          <span className="vm-badge vm-badge-cyan text-[10px]">
            {isPersonal ? '个人空间' : context.groupName || '团队共享'}
          </span>
        </div>

        {/* Type Selection */}
        <div className="grid grid-cols-5 gap-1 mb-5 p-1 rounded-lg bg-muted"
          >
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={cn(
                "vm-content-mode flex flex-col items-center gap-1 py-2.5 px-1 rounded text-center transition-all",
                mode === m.id && "active"
              )}>
              {m.icon}
              <span className="text-[10px] font-medium">{m.label}</span>
            </button>
          ))}
        </div>

        {/* File Mode */}
        {mode === 'file' && (
          <div className="space-y-3">
            <div className="vm-destination-switch" role="radiogroup" aria-label="文件保存位置">
              <button className={cn(fileDestination === 'local' && 'active')} role="radio"
                aria-checked={fileDestination === 'local'} onClick={() => setFileDestination('local')}>
                <HardDrive className="w-4 h-4" />
                <span><strong>保存到本机</strong><small>默认选项，无需联网</small></span>
              </button>
              <button className={cn(fileDestination === 'cloud' && 'active')} role="radio"
                aria-checked={fileDestination === 'cloud'} onClick={() => setFileDestination('cloud')}>
                <Cloud className="w-4 h-4" />
                <span><strong>加密同步</strong><small>{state?.isFeishuLoggedIn ? '上传到已连接的飞书' : '需要先连接飞书'}</small></span>
              </button>
            </div>
            <button className={cn('vm-file-picker w-full border-2 border-dashed rounded-lg py-8 flex flex-col items-center gap-2 transition-all', selectedFiles.length > 0 && 'selected')}
              onClick={handleChooseFiles}>
              <FolderOpen className="w-8 h-8" />
              <span className="text-sm">
                {selectedFiles.length > 0
                  ? `已选择 ${selectedFiles.length} 个文件`
                  : '点击选择本地文件'}
              </span>
              <span className="text-xs text-muted-foreground">支持 PDF、Word、Excel、图片等，单文件最大 12 MB</span>
            </button>

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {selectedFiles.map((f, i) => (
                  <div key={i} className="vm-surface-card flex items-center gap-2 px-2.5 py-1.5 rounded">
                    <File className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                    <span className="text-[10px] text-foreground truncate flex-1">{f.split('/').pop()}</span>
                    <button onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-[hsl(218_16%_48%)] hover:text-rose-400">
                      <span className="text-[10px]">✕</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Passphrase input */}
            {fileDestination === 'cloud' && <div>
              <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">加密口令</label>
              <input className="vm-input w-full" type="password" placeholder="飞书加密口令"
                value={passphrase} onChange={e => setPassphrase(e.target.value)}
                disabled={settings?.hasFeishuPassphrase} />
              {settings?.hasFeishuPassphrase && (
                <p className="text-[10px] mt-1 text-[hsl(218_16%_40%)]">已使用已保存的加密口令</p>
              )}
              {!state?.isFeishuLoggedIn && (
                <p className="vm-field-note vm-field-note-warning">请先到“同步中心”连接飞书，再选择加密同步。</p>
              )}
            </div>}

            {/* Upload Progress */}
            {fileDestination === 'cloud' && progress && uploading && (
              <div className="vm-surface-card rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[hsl(210_30%_82%)]">
                    {progress.phase === 'complete' ? '完成' : `上传中: ${progress.current}`}
                  </span>
                  <span className="text-[hsl(218_16%_44%)]">
                    {progress.completed}/{progress.total}
                    {progress.failed > 0 && ` (失败 ${progress.failed})`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all"
                    style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }} />
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full" onClick={handleScanWechat}>
              <MessageSquare className="w-3.5 h-3.5" />
              扫描微信附件
            </Button>
          </div>
        )}

        {/* Text/Secret/Web/Video Mode */}
        {mode !== 'file' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">标题</label>
              <input className="vm-input" placeholder="内容标题"
                value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            {(mode === 'web' || mode === 'video') && (
              <div>
                <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">链接</label>
                <input className="vm-input" placeholder="https://..."
                  value={url} onChange={e => setUrl(e.target.value)} />
              </div>
            )}
            {(mode === 'text' || mode === 'secret') && (
              <div>
                <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">
                  {mode === 'secret' ? '密钥内容（加密存储）' : '内容'}
                </label>
                <textarea className="vm-textarea"
                  placeholder={mode === 'secret' ? 'sk-... 或 -----BEGIN RSA PRIVATE KEY-----...' : '文本、笔记或备注'}
                  value={content} onChange={e => setContent(e.target.value)} />
              </div>
            )}
            <div>
              <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">标签（逗号分隔）</label>
              <input className="vm-input" placeholder="api, config, important"
                value={tags} onChange={e => setTags(e.target.value)} />
            </div>
          </div>
        )}

        <Button variant="primary" className="w-full mt-4"
          onClick={handleSave} disabled={!canSave || uploading}>
          <Upload className="w-4 h-4" />
          {mode === 'file' ? (fileDestination === 'local' ? '导入到本机' : '加密上传') : '保存内容'}
        </Button>
      </div>

      {/* Right: History */}
      <div className="glass-card rounded-md overflow-hidden">
        <div className="px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold text-foreground">添加历史</h2>
        </div>

        <div className="grid grid-cols-2 gap-px p-4 bg-muted"
          >
          {/* Local Content Column */}
          <div className="space-y-2 pr-3" style={{ borderRight: '1px solid var(--border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-3 text-[hsl(218_16%_44%)]">
              本地内容 ({localItems.length})
            </p>
            {localItems.length === 0 && (
              <div className="py-6 text-center">
                <FileText className="w-6 h-6 mx-auto mb-1 text-[hsl(218_16%_30%)]" />
                <p className="text-[10px] text-[hsl(218_16%_36%)]">暂无本地内容</p>
              </div>
            )}
            {localItems.map(item => {
              const KindIcon = KIND_ICONS[effectiveContentKind(item)] || FileText
              return (
                <div key={item.id} className="vm-hover-row flex items-start gap-2.5 p-2.5 rounded cursor-pointer">
                  <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(190 60% 16% / 0.5)', border: '1px solid hsl(190 60% 24% / 0.3)', color: 'hsl(190 90% 68%)' }}>
                    <KindIcon className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-foreground">{item.title || item.name}</p>
                    <p className="text-[10px] mt-0.5 text-[hsl(218_16%_44%)]">
                      {formatTime(item.downloadedAt || '')} · {formatSize(item.size)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Cloud Sync Column */}
          <div className="space-y-2 pl-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-3 text-[hsl(218_16%_44%)]">
              飞书同步 ({cloudRecords.length})
            </p>
            {cloudRecords.length === 0 && (
              <div className="py-6 text-center">
                <Cloud className="w-6 h-6 mx-auto mb-1 text-[hsl(218_16%_30%)]" />
                <p className="text-[10px] text-[hsl(218_16%_36%)]">暂无同步记录</p>
              </div>
            )}
            {cloudRecords.map(rec => (
              <div key={rec.id} className="vm-hover-row flex items-start gap-2.5 p-2.5 rounded cursor-pointer">
                <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: 'hsl(43 60% 18% / 0.5)', border: '1px solid hsl(43 60% 28% / 0.3)', color: 'hsl(43 90% 68%)' }}>
                  <Cloud className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate text-foreground">{rec.fileName}</p>
                  <p className="text-[10px] mt-0.5 text-[hsl(218_16%_44%)]">
                    {formatTime(rec.uploadedAt)} · {formatSize(rec.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
