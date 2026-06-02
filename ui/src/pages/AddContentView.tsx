import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  File, FileText, Link2, Video, Key, Upload, Cloud,
  CheckCircle, FolderOpen, MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ContentMode = 'file' | 'text' | 'key' | 'link' | 'video'

const MODES: { id: ContentMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'file', label: '文件', icon: <File className="w-4 h-4" />, desc: '上传本地文件，加密存储' },
  { id: 'text', label: '文本', icon: <FileText className="w-4 h-4" />, desc: '笔记、代码、文档片段' },
  { id: 'key', label: '密钥', icon: <Key className="w-4 h-4" />, desc: 'API Key、Token、密码' },
  { id: 'link', label: '网页', icon: <Link2 className="w-4 h-4" />, desc: '书签与链接收藏' },
  { id: 'video', label: '视频', icon: <Video className="w-4 h-4" />, desc: '视频链接与播放列表' },
]

const MOCK_HISTORY_LOCAL = [
  { title: 'server-key.pem', type: 'file', time: '5分钟前', size: '2.3 KB' },
  { title: 'API 接口文档 v2', type: 'text', time: '1小时前', size: '4.1 KB' },
  { title: 'Database Password', type: 'key', time: '2小时前', size: '128 B' },
]

const MOCK_HISTORY_CLOUD = [
  { title: 'backup-keys.axonvault', type: 'file', time: '昨天', size: '18 KB' },
  { title: 'team-secrets.axonvault', type: 'file', time: '2天前', size: '5.4 KB' },
]

interface AddContentViewProps {
  context: string
}

