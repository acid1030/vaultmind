import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Settings, Bot, BookOpen, Database, Zap, Globe,
  Plus, Save, TestTube2, CheckCircle2, AlertCircle, ChevronDown, Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ConfigSection = 'llm' | 'feishu' | 'feishu-wiki' | 'knowledge' | 'vector' | 'obsidian' | 'recovery'

const SECTIONS: { id: ConfigSection; label: string; icon: React.ReactNode; desc: string; status: 'ok' | 'warn' | 'none' }[] = [
  { id: 'llm', label: '大模型', icon: <Bot className="w-4 h-4" />, desc: 'OpenAI / DeepSeek / Kimi 等', status: 'none' },
  { id: 'feishu', label: '飞书同步', icon: <Zap className="w-4 h-4" />, desc: 'OAuth 登录 + 云盘加密同步', status: 'warn' },
  { id: 'feishu-wiki', label: '飞书知识库', icon: <BookOpen className="w-4 h-4" />, desc: '飞书 Wiki 检索集成', status: 'none' },
  { id: 'knowledge', label: '远程知识库', icon: <Globe className="w-4 h-4" />, desc: '外部 REST 检索接口', status: 'none' },
  { id: 'vector', label: '向量数据库', icon: <Database className="w-4 h-4" />, desc: 'Milvus / Qdrant / PGVector', status: 'none' },
  { id: 'obsidian', label: 'Obsidian', icon: <Settings className="w-4 h-4" />, desc: 'Local REST API 集成', status: 'none' },
  { id: 'recovery', label: '账户恢复', icon: <CheckCircle2 className="w-4 h-4" />, desc: '绑定手机 / 恢复邮箱', status: 'none' },
]

