import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCheck, Cloud, Copy, LockKeyhole, MessageSquare, Plus, RefreshCw, Send, UserPlus, Users, X, Camera, Image as ImageIcon, Paperclip, FileText, SlidersHorizontal, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/shared/Toast'
import { useAppStore } from '@/store/app'
import { vaultApi, type ChatHistory, type ChatMessage, type ChatRoom, type ChatDraftAttachment, type ScreenshotDelivery } from '@/lib/ipc'
import FriendsPanel from '@/components/shared/FriendsPanel'
import { cn } from '@/lib/utils'
import { mergeChatHistory, sortMessages } from '@/lib/chat-history'
import ChatAttachmentView, { chatFileSize } from '@/components/shared/ChatAttachmentView'
import ScreenshotSettings, { formatScreenshotShortcut } from '@/components/shared/ScreenshotSettings'

type Dialog = 'create' | 'join' | 'invite' | 'screenshot' | null
const messageError = (error: unknown) => error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : '操作失败，请重试'


export default function ChatView({ onOpenSync, screenshotDelivery, onScreenshotConsumed }: { onOpenSync: () => void; screenshotDelivery?: ScreenshotDelivery | null; onScreenshotConsumed?: (id: string, discard?: boolean) => Promise<void> }) {
  const { state, setContext, refresh } = useAppStore()
  const toast = useToast()
  const context = state?.context
  const [friendRoom,setFriendRoom] = useState('')
  const friend = state?.friends?.find(f=>f.groupId===friendRoom && f.status==='accepted')
  const scope = friend ? 'group' : context?.scope || 'personal'
  const groupId = friend?.groupId || (scope === 'group' ? context?.groupId || '' : '')
  const roomKey = `${state?.auth.user?.id}:${scope}:${groupId}`
  const activeRoom = useRef(roomKey)
  activeRoom.current = roomKey
  const room: ChatRoom = { scope, groupId }
  const group = state?.groups.find(g => g.id === groupId)
  const [history, setHistory] = useState<ChatHistory>({ messages: [], hasMore: false, writable: false, pending: 0 })
  const [showDetails, setShowDetails] = useState(() => window.matchMedia('(min-width: 1450px)').matches)
  const [attachmentSearch, setAttachmentSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [draftFiles, setDraftFiles] = useState<ChatDraftAttachment[]>([])
  const draftFilesRef = useRef<ChatDraftAttachment[]>([])
  const attachmentBusyRef = useRef(false)
  const [attaching, setAttaching] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [captureHint, setCaptureHint] = useState(false)
  const [screenshotShortcut, setScreenshotShortcut] = useState('CommandOrControl+Alt+A')
  const consumedDelivery = useRef('')
  const replaceDraftFiles = (files: ChatDraftAttachment[]) => { draftFilesRef.current = files; setDraftFiles(files) }
  const discardFiles = (files: ChatDraftAttachment[]) => { if (files.length) void vaultApi.discardChatAttachments({ ids: files.map(file => file.id) }).catch(() => {}) }

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [folder, setFolder] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'viewer'>('member')
  const [inviteCode, setInviteCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [olderLoading, setOlderLoading] = useState(false)
  const timeline = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const requestVersion = useRef(0)
  const newestLoaded = useRef('')

  const load = useCallback(async () => {
    const key = roomKey
    const version = ++requestVersion.current
    try {
      const next = await vaultApi.listChat({ scope, groupId })
      if (activeRoom.current !== key || requestVersion.current !== version) return
      const anchor = newestLoaded.current
      newestLoaded.current = next.messages[next.messages.length - 1]?.id || ''
      setHistory(previous => mergeChatHistory(previous, next, anchor))
      setError('')
    } catch (e) {
      if (activeRoom.current === key) setError(messageError(e))
    } finally {
      if (activeRoom.current === key) setLoading(false)
    }
  }, [roomKey, scope, groupId])

  useEffect(() => {
    setHistory({ messages: [], hasMore: false, writable: false, pending: 0 })
    setDraft('')
    replaceDraftFiles([])
    setAttaching(false)
    setDragging(false)
    newestLoaded.current = ''
    setError('')
    setLoading(true)
    setSending(false)
    setSyncing(false)
    setOlderLoading(false)
    setDialog(null)
    stickToBottom.current = true
    activeRoom.current = roomKey
    void load()
    const unsubscribe = vaultApi.onChatStatus(() => { void load() })
    return () => { activeRoom.current = ''; discardFiles(draftFilesRef.current); draftFilesRef.current = []; unsubscribe() }
  }, [load])

  useEffect(() => { vaultApi.getScreenshotShortcut().then(value => setScreenshotShortcut(value.accelerator)).catch(() => {}) }, [])
  const deliveryMatches = screenshotDelivery?.scope === scope && (scope === 'personal' || screenshotDelivery.groupId === groupId)
  useEffect(() => {
    if (!screenshotDelivery || !deliveryMatches || loading || sending || attaching || !history.writable || consumedDelivery.current === screenshotDelivery.id) return
    if (draftFilesRef.current.length + screenshotDelivery.attachments.length > 5) return
    consumedDelivery.current = screenshotDelivery.id
    replaceDraftFiles([...draftFilesRef.current, ...screenshotDelivery.attachments])
    void onScreenshotConsumed?.(screenshotDelivery.id)
  }, [screenshotDelivery, deliveryMatches, loading, sending, attaching, history.writable, draftFiles.length, onScreenshotConsumed])

  useEffect(() => {
    const preventFileNavigation = (event: DragEvent) => {
      if (Array.from(event.dataTransfer?.types || []).includes('Files')) event.preventDefault()
    }
    window.addEventListener('dragover', preventFileNavigation)
    window.addEventListener('drop', preventFileNavigation)
    return () => { window.removeEventListener('dragover', preventFileNavigation); window.removeEventListener('drop', preventFileNavigation) }
  }, [])

  useEffect(() => {
    if (stickToBottom.current && timeline.current) timeline.current.scrollTop = timeline.current.scrollHeight
  }, [history.messages])

  const send = async () => {
    if ((!draft.trim() && !draftFilesRef.current.length) || sending || attaching || !history.writable || loading) return
    const key = roomKey
    const text = draft
    setSending(true)
    try {
      const message = await vaultApi.sendChat({ ...room, text, attachmentIds: draftFilesRef.current.map(file => file.id) })
      if (activeRoom.current !== key) return
      setDraft('')
      replaceDraftFiles([])
      stickToBottom.current = true
      setHistory(previous => ({ ...previous, messages: sortMessages([...previous.messages, message]), pending: previous.pending + 1 }))
      await load()
    } catch (e) { if (activeRoom.current === key) setError(messageError(e)) }
    finally { if (activeRoom.current === key) setSending(false) }
  }

  const addFiles = async (operation: () => Promise<{ attachments: ChatDraftAttachment[] }>) => {
    if (!history.writable || loading || sending || attachmentBusyRef.current) return
    const key = roomKey
    attachmentBusyRef.current = true
    setAttaching(true)
    try {
      const result = await operation()
      if (activeRoom.current !== key) { discardFiles(result.attachments); return }
      if (draftFilesRef.current.length + result.attachments.length > 5) {
        discardFiles(result.attachments)
        throw new Error('每条消息最多 5 个附件，请先移除部分附件')
      }
      replaceDraftFiles([...draftFilesRef.current, ...result.attachments])
      setError('')
    } catch (e) { if (activeRoom.current === key) setError(messageError(e)) }
    finally { attachmentBusyRef.current = false; if (activeRoom.current === key) setAttaching(false) }
  }
  const addBrowserFiles = (files: File[]) => {
    const key = roomKey
    return addFiles(async () => {
      if (files.length > 5 || draftFilesRef.current.length + files.length > 5) throw new Error('每条消息最多 5 个附件')
      const data = []
      for (const file of files) {
        if (file.size > 12 * 1024 * 1024) throw new Error(`「${file.name}」超过 12MB，请选择较小的文件`)
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
          reader.onerror = () => reject(new Error(`无法读取「${file.name}」`))
          reader.readAsDataURL(file)
        })
        data.push({ name: file.name, base64 })
      }
      if (activeRoom.current !== key) return { attachments: [] }
      return vaultApi.stageChatData({ ...room, files: data })
    })
  }
  const capture = () => {
    if (draftFilesRef.current.length >= 5) { setError('每条消息最多 5 个附件，请先移除一个附件再截图'); return }
    return addFiles(async () => {
      setCaptureHint(true)
      try { return await vaultApi.captureChatScreenshot(room) }
      finally { setCaptureHint(false) }
    })
  }
  const annotateDraft = async (file: ChatDraftAttachment) => {
    if (!history.writable || sending || attachmentBusyRef.current) return
    const key = roomKey
    attachmentBusyRef.current = true; setAttaching(true)
    try {
      const result = await vaultApi.annotateChatDraft({ ...room, attachmentId: file.id })
      if (result.canceled) return
      if (activeRoom.current !== key || !draftFilesRef.current.some(item => item.id === file.id)) { discardFiles(result.attachments); return }
      replaceDraftFiles(draftFilesRef.current.flatMap(item => item.id === file.id ? result.attachments : [item]))
    } catch (e) { if (activeRoom.current === key) setError(messageError(e)) }
    finally { attachmentBusyRef.current = false; if (activeRoom.current === key) setAttaching(false) }
  }
  const removeDraftFile = (file: ChatDraftAttachment) => {
    discardFiles([file])
    replaceDraftFiles(draftFilesRef.current.filter(item => item.id !== file.id))
  }

  const sync = async () => {
    if (syncing) return
    const key = roomKey
    setSyncing(true)
    try {
      const result = await vaultApi.syncChat(room)
      if (activeRoom.current !== key) return
      if (result.errors.length) toast(result.errors[0], 'warning')
      else toast(`同步完成：收到 ${result.received} 条，上传 ${result.uploaded} 条`, 'success')
      await load()
    } catch (e) { if (activeRoom.current === key) { setError(messageError(e)); await load() } }
    finally { if (activeRoom.current === key) setSyncing(false) }
  }

  const loadOlder = async () => {
    const first = history.messages[0]
    if (!first || olderLoading) return
    const key = roomKey
    const element = timeline.current
    const oldHeight = element?.scrollHeight || 0
    const oldTop = element?.scrollTop || 0
    setOlderLoading(true)
    stickToBottom.current = false
    try {
      const older = await vaultApi.listChat({ ...room, before: { createdAt: first.createdAt, id: first.id } })
      if (activeRoom.current !== key) return
      setHistory(previous => previous.messages[0]?.id !== first.id ? previous : ({ ...previous, hasMore: older.hasMore, messages: sortMessages([...older.messages, ...previous.messages]) }))
      requestAnimationFrame(() => {
        if (activeRoom.current === key && element) element.scrollTop = oldTop + element.scrollHeight - oldHeight
      })
    } catch (e) { if (activeRoom.current === key) setError(messageError(e)) }
    finally { if (activeRoom.current === key) setOlderLoading(false) }
  }

  const openDialog = (next: Dialog) => {
    setDialogError('')
    setInviteCode('')
    setJoinCode('')
    setInviteEmail('')
    setGroupName('')
    setFolder('')
    setDialog(next)
  }
  const dialogAction = async () => {
    if (busy) return
    setBusy(true)
    setDialogError('')
    try {
      if (dialog === 'create') {
        if (!groupName.trim()) throw new Error('请输入群聊名称')
        if (!folder.trim() || folder.trim() === 'root') throw new Error('请填写飞书共享文件夹 Token')
        const next = await vaultApi.createGroup({ name: groupName.trim(), feishuFolderToken: folder.trim() })
        const created = next.groups.find(g => !(state?.groups || []).some(old => old.id === g.id))
        if (!created) throw new Error('未找到新建用户组，请刷新后重试')
        await refresh()
        await setContext('group', created.id)
        setDialog(null)
      } else if (dialog === 'join') {
        const next = await vaultApi.acceptChatInvite({ code: joinCode.trim() })
        await refresh()
        await setContext('group', next.groupId)
        setDialog(null)
        toast('已加入群聊；请确认已获得飞书文件夹访问权限', 'success')
      } else if (dialog === 'invite') {
        const result = await vaultApi.exportChatInvite({ groupId, email: inviteEmail.trim(), role: inviteRole })
        setInviteCode(result.code)
      }
    } catch (e) { setDialogError(messageError(e)) }
    finally { setBusy(false) }
  }

  const cloudReady = state?.isFeishuLoggedIn && (scope === 'group' ? Boolean(friend?.folderToken || (group?.feishuFolderToken && group.feishuFolderToken !== 'root')) : state?.accountSync?.linked && state.settings.hasFeishuPassphrase)
  const liveSync = Boolean(cloudReady && state?.settings.feishuAutoSync)
  useEffect(() => {
    if (!liveSync) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      if (disposed) return
      if (document.visibilityState === 'visible') {
        try { await vaultApi.syncChat({ scope, groupId }) }
        catch { /* The sync handler persists the room error and refreshes the view. */ }
      }
      if (!disposed) timer = setTimeout(poll, 5000)
    }
    void poll()
    return () => { disposed = true; clearTimeout(timer) }
  }, [liveSync, scope, groupId])

  const admin = scope === 'group' && ['owner', 'admin'].includes(group?.role || '')
  const title = friend ? friend.remark || friend.name || friend.email : scope === 'group' ? group?.name || '用户组群聊' : '个人留言'

  return (
    <div className={cn("vm-chat-layout animate-fade-in", showDetails && "vm-chat-with-details")}>
      <aside className="vm-chat-rooms glass-panel" aria-label="聊天空间">
        <div className="vm-chat-room-heading"><MessageSquare className="w-4 h-4 text-primary" /><h2>聊天空间</h2><LockKeyhole className="w-3.5 h-3.5 ml-auto text-muted-foreground" /></div>
        <button aria-label="个人留言" className={cn('vm-chat-room', scope === 'personal' && 'active')} onClick={() => {setFriendRoom('');void setContext('personal')}}>
          <span className="vm-chat-room-icon"><MessageSquare className="w-4 h-4" /></span>
          <span><strong>个人留言</strong><small>自己的设备之间共享文字</small></span>
        </button>
        <FriendsPanel selected={friendRoom} onOpen={setFriendRoom} />
        <p className="vm-chat-section-label">用户组群聊 <span>{state?.groups.length || 0}</span></p>
        <div className="vm-chat-group-list">
          {state?.groups.map(g => <button key={g.id} aria-label={g.name} className={cn('vm-chat-room', groupId === g.id && 'active')} onClick={() => {setFriendRoom('');void setContext('group', g.id)}}>
            <span className="vm-chat-room-icon"><Users className="w-4 h-4" /></span><span><strong>{g.name}</strong><small>{g.role === 'viewer' ? '只读成员' : '组内共享消息'}</small></span>
          </button>)}
          {!state?.groups.length && <p className="vm-chat-room-hint">创建用户组，或用邀请加入群聊。</p>}
        </div>
        <div className="vm-chat-room-actions">
          <Button size="sm" onClick={() => openDialog('create')}><Plus className="w-3.5 h-3.5" />新建群聊</Button>
          <Button size="sm" variant="ghost" onClick={() => openDialog('join')}><UserPlus className="w-3.5 h-3.5" />加入群聊</Button>
        </div>
        <p className="vm-chat-room-hint">记录保存在本机，加密后同步到已配置的飞书云盘。</p>
      </aside>

      <section className={cn('vm-chat-conversation glass-panel', dragging && 'vm-chat-dragging')} aria-label={title}
        onDragOver={event => { if (Array.from(event.dataTransfer.types).includes('Files')) { event.preventDefault(); if (history.writable) setDragging(true) } }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }}
        onDrop={event => { event.preventDefault(); setDragging(false); if (history.writable) void addBrowserFiles(Array.from(event.dataTransfer.files)) }}>
        {dragging && <div className="vm-chat-drop-hint"><Paperclip className="w-7 h-7" />松开发送到草稿 · 单个附件不超过 12MB</div>}
        <header className="vm-chat-header">
          <div className="min-w-0"><h2 className="truncate">{title}</h2><p>{friend ? '好友私聊 · 消息与附件加密保存' : scope === 'personal' ? '同一云端账号，多设备接续查看' : '不同用户，共享用户组的消息与附件'}</p></div>
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" aria-expanded={showDetails} onClick={() => setShowDetails(value => !value)}>会话资料</Button>
            {admin && <Button size="sm" variant="ghost" onClick={() => openDialog('invite')}><UserPlus className="w-3.5 h-3.5" />邀请成员</Button>}
            <Button size="sm" onClick={sync} disabled={syncing}><RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />{syncing ? '同步中' : '立即同步'}</Button>
          </div>
        </header>
        <div className="vm-chat-storage">
          <Cloud className="w-3.5 h-3.5 shrink-0" />
          <span>{cloudReady ? (state?.settings.feishuAutoSync ? '自动同步 · 当前会话约每 5 秒检查' : '自动同步已关闭，可手动同步') : '当前消息先存本机；配置飞书后可同步历史记录'}{history.pending > 0 ? ` · ${history.pending} 条待上传` : ''}</span>
          {!cloudReady && <button onClick={onOpenSync}>前往同步中心</button>}
        </div>
        {(error || history.lastError) && <div className="vm-chat-error" role="alert">{error || history.lastError}<span>本机已保存的消息仍可查看。</span></div>}
        <div ref={timeline} className="vm-chat-timeline" role="log" aria-label="聊天记录" aria-live="polite" onScroll={() => {
          const el = timeline.current
          if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
        }}>
          {history.hasMore && <div className="text-center mb-4"><Button size="sm" variant="ghost" onClick={loadOlder} disabled={olderLoading}>{olderLoading ? '正在加载…' : '加载更早的消息'}</Button></div>}
          {loading ? <div className="vm-chat-empty"><span className="vm-spinner" /><p>正在读取聊天记录…</p></div> : !history.messages.length ? <div className="vm-chat-empty"><span className="vm-chat-empty-icon">{scope === 'personal' ? <MessageSquare /> : <Users />}</span><h3>{scope === 'personal' ? '给其他设备留句话' : '开始组内交流'}</h3><p>{scope === 'personal' ? '发送文字、图片或文件后，其他设备加入同一云端账号即可获取。' : '消息与附件会加密同步到组的飞书共享文件夹。'}</p></div> : history.messages.map(message => <article key={message.id} className={cn('vm-chat-message', message.mine && 'mine')}>
            <div className="vm-chat-message-meta"><strong title={message.senderEmail}>{message.mine ? '我' : message.senderName}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</time></div>
            {message.text && <div className="vm-chat-bubble">{message.text}</div>}
            {Boolean(message.attachments?.length) && <div className="vm-chat-attachments">{message.attachments!.map(attachment => <ChatAttachmentView key={attachment.id} attachment={attachment} messageId={message.id} room={room} onImageLoad={() => { if (stickToBottom.current && timeline.current) timeline.current.scrollTop = timeline.current.scrollHeight }} />)}</div>}
            {message.mine && <small className="vm-chat-message-status">{message.synced ? <><CheckCheck className="w-3 h-3" />已存云端</> : '已存本机 · 待云端归档'}</small>}
          </article>)}
        </div>
        <form className="vm-chat-composer" onSubmit={event => { event.preventDefault(); void send() }}>
          <div className="vm-chat-tools">
            <Button type="button" size="icon-sm" variant="ghost" aria-label="截图" title={`截图并标注（${formatScreenshotShortcut(screenshotShortcut)}）`} disabled={!history.writable || sending || attaching || loading} onClick={capture}><Camera className="w-4 h-4" /></Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="发送图片" title="选择图片" disabled={!history.writable || sending || attaching || loading} onClick={() => addFiles(() => vaultApi.pickChatAttachments({ ...room, imagesOnly: true }))}><ImageIcon className="w-4 h-4" /></Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="发送文件" title="选择文件" disabled={!history.writable || sending || attaching || loading} onClick={() => addFiles(() => vaultApi.pickChatAttachments(room))}><Paperclip className="w-4 h-4" /></Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="截图快捷键设置" title="设置截图快捷键" onClick={() => openDialog('screenshot')}><SlidersHorizontal className="w-3.5 h-3.5" /></Button>
            <small>{attaching ? (captureHint ? '截图或标注中，Esc 取消…' : '正在处理附件…') : `${formatScreenshotShortcut(screenshotShortcut)} 截图 · 支持标注和文字`}</small>
          </div>
          {screenshotDelivery && deliveryMatches && consumedDelivery.current !== screenshotDelivery.id && <div className="vm-chat-pending-capture" role="status">截图已完成，移除部分草稿附件后会自动加入。<Button type="button" size="sm" variant="ghost" onClick={() => onScreenshotConsumed?.(screenshotDelivery.id, true)}>放弃这张截图</Button></div>}
          {draftFiles.length > 0 && <div className="vm-chat-drafts" aria-label="待发送附件">{draftFiles.map(file => <div key={file.id} className="vm-chat-draft-file">
            {file.preview ? <img src={file.preview} alt={`待发送 ${file.name}`} /> : <FileText className="w-5 h-5 shrink-0 text-primary" />}
            <span><strong title={file.name}>{file.name}</strong><small>{chatFileSize(file.size)}</small></span>
            {file.mime.startsWith('image/') && <button type="button" aria-label={`标注图片 ${file.name}`} title="标注图片" disabled={sending || attaching} onClick={() => annotateDraft(file)}><Pencil className="w-3.5 h-3.5" /></button>}
            <button type="button" aria-label={`移除附件 ${file.name}`} disabled={sending} onClick={() => removeDraftFile(file)}><X className="w-3.5 h-3.5" /></button>
          </div>)}</div>}
          <textarea aria-label="消息内容" value={draft} maxLength={20000} disabled={!history.writable || sending || loading}
            placeholder={!history.writable && !loading ? '你是只读成员，可以查看群聊记录' : '输入文字，Enter 发送，Shift + Enter 换行'}
            onChange={event => setDraft(event.target.value)} onPaste={event => {
              if (event.clipboardData.files.length) { event.preventDefault(); void addBrowserFiles(Array.from(event.clipboardData.files)) }
            }} onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() }
            }} />
          <div className="vm-chat-composer-footer"><span><LockKeyhole className="w-3 h-3" />消息与附件加密存储 <small>{draft.length}/20000</small></span><Button type="submit" variant="primary" size="sm" aria-label="发送消息" disabled={(!draft.trim() && !draftFiles.length) || !history.writable || sending || attaching || loading}><Send className="w-3.5 h-3.5" />{sending ? '保存中…' : '发送'}</Button></div>
        </form>
      </section>

      {showDetails && <aside className="glass-panel vm-chat-details" aria-label="会话资料">
        <div className="vm-section-heading"><h2>会话资料</h2><Button size="icon-sm" variant="ghost" aria-label="关闭会话资料" onClick={() => setShowDetails(false)}><X className="w-4 h-4" /></Button></div>
        <div className="vm-chat-details-body"><h3>{title}</h3><dl><div><dt>空间</dt><dd>{friend ? '好友一对一私聊' : scope === 'personal' ? '个人多端留言' : '用户组共享'}</dd></div><div><dt>权限</dt><dd>{history.writable ? '可发送消息' : '只读'}</dd></div><div><dt>本次已加载</dt><dd>{history.messages.length} 条消息{history.hasMore ? ' · 可继续加载历史' : ''}</dd></div><div><dt>等待同步</dt><dd>{history.pending} 条</dd></div>{group && <div><dt>当前角色</dt><dd>{group.role}</dd></div>}</dl>
        <Button size="sm" className="w-full" onClick={onOpenSync}>管理云端同步</Button>
        <h3 className="mt-6">共享图片与文件</h3><p className="vm-chat-help">仅显示本次已加载消息中的附件，加载更早记录可查看更多。</p>
        <input className="vm-input my-3" aria-label="搜索共享附件" placeholder="按文件名筛选" value={attachmentSearch} onChange={e => setAttachmentSearch(e.target.value)} />
        <div className="vm-shared-attachments">{history.messages.flatMap(message => (message.attachments || []).filter(file => file.name.toLowerCase().includes(attachmentSearch.toLowerCase())).map(file => <ChatAttachmentView key={`${roomKey}:${message.id}:${file.id}`} attachment={file} messageId={message.id} room={room} />))}</div>
        {!history.messages.some(message => message.attachments?.length) && <p className="vm-chat-help">当前已加载记录中暂无附件。</p>}
        </div>
      </aside>}

      {dialog && <ChatDialog title={dialog === 'create' ? '新建群聊' : dialog === 'join' ? '加入群聊' : dialog === 'screenshot' ? '截图快捷键' : '邀请成员'} busy={busy} onClose={() => setDialog(null)}>
        {dialog === 'screenshot' ? <ScreenshotSettings onSaved={value => { setScreenshotShortcut(value.accelerator); toast('截图快捷键已保存', 'success') }} /> : <form className="space-y-4" onSubmit={event => { event.preventDefault(); void dialogAction() }}>
          {dialog === 'create' && <>
            <label className="vm-chat-field">群聊名称<input autoFocus className="vm-input" aria-label="群聊名称" maxLength={100} value={groupName} onChange={e => setGroupName(e.target.value)} /></label>
            <label className="vm-chat-field">飞书共享文件夹 Token<input className="vm-input" aria-label="飞书共享文件夹 Token" value={folder} onChange={e => setFolder(e.target.value)} /></label>
            <p className="vm-chat-help">使用飞书文件夹链接中 folder/ 后的 Token。请先在飞书中为参与者授予该文件夹的读写权限；每位成员使用自己的飞书登录。</p>
          </>}
          {dialog === 'join' && <>
            <label className="vm-chat-field">粘贴群聊邀请<textarea autoFocus className="vm-input h-28" aria-label="粘贴群聊邀请" value={joinCode} onChange={e => setJoinCode(e.target.value)} /></label>
            <p className="vm-chat-help">请使用受邀邮箱或手机号登录，并确认飞书账号有该共享文件夹的访问权限。新设备加入同一个组，也需要导入邀请。</p>
          </>}
          {dialog === 'invite' && <>
            <label className="vm-chat-field">受邀账号<input autoFocus className="vm-input" aria-label="受邀账号" placeholder="邮箱或手机号" value={inviteEmail} onChange={e => { setInviteEmail(e.target.value); setInviteCode('') }} /></label>
            <label className="vm-chat-field">成员角色<select className="vm-input" value={inviteRole} onChange={e => { setInviteRole(e.target.value as 'member' | 'viewer'); setInviteCode('') }}><option value="member">成员（收发消息）</option><option value="viewer">只读（查看记录）</option></select></label>
            <p className="vm-chat-help">邀请包含群聊解密凭据，有效期 7 天，请通过可信渠道发送。仍需在飞书中授予文件夹权限；只读成员请仅授予读取权限。跨端撤销访问时，还需移除其飞书文件夹权限。</p>
            {inviteCode && <div className="space-y-2"><textarea className="vm-input h-28 text-xs" readOnly aria-label="群聊邀请码" value={inviteCode} /><Button type="button" size="sm" onClick={async () => { try { await vaultApi.copySensitiveText(inviteCode); toast('邀请已复制，剪贴板会自动清除', 'success') } catch (e) { setDialogError(messageError(e)) } }}><Copy className="w-3.5 h-3.5" />复制邀请</Button></div>}
          </>}
          {dialogError && <p className="text-sm text-destructive" role="alert">{dialogError}</p>}
          <Button type="submit" variant="primary" disabled={busy}>{busy ? '处理中…' : dialog === 'create' ? '创建群聊' : dialog === 'join' ? '加入群聊' : '生成邀请'}</Button>
        </form>}
      </ChatDialog>}
    </div>
  )
}

function ChatDialog({ title, children, onClose, busy }: { title: string; children: React.ReactNode; onClose: () => void; busy: boolean }) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) close.current()
      if (e.key !== 'Tab') return
      const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select')
      if (!elements?.length) return
      const first = elements[0], last = elements[elements.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [busy])
  return <div className="vm-chat-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose() }}><div ref={dialog} className="vm-chat-dialog glass-panel" role="dialog" aria-modal="true" aria-labelledby="chat-dialog-title"><div className="flex items-center justify-between mb-5"><h2 id="chat-dialog-title" className="font-semibold">{title}</h2><Button size="icon-sm" variant="ghost" aria-label="关闭对话框" disabled={busy} onClick={onClose}><X className="w-4 h-4" /></Button></div>{children}</div></div>
}