export default function AddContentView({ context }: AddContentViewProps) {
  const [mode, setMode] = useState<ContentMode>('file')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [saveLocal, setSaveLocal] = useState(true)
  const [syncFeishu, setSyncFeishu] = useState(false)
  const [syncManifest, setSyncManifest] = useState(false)

  const isPersonal = context === 'personal'

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(440px, 0.82fr) minmax(600px, 1.18fr)', alignItems: 'start' }}>
      {/* 左栏：添加表单 */}
      <div className="glass-card rounded-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'hsl(210 30% 90%)' }}>添加内容</h2>
          <span className="vm-badge vm-badge-cyan text-[10px]">
            {isPersonal ? '个人空间' : '团队共享'}
          </span>
        </div>

        {/* 类型选择 */}
        <div className="grid grid-cols-5 gap-1 mb-5 p-1 rounded-lg"
          style={{ background: 'hsl(218 36% 7%)' }}>
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

        {/* 文件模式 */}
        {mode === 'file' && (
          <div className="space-y-3">
            <button className="w-full border-2 border-dashed rounded-lg py-8 flex flex-col items-center gap-2 transition-all hover:border-[hsl(190_60%_34%)]"
              style={{
                borderColor: 'hsl(218 24% 18%)',
                background: 'hsl(218 36% 7%)',
                color: 'hsl(218 16% 46%)',
              }}>
              <FolderOpen className="w-8 h-8" style={{ color: 'hsl(218 24% 32%)' }} />
              <span className="text-sm">点击选择文件，或拖拽到此处</span>
              <span className="text-xs" style={{ color: 'hsl(218 16% 38%)' }}>支持 PDF、Word、Excel、图片等，单文件最大 12 MB</span>
            </button>
            <Button variant="outline" size="sm" className="w-full">
              <MessageSquare className="w-3.5 h-3.5" />
              扫描微信附件
            </Button>
          </div>
        )}

        {/* 文本/密钥/链接/视频模式 */}
        {mode !== 'file' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 50%)' }}>标题</label>
              <input className="vm-input" placeholder="内容标题"
                value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            {(mode === 'link' || mode === 'video') && (
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 50%)' }}>链接</label>
                <input className="vm-input" placeholder="https://..."
                  value={url} onChange={e => setUrl(e.target.value)} />
              </div>
            )}
            {(mode === 'text' || mode === 'key') && (
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 50%)' }}>
                  {mode === 'key' ? '密钥内容（加密存储）' : '内容'}
                </label>
                <textarea className="vm-textarea"
                  placeholder={mode === 'key' ? 'sk-... 或 -----BEGIN RSA PRIVATE KEY-----...' : '文本、笔记或备注'}
                  value={content} onChange={e => setContent(e.target.value)} />
              </div>
            )}
          </div>
        )}

        {/* 同步选项 */}
        <div className="mt-4 p-3 rounded-lg space-y-2.5"
          style={{ background: 'hsl(218 36% 7%)', border: '1px solid hsl(218 24% 14%)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'hsl(218 16% 52%)' }}>同步选项</p>
          {[
            { id: 'local', label: '保存到本地内容库', checked: saveLocal, set: setSaveLocal },
            { id: 'feishu', label: '同步到飞书云盘（加密上传）', checked: syncFeishu, set: setSyncFeishu },
          ].map(opt => (
            <label key={opt.id} className="flex items-center gap-2.5 cursor-pointer">
              <div className={cn("w-4 h-4 rounded flex items-center justify-center transition-all border",
                opt.checked ? "border-transparent" : "border-[hsl(218_24%_22%)]")}
                style={opt.checked ? { background: 'linear-gradient(135deg, hsl(190 90% 60%), hsl(152 72% 52%))' } : { background: 'hsl(218 36% 9%)' }}
                onClick={() => opt.set(!opt.checked)}>
                {opt.checked && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
              <span className="text-xs" style={{ color: 'hsl(218 16% 58%)' }}>{opt.label}</span>
            </label>
          ))}
          {syncFeishu && (
            <label className="flex items-center gap-2.5 cursor-pointer ml-6">
              <div className={cn("w-4 h-4 rounded flex items-center justify-center transition-all border",
                syncManifest ? "border-transparent" : "border-[hsl(218_24%_22%)]")}
                style={syncManifest ? { background: 'hsl(190 90% 60%)' } : { background: 'hsl(218 36% 9%)' }}
                onClick={() => setSyncManifest(!syncManifest)}>
                {syncManifest && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
              <span className="text-xs" style={{ color: 'hsl(218 16% 50%)' }}>同时更新飞书目录清单</span>
            </label>
          )}
        </div>

        <Button variant="success" className="w-full mt-4">
          <Upload className="w-4 h-4" />
          保存
        </Button>

        {/* 飞书清单维护 */}
        <details className="mt-3">
          <summary className="cursor-pointer text-xs"
            style={{ color: 'hsl(218 16% 44%)' }}>
            飞书清单维护（可选）
          </summary>
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm">
                <Cloud className="w-3.5 h-3.5" />
                从飞书拉取
              </Button>
              <Button variant="outline" size="sm">
                <Upload className="w-3.5 h-3.5" />
                上传清单
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="w-full">
              完整同步（拉取→合并→上传）
            </Button>
          </div>
        </details>
      </div>

      {/* 右栏：添加历史 */}
      <div className="glass-card rounded-md overflow-hidden">
        <div className="px-4 py-3"
          style={{ borderBottom: '1px solid hsl(218 24% 14%)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'hsl(210 30% 90%)' }}>添加历史</h2>
        </div>

        <div className="grid grid-cols-2 gap-px p-4"
          style={{ background: 'hsl(218 36% 8%)' }}>
          {/* 本地内容列 */}
          <div className="space-y-2 pr-3" style={{ borderRight: '1px solid hsl(218 24% 13%)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-3"
              style={{ color: 'hsl(218 16% 44%)' }}>
              本地内容
            </p>
            {MOCK_HISTORY_LOCAL.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded transition-colors cursor-pointer"
                onMouseEnter={e => (e.currentTarget.style.background = 'hsl(218 28% 11%)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: 'hsl(190 60% 16% / 0.5)', border: '1px solid hsl(190 60% 24% / 0.3)', color: 'hsl(190 90% 68%)' }}>
                  {item.type === 'key' ? <Key className="w-3 h-3" />
                    : item.type === 'text' ? <FileText className="w-3 h-3" />
                    : <File className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'hsl(210 30% 88%)' }}>{item.title}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'hsl(218 16% 44%)' }}>{item.time} · {item.size}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 飞书同步列 */}
          <div className="space-y-2 pl-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-3"
              style={{ color: 'hsl(218 16% 44%)' }}>
              飞书同步
            </p>
            {MOCK_HISTORY_CLOUD.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded transition-colors cursor-pointer"
                onMouseEnter={e => (e.currentTarget.style.background = 'hsl(218 28% 11%)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: 'hsl(43 60% 18% / 0.5)', border: '1px solid hsl(43 60% 28% / 0.3)', color: 'hsl(43 90% 68%)' }}>
                  <Cloud className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'hsl(210 30% 88%)' }}>{item.title}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'hsl(218 16% 44%)' }}>{item.time} · {item.size}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
