import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { vaultApi, type ScreenshotShortcutState } from '@/lib/ipc'
const DEFAULT_SHORTCUT = 'CommandOrControl+Alt+A'
export function formatScreenshotShortcut(value: string) {
  const mac = /Mac/i.test(navigator.platform)
  return value.replace(/CommandOrControl/g, mac ? '⌘' : 'Ctrl').replace(/Command/g, '⌘').replace(/Control/g, 'Ctrl').replace(/Alt/g, mac ? '⌥' : 'Alt').replace(/Shift/g, mac ? '⇧' : 'Shift')
}
export default function ScreenshotSettings({ onSaved }: { onSaved: (state: ScreenshotShortcutState) => void }) {
  const [current, setCurrent] = useState<ScreenshotShortcutState | null>(null)
  const [draft, setDraft] = useState(DEFAULT_SHORTCUT)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let active = true
    vaultApi.getScreenshotShortcut().then(value => { if (active) { setCurrent(value); setDraft(value.accelerator) } }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [])
  const record = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault(); event.stopPropagation()
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key) || event.nativeEvent.isComposing) return
    if (!event.metaKey && !event.ctrlKey && !event.altKey) { setError('请同时按住 Command、Ctrl 或 Alt，再按一个字母或功能键'); return }
    const key = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3) : /^Digit[0-9]$/.test(event.code) ? event.code.slice(5) : /^F\d+$/.test(event.code) ? event.code : event.code === 'Space' ? 'Space' : ''
    if (!key) { setError('请选择字母、数字或 F1–F24 功能键'); return }
    setDraft([event.metaKey && 'Command', event.ctrlKey && 'Control', event.altKey && 'Alt', event.shiftKey && 'Shift', key].filter(Boolean).join('+'))
    setError('')
  }
  const save = async () => {
    setSaving(true); setError('')
    try { const value = await vaultApi.setScreenshotShortcut({ accelerator: draft }); setCurrent(value); onSaved(value) }
    catch (e: any) { setError(e.message?.replace(/^Error invoking remote method '[^']+': Error: /, '') || '快捷键保存失败') }
    finally { setSaving(false) }
  }
  return <div className="space-y-4">
    <p className="vm-chat-help">应用运行且本地账号已解锁时，在其他应用里也能唤起截图。选区后可画框、画箭头、涂画、添加文字和马赛克；完成后加入当前聊天草稿。</p>
    <label className="vm-chat-field">截图快捷键<input className="vm-input" aria-label="截图快捷键" readOnly value={formatScreenshotShortcut(draft)} onKeyDown={record} onFocus={() => setError('')} /></label>
    <p className="vm-chat-help">点击输入框，直接按下想使用的组合键。当前绑定：{current ? formatScreenshotShortcut(current.accelerator) : '读取中…'}{current?.registered ? '（已注册）' : '（未注册）'}。</p>
    {(error || current?.error) && <p className="text-sm text-destructive" role="alert">{error || current?.error}</p>}
    <div className="flex gap-2"><Button variant="primary" onClick={save} disabled={saving || !current}>{saving ? '保存中…' : '保存快捷键'}</Button><Button onClick={() => { setDraft(DEFAULT_SHORTCUT); setError('') }} disabled={saving}>使用默认组合键</Button></div>
    <p className="vm-chat-help">若被系统或其他应用占用，保存会失败，原来可用的快捷键继续生效。macOS 首次截图仍需要系统的屏幕录制权限；图片标注本身不需要录屏权限。</p>
  </div>
}
