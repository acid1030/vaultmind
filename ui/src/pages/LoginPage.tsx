import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Shield, Eye, EyeOff, Mail, User, Key, ArrowRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoginPageProps {
  onLogin: () => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setHint('请填写手机号/邮箱与密码')
      return
    }
    setLoading(true)
    setHint('')
    await new Promise(r => setTimeout(r, 800))
    setLoading(false)
    onLogin()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-dot-grid)' }}>
      {/* 背景光晕 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, hsl(190 90% 60% / 0.08), transparent 70%)' }} />
        <div className="absolute top-1/3 -right-32 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, hsl(152 72% 52% / 0.06), transparent 70%)' }} />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, hsl(262 80% 72% / 0.05), transparent 70%)' }} />
      </div>

      <div className="relative w-full max-w-[420px] animate-scale-in">
        {/* Logo 区域 */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="relative">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(145deg, hsl(190 60% 24%), hsl(152 50% 18%))',
                border: '1px solid hsl(190 60% 32% / 0.5)',
                boxShadow: '0 0 32px hsl(190 90% 60% / 0.2), inset 0 1px 0 hsl(190 90% 80% / 0.15)',
              }}>
              <Shield className="w-8 h-8" style={{ color: 'hsl(190 90% 72%)' }} />
            </div>
            <div className="absolute -inset-2 rounded-2xl opacity-40 animate-pulse"
              style={{ background: 'radial-gradient(circle, hsl(190 90% 60% / 0.15), transparent 70%)' }} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'hsl(210 30% 95%)' }}>
              VaultMind
            </h1>
            <p className="text-sm mt-1" style={{ color: 'hsl(218 16% 50%)' }}>
              加密知识工作台
            </p>
          </div>
        </div>

        {/* 登录卡片 */}
        <div className="glass-panel rounded-xl p-6">
          {/* 模式切换 */}
          <div className="flex gap-1 p-1 rounded-lg mb-5"
            style={{ background: 'hsl(218 36% 7%)' }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={cn(
                  "flex-1 h-8 text-sm font-medium rounded transition-all duration-200",
                  mode === m
                    ? "shadow-[0_1px_8px_hsl(218_42%_2%/0.4)]"
                    : "text-[hsl(218_16%_48%)] hover:text-[hsl(210_30%_75%)]"
                )}
                style={mode === m ? {
                  background: 'hsl(218 32% 12%)',
                  color: 'hsl(190 90% 72%)',
                  border: '1px solid hsl(190 60% 24% / 0.4)',
                } : {}}>
                {m === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 邮箱 */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(218 16% 55%)' }}>
                手机号 / 邮箱
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(218 16% 44%)' }} />
                <input
                  className="vm-input pl-9"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* 用户名 (仅注册) */}
            {mode === 'register' && (
              <div className="animate-fade-in">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(218 16% 55%)' }}>
                  用户名
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(218 16% 44%)' }} />
                  <input
                    className="vm-input pl-9"
                    placeholder="你的名字"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* 密码 */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(218 16% 55%)' }}>
                本地密码
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(218 16% 44%)' }} />
                <input
                  className="vm-input pl-9 pr-10"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="至少 8 位"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded"
                  style={{ color: 'hsl(218 16% 44%)' }}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 提示 */}
            {hint && (
              <p className="text-xs py-2 px-3 rounded"
                style={{ background: 'hsl(356 50% 14%)', color: 'hsl(356 84% 78%)', border: '1px solid hsl(356 50% 24%)' }}>
                {hint}
              </p>
            )}

            {/* 提交按钮 */}
            <Button variant="primary" size="lg" className="w-full mt-1" type="submit" disabled={loading}>
              {loading ? (
                <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  {mode === 'login' ? '登录' : '创建账户'}
                </>
              )}
            </Button>
          </form>

          {/* 忘记密码 */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowReset(!showReset)}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: 'hsl(218 16% 46%)' }}>
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showReset && "rotate-180")} />
              忘记密码 / 恢复码重置
            </button>

            {showReset && (
              <div className="mt-3 p-3 rounded-lg space-y-2.5 animate-fade-in"
                style={{ background: 'hsl(218 36% 7%)', border: '1px solid hsl(218 24% 14%)' }}>
                <input className="vm-input" placeholder="注册邮箱或恢复邮箱" />
                <input className="vm-input" placeholder="恢复码" />
                <input className="vm-input" type="password" placeholder="新密码，至少 8 位" />
                <Button variant="outline" className="w-full" size="sm">
                  <Key className="w-3.5 h-3.5" />
                  重置本地密码
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 底部说明 */}
        <p className="text-center text-xs mt-5" style={{ color: 'hsl(218 16% 38%)' }}>
          数据默认储存在本机 SQLite · 端到端加密 · 无服务器读取明文
        </p>
      </div>
    </div>
  )
}
