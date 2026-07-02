import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  File, FileText, Link2, Video, Key, Upload, Cloud,
  CheckCircle, FolderOpen, MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import { vaultApi, type UploadProgress } from '@/lib/ipc'

type ContentMode = 'file' | 'text' | 'secret' | 'web' | 'video'

const MODES: { id: ContentMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'file', label: '文件', icon: <File className="w-4 h-4" />, desc: '上传本地文件，加密存储' },
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
  const { state, uploadFiles, createLibraryItem, scanWechatAttachments } = useAppStore()
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
    const result = await uploadFiles(selectedFiles, passphrase, {
      scope: context.scope,
      groupId: context.groupId,
    })
    setUploading(false)
    if (result.error) {
      toast(`上传失败: ${result.error}`, 'error')
    } else {
      const ok = result.records?.length || 0
      const fail = result.failures?.length || 0
      toast(`上传完成: ${ok} 成功${fail > 0 ? `, ${fail} 失败` : ''}`, fail > 0 ? 'warning' : 'success')
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
    ? selectedFiles.length > 0
    : title.trim().length > 0

  // Separate local items from synced records
  const localItems = items.filter(i => !i.remoteOnly)
  const cloudRecords = records

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(440px, 0.82fr) minmax(600px, 1.18fr)', alignItems: 'start' }}>
      {/* Left: Add Form */}
      <div className="glass-card rounded-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[hsl(210_30%_90%)]">添加内容</h2>
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
                "flex flex-col items-center gap-1 py-2.5 px-1 rounded text-center transition-all",
                mode === m.id
                  ? "shadow-[0_1px_8px_hsl(218_42%_2%/0.4)]"
                  : "hover:bg-[hsl(218_28%_12%)]"
              )}
              style={mode === m.id ? {
                background: 'hsl(218 32% 12%)',
                color: 'hsl(190 90% 72%)',
                border: '1px solid hsl(190 60% 24% / 0.35)',
              } : { color: 'hsl(218 16% 50%)' }}>
              {m.icon}
              <span className="text-[10px] font-medium">{m.label}</span>
            </button>
          ))}
        </div>

        {/* File Mode */}
        {mode === 'file' && (
          <div className="space-y-3">
            <button className="w-full border-2 border-dashed rounded-lg py-8 flex flex-col items-center gap-2 transition-all hover:border-[hsl(190_60%_34%)]"
              style={{
                borderColor: selectedFiles.length > 0 ? 'hsl(190 60% 28%)' : 'hsl(218 24% 18%)',
                background: 'hsl(218 36% 7%)',
                color: 'hsl(218 16% 46%)',
              }}
              onClick={handleChooseFiles}>
              <FolderOpen className="w-8 h-8" style={{ color: selectedFiles.length > 0 ? 'hsl(190 90% 60%)' : 'hsl(218 24% 32%)' }} />
              <span className="text-sm">
                {selectedFiles.length > 0
                  ? `已选择 ${selectedFiles.length} 个文件`
                  : '点击选择文件，或拖拽到此处'}
              </span>
              <span className="text-xs text-[hsl(218_16%_38%)]">支持 PDF、Word、Excel、图片等，单文件最大 12 MB</span>
            </button>

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {selectedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-[hsl(218_36%_8%)] border border-[hsl(218_24%_12%)]">
                    <File className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                    <span className="text-[10px] text-[hsl(210_30%_82%)] truncate flex-1">{f.split('/').pop()}</span>
                    <button onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-[hsl(218_16%_48%)] hover:text-rose-400">
                      <span className="text-[10px]">✕</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Passphrase input */}
            <div>
              <label className="block text-xs mb-1.5 text-[hsl(218_16%_50%)]">加密口令</label>
              <input className="vm-input w-full" type="password" placeholder="飞书加密口令"
                value={passphrase} onChange={e => setPassphrase(e.target.value)}
                disabled={settings?.hasFeishuPassphrase} />
              {settings?.hasFeishuPassphrase && (
                <p className="text-[10px] mt-1 text-[hsl(218_16%_40%)]">已使用已保存的加密口令</p>
              )}
            </div>

            {/* Upload Progress */}
            {progress && uploading && (
              <div className="rounded-lg p-3 space-y-2"
                style={{ background: 'hsl(218 36% 8%)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[hsl(210_30%_82%)]">
                    {progress.phase === 'complete' ? '完成' : `上传中: ${progress.current}`}
                  </span>
                  <span className="text-[hsl(218_16%_44%)]">
                    {progress.completed}/{progress.total}
                    {progress.failed > 0 && ` (失败 ${progress.failed})`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[hsl(218_24%_14%)] overflow-hidden">
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

        <Button variant="success" className="w-full mt-4"
          onClick={handleSave} disabled={!canSave || uploading}>
          <Upload className="w-4 h-4" />
          {mode === 'file' ? '上传' : '保存'}
        </Button>
      </div>

      {/* Right: History */}
      <div className="glass-card rounded-md overflow-hidden">
        <div className="px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold text-[hsl(210_30%_90%)]">添加历史</h2>
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
              const KindIcon = KIND_ICONS[item.kind] || FileText
              return (
                <div key={item.id} className="flex items-start gap-2.5 p-2.5 rounded transition-colors cursor-pointer hover:bg-[hsl(218_28%_11%)]">
                  <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(190 60% 16% / 0.5)', border: '1px solid hsl(190 60% 24% / 0.3)', color: 'hsl(190 90% 68%)' }}>
                    <KindIcon className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-[hsl(210_30%_88%)]">{item.title || item.name}</p>
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
              <div key={rec.id} className="flex items-start gap-2.5 p-2.5 rounded transition-colors cursor-pointer hover:bg-[hsl(218_28%_11%)]">
                <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: 'hsl(43 60% 18% / 0.5)', border: '1px solid hsl(43 60% 28% / 0.3)', color: 'hsl(43 90% 68%)' }}>
                  <Cloud className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate text-[hsl(210_30%_88%)]">{rec.fileName}</p>
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
  )
}
