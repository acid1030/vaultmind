import { useState } from 'react'
import { Cloud, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { vaultApi } from '@/lib/ipc'
import { useAppStore } from '@/store/app'
export default function CloudSignin({binding=false}:{binding?:boolean}) {
 const refresh=useAppStore(s=>s.refresh)
 const [name,setName]=useState(''),[passphrase,setPassphrase]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function completeSignin(value: string) {
   const result = await vaultApi.finishCloudSignin({ passphrase: value })
   if (result.needsPassphrase) return
   if (result.needsLocalPassword) {
     setError('此窗口打开的是旧本机资料库。请在下方使用本机账号登录，或在独立资料库用飞书恢复已同步资料。')
     return
   }
   setName('')
   setPassphrase('')
   await refresh()
 }

 async function begin() {
   setBusy(true)
   setError('')
   try {
     const result = await vaultApi.beginCloudSignin()
     setName(result.name)
     await completeSignin('')
   } catch (e) {
     setError(e instanceof Error ? e.message : '飞书登录未完成')
   } finally {
     setBusy(false)
   }
 }

 async function finish() {
   setBusy(true)
   setError('')
   try {
     await completeSignin(passphrase)
   } catch (e) {
     setError(e instanceof Error ? e.message : '账号恢复未完成')
   } finally {
     setBusy(false)
   }
 }
 return <section className="vm-cloud-signin" aria-label="飞书统一登录"><h3>{binding?'绑定现有账号，开启跨设备登录':'飞书扫码登录'}</h3><p>{binding?'请先在原注册设备绑定一次，保留现有数据归属。':'无需在新设备注册，也无需填写 App ID 或 Secret。'}</p>
 {!name?<Button variant="primary" className="w-full" disabled={busy} onClick={begin}>{busy?<RefreshCw className="w-4 h-4 animate-spin"/>:<Cloud className="w-4 h-4"/>}{busy?'等待手机扫码与授权…':binding?'飞书扫码绑定本账号':'使用飞书扫码登录'}</Button>:<div className="space-y-3"><p>已授权：{name}</p>{!busy && <label className="vm-chat-field">加密口令<input className="vm-input" aria-label="云端加密口令" type="password" autoComplete="off" value={passphrase} onChange={e=>setPassphrase(e.target.value)} /></label>}<p>完成密钥托管后，其他电脑扫码即可登录。旧账号可在已解锁的设备扫码绑定，或输入原同步口令完成迁移。首次创建账号请设置加密口令。</p><Button className="w-full" variant="primary" disabled={busy||passphrase.length<8} onClick={finish}>{busy?'正在恢复账号与云盘配置…':binding?'绑定并开启同步':'解锁并进入秘栈'}</Button><Button variant="ghost" disabled={busy} onClick={()=>{setName('');setPassphrase('');setError('')}}>重新扫码</Button></div>}
 {error&&<p role="alert" className="text-destructive">{error}</p>}
 </section>
}
