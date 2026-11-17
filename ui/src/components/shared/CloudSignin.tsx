import { useState } from 'react'
import { Cloud, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { vaultApi, type CloudSigninResult } from '@/lib/ipc'
import { useAppStore } from '@/store/app'
export default function CloudSignin({ binding = false }: { binding?: boolean }) {
  const refresh = useAppStore(s => s.refresh)
  const [recovery, setRecovery] = useState<CloudSigninResult | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [localPassword, setLocalPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function accept(result: CloudSigninResult) {
    if (result.needsRecovery || result.needsLocalPassword) {
      setRecovery(result)
      return
    }
    setRecovery(null); setPassphrase(''); setLocalPassword(''); setSuccess(true)
    await refresh()
  }

  async function begin() {
    setBusy(true); setError(''); setSuccess(false); setRecovery(null)
    setPassphrase(''); setLocalPassword('')
    try { await accept(await vaultApi.beginCloudSignin()) }
    catch (e) { setError(e instanceof Error ? e.message : '飞书登录未完成，请重试') }
    finally { setBusy(false) }
  }

  async function restore() {
    setBusy(true); setError('')
    try { await accept(await vaultApi.finishCloudSignin({ passphrase, localPassword })) }
    catch (e) { setError(e instanceof Error ? e.message : '旧资料恢复未完成，请重试') }
    finally { setBusy(false) }
  }

  return <section className="vm-cloud-signin" aria-label="飞书统一登录">
    <h3>{binding ? '飞书账号与自动同步' : '飞书扫码登录'}</h3>
    <p>扫码授权即可使用，无需注册、设置或记录加密口令。</p>
    {!recovery ? <Button variant="primary" className="w-full" disabled={busy} onClick={begin}>
      {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
      {busy ? '正在授权并自动登录…' : binding ? '飞书扫码绑定本账号' : '使用飞书扫码登录'}
    </Button> : <div className="space-y-3">
      <p>已授权：{recovery.name}</p>
      <p>此账号有旧版加密资料，只需恢复一次。完成后再次扫码即可进入，无需记录新口令。</p>
      {recovery.needsRecovery && <label className="vm-chat-field">原同步口令
        <input className="vm-input" aria-label="原同步口令" type="password" autoComplete="off" value={passphrase} onChange={e => setPassphrase(e.target.value)} />
      </label>}
      {recovery.needsLocalPassword && <label className="vm-chat-field">原本机密码
        <input className="vm-input" aria-label="原本机密码" type="password" autoComplete="current-password" value={localPassword} onChange={e => setLocalPassword(e.target.value)} />
      </label>}
      <Button className="w-full" variant="primary" disabled={busy || (recovery.needsRecovery && passphrase.length < 8) || (recovery.needsLocalPassword && !localPassword)} onClick={restore}>
        {busy ? '正在恢复…' : '恢复并进入'}
      </Button>
      <Button variant="ghost" disabled={busy} onClick={begin}>重新扫码</Button>
    </div>}
    {success && binding && <p role="status">已完成飞书绑定，自动同步已开启。</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </section>
}