const LLM_PROVIDERS = [
  { id: 'deepseek', label: 'DeepSeek', url: 'https://api.deepseek.com' },
  { id: 'openai', label: 'OpenAI', url: 'https://api.openai.com/v1' },
  { id: 'qwen', label: '千问（阿里百炼）', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'kimi', label: 'Kimi (Moonshot)', url: 'https://api.moonshot.cn/v1' },
  { id: 'zhipu', label: '智谱 AI', url: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'gemini', label: 'Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { id: 'claude', label: 'Claude', url: 'https://api.anthropic.com/v1' },
  { id: 'grok', label: 'Grok', url: 'https://api.x.ai/v1' },
  { id: 'custom', label: '自定义 (OpenAI-compatible)', url: '' },
]

export default function ConfigView() {
  const [active, setActive] = useState<ConfigSection>('llm')
  const [llmProvider, setLlmProvider] = useState('deepseek')
  const [llmModel, setLlmModel] = useState('')
  const [llmKey, setLlmKey] = useState('')
  const [llmUrl, setLlmUrl] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)

  const activeSection = SECTIONS.find(s => s.id === active)

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    await new Promise(r => setTimeout(r, 1200))
    setTesting(false)
    setTestResult('ok')
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: '260px 1fr', alignItems: 'start' }}>
      {/* 左侧菜单 */}
      <div className="glass-card rounded-md overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid hsl(218 24% 14%)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'hsl(210 30% 90%)' }}>配置中心</h2>
        </div>
        <div className="p-1.5 space-y-0.5">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActive(s.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-left transition-all",
                active === s.id
                  ? "border"
                  : "hover:bg-[hsl(218_28%_10%)]"
              )}
              style={active === s.id ? {
                background: 'hsl(218 30% 11%)',
                borderColor: 'hsl(190 60% 24% / 0.35)',
                color: 'hsl(190 90% 72%)',
              } : { color: 'hsl(218 16% 55%)' }}>
              <span className={active === s.id ? '' : ''}>{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-medium", active === s.id ? '' : 'text-[hsl(210_30%_78%)]')}>{s.label}</p>
                <p className="text-[10px] mt-0.5 truncate" style={{ color: 'hsl(218 16% 42%)' }}>{s.desc}</p>
              </div>
              {s.status !== 'none' && (
                <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0",
                  s.status === 'ok' ? 'bg-[hsl(152_72%_52%)]' : 'bg-[hsl(43_90%_60%)]'
                )} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 右侧内容 */}
      <div className="glass-card rounded-md overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid hsl(218 24% 14%)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'hsl(190 60% 16% / 0.5)', border: '1px solid hsl(190 60% 24% / 0.3)', color: 'hsl(190 90% 68%)' }}>
              {activeSection?.icon}
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'hsl(210 30% 92%)' }}>{activeSection?.label}</h2>
              <p className="text-xs mt-0.5" style={{ color: 'hsl(218 16% 46%)' }}>{activeSection?.desc}</p>
            </div>
            <Button variant="primary" size="sm" className="ml-auto">
              <Plus className="w-3.5 h-3.5" />
              新增配置
            </Button>
          </div>
        </div>

        <div className="p-5">
          {active === 'llm' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>AI 服务商</label>
                <div className="grid grid-cols-3 gap-2">
                  {LLM_PROVIDERS.slice(0, 6).map(p => (
                    <button key={p.id} onClick={() => { setLlmProvider(p.id); setLlmUrl(p.url) }}
                      className={cn(
                        "px-3 py-2 rounded text-xs font-medium text-left transition-all border",
                        llmProvider === p.id
                          ? "text-[hsl(190_90%_72%)] border-[hsl(190_60%_24%/0.4)]"
                          : "text-[hsl(218_16%_52%)] border-[hsl(218_24%_16%)] hover:border-[hsl(218_24%_22%)]"
                      )}
                      style={llmProvider === p.id ? { background: 'hsl(190 60% 16% / 0.4)' } : { background: 'hsl(218 36% 7%)' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <ChevronDown className="w-3.5 h-3.5 mt-2 cursor-pointer" style={{ color: 'hsl(218 16% 44%)' }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>API Key</label>
                  <input className="vm-input" type="password" placeholder="sk-..." value={llmKey} onChange={e => setLlmKey(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>模型</label>
                  <input className="vm-input" placeholder="deepseek-chat / gpt-4.1-mini" value={llmModel} onChange={e => setLlmModel(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>Base URL</label>
                  <input className="vm-input" placeholder="https://api.deepseek.com" value={llmUrl} onChange={e => setLlmUrl(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>Temperature</label>
                  <input className="vm-input" placeholder="0.2" />
                </div>
              </div>

              {testResult && (
                <div className={cn("flex items-center gap-2 p-3 rounded text-xs",
                  testResult === 'ok'
                    ? "bg-[hsl(152_50%_14%/0.5)] border border-[hsl(152_50%_22%/0.4)] text-[hsl(152_72%_65%)]"
                    : "bg-[hsl(356_50%_14%/0.5)] border border-[hsl(356_50%_22%/0.4)] text-[hsl(356_84%_72%)]"
                )}>
                  {testResult === 'ok'
                    ? <><CheckCircle2 className="w-3.5 h-3.5" /> 模型连接成功，响应正常</>
                    : <><AlertCircle className="w-3.5 h-3.5" /> 连接失败，请检查 API Key</>}
                </div>
              )}

              <div className="flex gap-2.5">
                <Button variant="primary" onClick={() => {}}>
                  <Save className="w-4 h-4" />
                  保存配置
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={testing}>
                  {testing
                    ? <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    : <TestTube2 className="w-3.5 h-3.5" />}
                  测试连接
                </Button>
              </div>
            </div>
          )}

          {active === 'feishu' && (
            <div className="space-y-4 max-w-2xl">
              <div className="p-4 rounded-lg"
                style={{ background: 'hsl(43 60% 16% / 0.3)', border: '1px solid hsl(43 60% 24% / 0.35)' }}>
                <p className="text-xs leading-relaxed" style={{ color: 'hsl(43 80% 68%)' }}>
                  需要在飞书开放平台创建企业自建应用，添加 OAuth 回调地址：<br />
                  <code className="font-mono" style={{ color: 'hsl(43 90% 72%)' }}>http://127.0.0.1:37891/feishu/oauth/callback</code><br />
                  开通权限：drive:drive · drive:drive:readonly · auth:user.id:read · wiki:wiki:readonly
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>App ID</label>
                  <input className="vm-input" placeholder="cli_xxx" />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>App Secret</label>
                  <input className="vm-input" type="password" placeholder="仅保存在本机 SQLite" />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>飞书文件夹 Token</label>
                  <input className="vm-input" placeholder="root 或 fldcn..." />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>加密口令</label>
                  <input className="vm-input" type="password" placeholder="上传/取回的加密密码，至少 8 位" />
                </div>
              </div>
              <div className="flex gap-2.5 flex-wrap">
                <Button variant="primary"><Save className="w-4 h-4" />保存配置</Button>
                <Button variant="cyan"><Zap className="w-4 h-4" />登录飞书</Button>
                <Button variant="ghost">退出飞书</Button>
                <Button variant="outline" size="sm">测试同步</Button>
              </div>
            </div>
          )}

          {active === 'feishu-wiki' && (
            <div className="space-y-4 max-w-2xl">
              <div className="p-4 rounded-lg"
                style={{ background: 'hsl(190 60% 12% / 0.3)', border: '1px solid hsl(190 60% 22% / 0.3)' }}>
                <p className="text-xs leading-relaxed" style={{ color: 'hsl(190 60% 60%)' }}>
                  需先在「飞书同步」中完成 OAuth 登录，再填写 Wiki Space Token 以开启 Wiki 检索集成。
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>Wiki Space Token</label>
                  <input className="vm-input" placeholder="space_xxx" />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>检索结果数量上限</label>
                  <input className="vm-input" placeholder="5" defaultValue="5" />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>语言偏好</label>
                  <select className="vm-input">
                    <option>中文优先</option>
                    <option>英文优先</option>
                    <option>不限</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="wiki-rag" defaultChecked className="w-3.5 h-3.5" />
                <label htmlFor="wiki-rag" className="text-xs" style={{ color: 'hsl(218 16% 56%)' }}>
                  启用 RAG — 将 Wiki 内容纳入 AI 对话上下文
                </label>
              </div>
              <Button variant="primary">
                <Save className="w-4 h-4" />
                保存配置
              </Button>
            </div>
          )}

          {(active === 'knowledge' || active === 'vector') && (
            <div className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>名称</label>
                  <input className="vm-input" placeholder={active === 'vector' ? 'Milvus / Qdrant' : '公司知识库'} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>检索接口 URL</label>
                  <input className="vm-input" placeholder="https://server/search" />
                </div>
                {active === 'vector' && (
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>Collection</label>
                    <input className="vm-input" placeholder="personal_docs" />
                  </div>
                )}
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>API Key（可选）</label>
                  <input className="vm-input" type="password" placeholder="可选" />
                </div>
              </div>
              <Button variant="primary">
                <Plus className="w-4 h-4" />
                添加{active === 'vector' ? '向量库' : '知识库'}
              </Button>
              <div className="mt-4 space-y-2">
                {[{ name: '内部文档库', url: 'https://kb.internal/search', status: 'ok' }].map((kb, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded"
                    style={{ background: 'hsl(218 36% 8%)', border: '1px solid hsl(218 24% 14%)' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(152 72% 52%)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium" style={{ color: 'hsl(210 30% 88%)' }}>{kb.name}</p>
                      <p className="text-[10px]" style={{ color: 'hsl(218 16% 44%)' }}>{kb.url}</p>
                    </div>
                    <Button variant="ghost" size="icon-sm" style={{ color: 'hsl(352 84% 60%)' }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === 'obsidian' && (
            <div className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>名称</label>
                  <input className="vm-input" placeholder="我的 Obsidian Vault" />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>Base URL</label>
                  <input className="vm-input" placeholder="https://127.0.0.1:27124" />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>API Token</label>
                  <input className="vm-input" type="password" placeholder="Local REST API token" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'hsl(218 16% 54%)' }}>
                <input type="checkbox" defaultChecked className="w-3.5 h-3.5" />
                允许自签名 HTTPS 证书
              </label>
              <Button variant="primary">
                <Plus className="w-4 h-4" />
                添加 Obsidian
              </Button>
            </div>
          )}

          {active === 'recovery' && (
            <div className="space-y-4 max-w-lg">
              <div className="p-4 rounded-lg"
                style={{ background: 'hsl(190 60% 12% / 0.3)', border: '1px solid hsl(190 60% 22% / 0.3)' }}>
                <p className="text-xs leading-relaxed" style={{ color: 'hsl(190 60% 60%)' }}>
                  绑定手机号或恢复邮箱后，可通过恢复码重置本地密码。妥善保存恢复码，遗失后无法找回。
                </p>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>绑定手机</label>
                <input className="vm-input" placeholder="+86 手机号，用于找回身份" />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'hsl(218 16% 52%)' }}>恢复邮箱</label>
                <input className="vm-input" placeholder="recovery@example.com" />
              </div>
              <Button variant="primary">
                <Save className="w-4 h-4" />
                保存恢复资料
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
