import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Shield, Eye, EyeOff, Mail, User, Key, ArrowRight, ChevronDown, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import { vaultApi } from '@/lib/ipc'

export default function LoginPage() {
  const { register, login, hasUsers, logout } = useAppStore()
  const toast = useToast()

  const [mode, setMode] = useState<'login' | 'register'>(hasUsers ? 'login' : 'register')
  const [showPassword, setShowPassword] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')

  // Reset form
  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetPassword, setResetPassword] = useState('')

  const passwordStrength = (() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 8) s++
    if (password.length >= 12) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setHint('请填写手机号/邮箱与密码')
      return
    }
    if (mode === 'register' && !username) {
      setHint('请输入用户名')
      return
    }
    if (password.length < 8) {
      setHint('本地密码至少需要 8 个字符')
      return
    }
    setLoading(true)
    setHint('')

    try {
      if (mode === 'register') {
        const result = await register({
          email,
          username,
          password,
          recoveryEmail: email,
        })
        if (result.error) {
          setHint(result.error)
        } else if (result.recoveryCode) {
          setRecoveryCode(result.recoveryCode)
          toast('注册成功！请妥善保存恢复码', 'success')
        }
      } else {
        const result = await login(email, password)
        if (result.error) {
          setHint(result.error)
        } else {
          toast('登录成功', 'success')
        }
      }
    } catch (err: any) {
      setHint(err.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (!resetEmail || !resetCode || resetPassword.length < 8) {
      toast('请填写完整信息，新密码至少 8 位', 'warning')
      return
    }
    setLoading(true)
    try {
      await vaultApi.resetPassword({ email: resetEmail, recoveryCode: resetCode, newPassword: resetPassword })
      toast('密码重置成功，请用新密码登录', 'success')
      setShowReset(false)
      setMode('login')
      setResetEmail('')
      setResetCode('')
      setResetPassword('')
    } catch (err: any) {
      toast(err.message || '重置失败', 'error')
    } finally {
      setLoading(false)
    }
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

      {/* 恢复码展示 */}
      {recoveryCode ? (
        <div className="relative w-full max-w-[420px] animate-scale-in">
          <div className="glass-panel rounded-xl p-6 text-center">
            <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'hsl(152 50% 18% / 0.5)', border: '1px solid hsl(152 50% 28% / 0.4)' }}>
              <CheckCircle2 className="w-7 h-7" style={{ color: 'hsl(152 72% 65%)' }} />
            </div>
            <h2 className="text-lg font-semibold mb-2 text-foreground" >注册成功</h2>
            <p className="text-xs mb-4 text-muted-foreground" >
              请妥善保存以下恢复码，遗失后无法找回：
            </p>
            <div className="font-mono text-lg tracking-widest p-3 rounded-lg mb-4"
              style={{ background: 'hsl(218 36% 7%)', border: '1px solid var(--border)', color: 'hsl(43 90% 65%)' }}>
              {recoveryCode}
            </div>
            <Button variant="primary" className="w-full" onClick={() => setRecoveryCode('')}>
              <ArrowRight className="w-4 h-4" />
              进入应用
            </Button>
          </div>
        </div>
      ) : (
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
              <h1 className="text-2xl font-bold tracking-tight text-foreground" >
                VaultMind
              </h1>
              <p className="text-sm mt-1 text-muted-foreground" >
                加密知识工作台
              </p>
            </div>
          </div>

          {/* 登录卡片 */}
          <div className="glass-panel rounded-xl p-6">
            {/* 模式切换 */}
            <div className="flex gap-1 p-1 rounded-lg mb-5 bg-muted"
              >
              {(['login', 'register'] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setHint('') }}
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
                <label className="block text-xs font-medium mb-1.5 text-muted-foreground" >
                  手机号 / 邮箱
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"  />
                  <input
                    className="vm-input pl-9"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* 用户名 (仅注册) */}
              {mode === 'register' && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-medium mb-1.5 text-muted-foreground" >
                    用户名
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"  />
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
                <label className="block text-xs font-medium mb-1.5 text-muted-foreground" >
                  本地密码
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"  />
                  <input
                    className="vm-input pl-9 pr-10"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="至少 8 位"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded"
                    style={{ color: 'hsl(218 16% 44%)' }}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* 密码强度指示器 (仅注册) */}
                {mode === 'register' && password && (
                  <div className="flex gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="h-1 flex-1 rounded-full transition-all"
                        style={{
                          background: i <= passwordStrength
                            ? passwordStrength <= 2 ? 'hsl(352 80% 58%)'
                              : passwordStrength <= 3 ? 'hsl(43 90% 58%)'
                              : 'hsl(152 72% 52%)'
                            : 'hsl(218 24% 16%)'
                        }} />
                    ))}
                  </div>
                )}
              </div>

              {/* 提示 */}
              {hint && (
                <p className="text-xs py-2 px-3 rounded animate-fade-in"
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
                  style={{ background: 'hsl(218 36% 7%)', border: '1px solid var(--border)' }}>
                  <input className="vm-input" placeholder="注册邮箱或恢复邮箱"
                    value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
                  <input className="vm-input" placeholder="恢复码"
                    value={resetCode} onChange={e => setResetCode(e.target.value)} />
                  <input className="vm-input" type="password" placeholder="新密码，至少 8 位"
                    value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
                  <Button variant="outline" className="w-full" size="sm" onClick={handleReset} disabled={loading}>
                    <Key className="w-3.5 h-3.5" />
                    重置本地密码
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* 底部说明 */}
          <p className="text-center text-xs mt-5 text-muted-foreground" >
            数据默认储存在本机 SQLite · 端到端加密 · 无服务器读取明文
          </p>
        </div>
      )}
    </div>
  )
}
