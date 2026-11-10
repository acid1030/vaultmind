import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileText, Image as ImageIcon, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { vaultApi, type ChatAttachment, type ChatRoom } from '@/lib/ipc'
import { useToast } from './Toast'

export function chatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
const errorText = (error: unknown) => error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : '附件暂时不可用'

export default function ChatAttachmentView({ attachment, messageId, room, onImageLoad }: { attachment: ChatAttachment; messageId: string; room: ChatRoom; onImageLoad?: () => void }) {
  const toast = useToast()
  const element = useRef<HTMLDivElement>(null)
  const [thumbnail, setThumbnail] = useState('')
  const [fullImage, setFullImage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [opening, setOpening] = useState(false)
  const request = useRef(0)
  const image = attachment.mime.startsWith('image/')
  const { scope, groupId } = room
  const loadThumbnail = useCallback(async () => {
    const version = ++request.current
    setLoading(true)
    setError('')
    try {
      const result = await vaultApi.getChatAttachment({ scope, groupId, messageId, attachmentId: attachment.id, thumbnail: true })
      if (request.current === version) setThumbnail(result.preview)
    } catch (e) { if (request.current === version) setError(errorText(e)) }
    finally { if (request.current === version) setLoading(false) }
  }, [scope, groupId, messageId, attachment.id, attachment.fileToken])
  useEffect(() => {
    setThumbnail('')
    setFullImage('')
    setError('')
    if (!image || !element.current) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void loadThumbnail() }
    })
    observer.observe(element.current)
    return () => { observer.disconnect(); request.current++ }
  }, [loadThumbnail, image])
  useEffect(() => {
    if (!fullImage) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setFullImage('') }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [fullImage])
  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const result = await vaultApi.saveChatAttachment({ scope, groupId, messageId, attachmentId: attachment.id })
      if (!result.canceled) toast('附件已保存', 'success')
    } catch (e) { toast(errorText(e), 'error') }
    finally { setSaving(false) }
  }
  const open = async () => {
    if (opening) return
    setOpening(true)
    try { const result = await vaultApi.getChatAttachment({ scope, groupId, messageId, attachmentId: attachment.id }); setFullImage(result.preview) }
    catch (e) { setError(errorText(e)) }
    finally { setOpening(false) }
  }
  return <div ref={element} className="vm-chat-attachment">
    {image && <div className="vm-chat-image-area">
      {thumbnail ? <button type="button" aria-label={`预览图片 ${attachment.name}`} onClick={open} disabled={opening}><img src={thumbnail} alt={attachment.name} loading="lazy" onLoad={onImageLoad} />{opening && <span className="vm-chat-image-loading">加载原图…</span>}</button>
        : <div className="vm-chat-image-placeholder"><ImageIcon className="w-7 h-7" /><span>{loading ? '正在获取图片…' : '图片预览'}</span>{error && <Button size="sm" variant="ghost" onClick={loadThumbnail}><RefreshCw className="w-3 h-3" />重试预览</Button>}</div>}
    </div>}
    <div className="vm-chat-file-row"><span className="vm-chat-file-icon">{image ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-5 h-5" />}</span><span className="min-w-0 flex-1"><strong title={attachment.name}>{attachment.name}</strong><small>{chatFileSize(attachment.size)}{image ? ' · 图片' : ' · 文件'}</small></span><Button type="button" variant="ghost" size="icon-sm" aria-label={`保存 ${attachment.name}`} title="保存到本地" disabled={saving} onClick={save}><Download className="w-4 h-4" /></Button></div>
    {error && <p className="vm-chat-attachment-error">{error}</p>}
    {fullImage && createPortal(<div className="vm-chat-image-overlay" role="dialog" aria-modal="true" aria-label={`图片预览 ${attachment.name}`} onClick={() => setFullImage('')}><Button autoFocus type="button" variant="default" size="icon" className="vm-chat-image-close" aria-label="关闭图片预览" onClick={() => setFullImage('')}><X className="w-5 h-5" /></Button><img src={fullImage} alt={attachment.name} onClick={event => event.stopPropagation()} /></div>, document.body)}
  </div>
}
