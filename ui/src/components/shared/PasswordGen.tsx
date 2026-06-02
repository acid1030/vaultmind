import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Copy, Check, Sliders } from 'lucide-react'
import { cn } from '@/lib/utils'

function generatePassword(length: number, opts: {
  upper: boolean; lower: boolean; number: boolean; special: boolean
}): string {
  const sets = [
    opts.upper ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '',
    opts.lower ? 'abcdefghijklmnopqrstuvwxyz' : '',
    opts.number ? '0123456789' : '',
    opts.special ? '!@#$%^&*()_+-=[]{}|;:,.<>?' : '',
  ].filter(Boolean)
  if (!sets.length) return ''
  const chars = sets.join('')
  let pwd = ''
  // guarantee at least one from each set
  for (const s of sets) pwd += s[Math.floor(Math.random() * s.length)]
  while (pwd.length < length) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd.split('').sort(() => Math.random() - 0.5).join('')
}

function passwordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: '无', color: 'hsl(218 16% 30%)' }
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (pwd.length >= 16) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[a-z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  if (score <= 2) return { score, label: '弱', color: 'hsl(352 80% 58%)' }
  if (score <= 4) return { score, label: '中', color: 'hsl(43 90% 58%)' }
  if (score <= 6) return { score, label: '强', color: 'hsl(152 72% 52%)' }
  return { score, label: '极强', color: 'hsl(190 90% 58%)' }
}

interface PasswordGenProps {
  onUse?: (pwd: string) => void
}

export default function PasswordGen({ onUse }: PasswordGenProps) {
  const [length, setLength] = useState(16)
  const [opts, setOpts] = useState({ upper: true, lower: true, number: true, special: true })
  const [password, setPassword] = useState(() => generatePassword(16, { upper: true, lower: true, number: true, special: true }))
  const [copied, setCopied] = useState(false)

  const generate = useCallback(() => {
    setPassword(generatePassword(length, opts))
  }, [length, opts])

  const copy = () => {
    navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const strength = passwordStrength(password)

  return (
    <div className="rounded-xl p-4 space-y-4"
      style={{ background: 'hsl(218 36% 7%)', border: '1px solid hsl(218 24% 14%)' }}>
      <div className="flex items-center gap-2">
        <Sliders className="w-4 h-4" style={{ color: 'hsl(190 90% 60%)' }} />
        <span className="text-sm font-semibold" style={{ color: 'hsl(210 30% 88%)' }}>密码生成器</span>
      </div>

      {/* 生成结果 */}
      <div className="relative">
        <div className="px-4 py-3 rounded-lg font-mono text-sm break-all pr-24 select-all"
          style={{
            background: 'hsl(218 40% 5%)',
            border: '1px solid hsl(218 24% 16%)',
            color: 'hsl(152 72% 62%)',
            minHeight: 48,
          }}>
          {password || '—'}
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1.5">
          <Button variant="ghost" size="icon-sm" onClick={generate} title="重新生成">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={copy} title="复制">
            {copied ? <Check className="w-3.5 h-3.5" style={{ color: 'hsl(152 72% 58%)' }} /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* 强度条 */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs" style={{ color: 'hsl(218 16% 48%)' }}>
          <span>密码强度</span>
          <span style={{ color: strength.color, fontWeight: 600 }}>{strength.label}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(218 28% 14%)' }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(strength.score / 7) * 100}%`, background: strength.color }} />
        </div>
      </div>

      {/* 长度 */}
      <div>
        <div className="flex justify-between text-xs mb-2" style={{ color: 'hsl(218 16% 52%)' }}>
          <span>长度</span>
          <span style={{ color: 'hsl(190 90% 68%)', fontWeight: 600 }}>{length}</span>
        </div>
        <input type="range" min={8} max={64} value={length}
          onChange={e => {
            const newLen = +e.target.value
            setLength(newLen)
            setPassword(generatePassword(newLen, opts))
          }}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: 'hsl(190 90% 60%)' }} />
        <div className="flex justify-between text-[10px] mt-1" style={{ color: 'hsl(218 16% 38%)' }}>
          <span>8</span><span>64</span>
        </div>
      </div>

      {/* 字符集选项 */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { key: 'upper', label: '大写字母 A-Z' },
          { key: 'lower', label: '小写字母 a-z' },
          { key: 'number', label: '数字 0-9' },
          { key: 'special', label: '特殊字符 !@#$' },
        ].map(o => (
          <label key={o.key} className="flex items-center gap-2 cursor-pointer text-xs"
            style={{ color: 'hsl(218 16% 56%)' }}>
            <div className={cn(
              "w-4 h-4 rounded flex items-center justify-center transition-all border",
              opts[o.key as keyof typeof opts] ? "border-transparent" : "border-[hsl(218_24%_22%)]"
            )}
              style={opts[o.key as keyof typeof opts]
                ? { background: 'linear-gradient(135deg, hsl(190 90% 60%), hsl(152 72% 52%))' }
                : { background: 'hsl(218 36% 9%)' }}
              onClick={() => {
                const newOpts = { ...opts, [o.key]: !opts[o.key as keyof typeof opts] }
                setOpts(newOpts)
                setPassword(generatePassword(length, newOpts))
              }}>
              {opts[o.key as keyof typeof opts] && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
            {o.label}
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={generate}>
          <RefreshCw className="w-3.5 h-3.5" />
          生成新密码
        </Button>
        {onUse && (
          <Button variant="success" onClick={() => onUse(password)}>
            使用此密码
          </Button>
        )}
      </div>
    </div>
  )
}
