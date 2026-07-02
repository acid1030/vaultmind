import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, Plus, Shield, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

// 模拟 TOTP 6位码生成（真实场景用 otpauth 库）
function mockTotp(seed: number): string {
  const t = Math.floor(Date.now() / 30000) + seed
  return String((t * 6364136223846793005 + 1442695040888963407) >>> 0).slice(-6).padStart(6, '0')
}

const MOCK_TOTP = [
  { id: 't1', name: 'GitHub', icon: '⚡', issuer: 'github.com', seed: 1 },
  { id: 't2', name: 'AWS Console', icon: '☁️', issuer: 'aws.amazon.com', seed: 2 },
  { id: 't3', name: 'Aliyun', icon: '🔶', issuer: 'aliyun.com', seed: 3 },
  { id: 't4', name: 'Google Workspace', icon: '🔵', issuer: 'google.com', seed: 4 },
]

export default function TotpCard() {
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [remaining, setRemaining] = useState(30)
  const [copied, setCopied] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newSecret, setNewSecret] = useState('')
  const [newName, setNewName] = useState('')

  useEffect(() => {
    const update = () => {
      const rem = 30 - (Math.floor(Date.now() / 1000) % 30)
      setRemaining(rem)
      const newCodes: Record<string, string> = {}
      for (const t of MOCK_TOTP) newCodes[t.id] = mockTotp(t.seed)
      setCodes(newCodes)
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  const copy = (id: string, code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const progress = (remaining / 30) * 100
  const urgent = remaining <= 5

  return (
    <div className="space-y-3">
      {/* 全局倒计时 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: urgent ? 'hsl(352 80% 60%)' : 'hsl(190 90% 60%)' }} />
          <span className="text-xs font-medium" style={{ color: urgent ? 'hsl(352 80% 68%)' : 'hsl(218 16% 56%)' }}>
            {remaining}秒后刷新
          </span>
        </div>
        <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: 'hsl(218 28% 14%)' }}>
          <div className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${progress}%`,
              background: urgent ? 'hsl(352 80% 58%)' : 'linear-gradient(90deg, hsl(190 90% 60%), hsl(152 72% 52%))',
            }} />
        </div>
      </div>

      {/* TOTP 列表 */}
      {MOCK_TOTP.map(t => {
        const code = codes[t.id] || '------'
        const isCopied = copied === t.id
        return (
          <div key={t.id}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all"
            style={{
              background: 'hsl(218 30% 9%)',
              border: '1px solid hsl(218 24% 14%)',
            }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'hsl(218 28% 14%)', border: '1px solid hsl(218 24% 18%)' }}>
              {t.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'hsl(210 30% 90%)' }}>{t.name}</p>
              <p className="text-[10px]" style={{ color: 'hsl(218 16% 42%)' }}>{t.issuer}</p>
            </div>
            {/* 验证码 */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-bold tracking-[0.22em]"
                style={{ color: urgent ? 'hsl(352 80% 65%)' : 'hsl(190 90% 68%)' }}>
                {code.slice(0, 3)} {code.slice(3)}
              </span>
              <Button variant="ghost" size="icon-sm" onClick={() => copy(t.id, code)}>
                {isCopied
                  ? <Check className="w-3.5 h-3.5" style={{ color: 'hsl(152 72% 55%)' }} />
                  : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        )
      })}

      {/* 添加新 TOTP */}
      <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAdd(!showAdd)}>
        <Plus className="w-3.5 h-3.5" />
        添加两步验证
      </Button>

      {showAdd && (
        <div className="p-4 rounded-xl space-y-3 animate-fade-in"
          style={{ background: 'hsl(218 36% 8%)', border: '1px solid hsl(218 24% 15%)' }}>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>服务名称</label>
            <input className="vm-input" placeholder="GitHub / AWS / ..." value={newName} onChange={e => setNewName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>TOTP Secret</label>
            <input className="vm-input font-mono" placeholder="Base32 密钥，例如：JBSWY3DPEHPK3PXP" value={newSecret} onChange={e => setNewSecret(e.target.value)} />
          </div>
          <p className="text-xs" style={{ color: 'hsl(218 16% 42%)' }}>
            <Shield className="w-3 h-3 inline mr-1" />
            密钥加密存储在本机，不上传至任何服务器
          </p>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" className="flex-1">确认添加</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>取消</Button>
          </div>
        </div>
      )}
    </div>
  )
}
