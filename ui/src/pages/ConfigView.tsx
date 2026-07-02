import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Settings, Bot, BookOpen, Database, Zap, Globe,
  Plus, Save, TestTube2, CheckCircle2, AlertCircle, ChevronDown, Trash2, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { useToast } from '@/components/shared/Toast'
import { vaultApi } from '@/lib/ipc'

type ConfigSection = 'llm' | 'feishu' | 'feishu-wiki' | 'knowledge' | 'vector' | 'obsidian' | 'recovery'

const SECTIONS: { id: ConfigSection; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'llm',          label: '大模型',     icon: <Bot className="w-4 h-4" />,      desc: 'OpenAI / DeepSeek / Kimi 等' },
  { id: 'feishu',       label: '飞书同步',   icon: <Zap className="w-4 h-4" />,      desc: 'OAuth 登录 + 云盘加密同步' },
  { id: 'feishu-wiki',  label: '飞书知识库', icon: <BookOpen className="w-4 h-4" />,desc: '飞书 Wiki 检索集成' },
  { id: 'knowledge',    label: '远程知识库', icon: <Globe className="w-4 h-4" />,   desc: '外部 REST 检索接口' },
  { id: 'vector',       label: '向量数据库', icon: <Database className="w-4 h-4" />,desc: 'Milvus / Qdrant / PGVector' },
  { id: 'obsidian',     label: 'Obsidian',   icon: <Settings className="w-4 h-4" />, desc: 'Local REST API 集成' },
  { id: 'recovery',     label: '账户恢复',   icon: <CheckCircle2 className="w-4 h-4" />, desc: '绑定手机 / 恢复邮箱' },
]

const LLM_PROVIDERS = [
  { id: 'deepseek', label: 'DeepSeek', url: 'https://api.deepseek.com' },
  { id: 'openai', label: 'OpenAI', url: 'https://api.openai.com/v1' },
  { id: 'qwen', label: '千问', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'kimi', label: 'Kimi', url: 'https://api.moonshot.cn/v1' },
  { id: 'zhipu', label: '智谱 AI', url: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'zhipu-coding', label: '智谱 Coding', url: 'https://open.bigmodel.cn/api/coding/paas/v4' },
  { id: 'claude', label: 'Claude', url: 'https://api.anthropic.com/v1' },
  { id: 'custom', label: '自定义', url: '' },
]

const MODEL_PRESETS: Record<string, string[]> = {
  deepseek: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  qwen: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-coder-plus'],
  kimi: ['kimi-latest', 'kimi-k2', 'kimi-k1.5', 'moonshot-v1-8k'],
  zhipu: ['glm-4.5', 'glm-4.5-air', 'glm-4.6', 'glm-4.7', 'glm-5', 'glm-5-turbo', 'glm-5.2'],
  'zhipu-coding': ['glm-4.5', 'glm-4.5-air', 'glm-4.6', 'glm-4.7', 'glm-5', 'glm-5-turbo', 'glm-5.2'],
  claude: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-latest'],
  custom: [],
}

export default function ConfigView() {
  const { state, saveSettings, saveAiProfile, loginFeishu, logoutFeishu, saveLocalVectorSettings } = useAppStore()
  const toast = useToast()

  const [active, setActive] = useState<ConfigSection>('llm')

  // LLM form
  const aiProfile = state?.knowledgeCenter.aiProfile
  const [llmProvider, setLlmProvider] = useState('')
  const [llmModel, setLlmModel] = useState('')
  const [llmKey, setLlmKey] = useState('')
  const [llmUrl, setLlmUrl] = useState('')
  const [llmTemp, setLlmTemp] = useState('0.2')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)
  const [models, setModels] = useState<string[]>([])
  const [customModels, setCustomModels] = useState<Record<string, string[]>>({})

  // Feishu form
  const settings = state?.settings
  const [appId, setAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [folderToken, setFolderToken] = useState('root')
  const [passphrase, setPassphrase] = useState('')
  const [autoSync, setAutoSync] = useState(false)
  const [showMoreProviders, setShowMoreProviders] = useState(false)

  // Local vector search
  const [localVectorSearch, setLocalVectorSearch] = useState(false)
  const [localVectorModel, setLocalVectorModel] = useState('Xenova/all-MiniLM-L6-v2')
  const [vectorModelLoading, setVectorModelLoading] = useState(false)

  // Wiki
  const [wikiEnabled, setWikiEnabled] = useState(true)
  const [wikiSpaceId, setWikiSpaceId] = useState('')

  // Recovery
  const [recoveryPhone, setRecoveryPhone] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')

  useEffect(() => {
    if (aiProfile) {
      setLlmProvider(aiProfile.provider || '')
      setLlmModel(aiProfile.model || '')
      setLlmUrl(aiProfile.baseUrl || '')
      setLlmKey(aiProfile.apiKey || '')
      setLlmTemp(String(aiProfile.temperature || 0.2))
    }
  }, [aiProfile])

  useEffect(() => {
    if (settings) {
      setAppId(settings.appId || '')
      setAppSecret(settings.appSecret || '')
      setFolderToken(settings.folderToken || 'root')
      setPassphrase(settings.feishuPassphrase || '')
      setAutoSync(Boolean(settings.feishuAutoSync))
      setLocalVectorSearch(Boolean(settings.localVectorSearch))
      setLocalVectorModel(settings.localVectorModel || 'Xenova/all-MiniLM-L6-v2')
    }
  }, [settings])

  useEffect(() => {
    if (state?.auth.user) {
      setRecoveryPhone(state.auth.user.phone || '')
      setRecoveryEmail(state.auth.user.recoveryEmail || '')
    }
  }, [state?.auth.user])

  const wikiSettings = state?.knowledgeCenter.feishuWiki
  useEffect(() => {
    if (wikiSettings) {
      setWikiEnabled(wikiSettings.enabled)
      setWikiSpaceId(wikiSettings.spaceId)
    }
  }, [wikiSettings])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('vaultmind_custom_models')
      if (raw) setCustomModels(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    setModels([])
    if (!llmModel && llmProvider) {
      const presets = MODEL_PRESETS[llmProvider]
      if (presets && presets[0]) setLlmModel(presets[0])
    }
  }, [llmProvider])

  const saveCustomModels = (next: Record<string, string[]>) => {
    setCustomModels(next)
    try { localStorage.setItem('vaultmind_custom_models', JSON.stringify(next)) } catch { /* ignore */ }
  }

  const addCustomModel = (modelId: string) => {
    const id = modelId.trim()
    if (!id || !llmProvider) return
    const list = customModels[llmProvider] || []
    if (list.includes(id)) return
    saveCustomModels({ ...customModels, [llmProvider]: [...list, id] })
  }

  const removeCustomModel = (id: string) => {
    if (!llmProvider) return
    const list = (customModels[llmProvider] || []).filter(m => m !== id)
    saveCustomModels({ ...customModels, [llmProvider]: list })
  }

  const handleSaveLlm = async () => {
    if (!llmUrl || !llmModel) {
      toast('请填写 Base URL 和模型名称', 'warning')
      return
    }
    const result = await saveAiProfile({
      provider: llmProvider || 'openai-compatible',
      baseUrl: llmUrl,
      apiKey: llmKey,
      model: llmModel,
      temperature: parseFloat(llmTemp) || 0.2,
    })
    if (result.error) {
      toast(result.error, 'error')
    } else {
      toast('AI 配置已保存', 'success')
    }
  }

  const handleTestLlm = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await vaultApi.testModel({
        provider: llmProvider,
        baseUrl: llmUrl,
        apiKey: llmKey,
        model: llmModel,
        temperature: parseFloat(llmTemp) || 0.2,
      })
      setTestResult('ok')
      toast('模型连接成功', 'success')
    } catch (err: any) {
      setTestResult('fail')
      toast(err.message || '连接失败', 'error')
    } finally {
      setTesting(false)
    }
  }

  const handleListModels = async () => {
    try {
      const result = await vaultApi.listModels({
        provider: llmProvider,
        baseUrl: llmUrl,
        apiKey: llmKey,
      })
      setModels(result.models || [])
      toast(`找到 ${result.models?.length || 0} 个模型`, 'success')
    } catch (err: any) {
      toast(err.message || '获取模型列表失败', 'error')
    }
  }

  const handleSaveFeishu = async () => {
    const result = await saveSettings({
      appId,
      appSecret: appSecret === '********' ? undefined : appSecret,
      folderToken,
      feishuPassphrase: passphrase === '********' ? undefined : passphrase,
      feishuAutoSync: autoSync,
    })
    if (result.error) {
      toast(result.error, 'error')
    } else {
      toast('飞书配置已保存', 'success')
    }
  }

  const handleLoginFeishu = async () => {
    const result = await loginFeishu()
    if (result.error) {
      toast(result.error, 'error')
    } else {
      toast('飞书登录成功', 'success')
    }
  }

  const handleSaveWiki = async () => {
    try {
      await vaultApi.saveFeishuWikiSettings({ enabled: wikiEnabled, spaceId: wikiSpaceId })
      toast('飞书 Wiki 配置已保存', 'success')
    } catch (err: any) {
      toast(err.message || '保存失败', 'error')
    }
  }

  const handleSaveLocalVector = async () => {
    setVectorModelLoading(true)
    try {
      const result = await saveLocalVectorSettings({
        localVectorSearch,
        localVectorModel: localVectorModel.trim() || 'Xenova/all-MiniLM-L6-v2',
      })
      if (result.error) {
        toast(result.error, 'error')
      } else {
        toast('本地向量搜索配置已保存', 'success')
      }
    } catch (err: any) {
      toast(err.message || '保存失败', 'error')
    } finally {
      setVectorModelLoading(false)
    }
  }

  const handleSaveRecovery = async () => {
    try {
      await vaultApi.updateRecovery({ phone: recoveryPhone, recoveryEmail })
      toast('恢复资料已保存', 'success')
    } catch (err: any) {
      toast(err.message || '保存失败', 'error')
    }
  }

  const activeSection = SECTIONS.find(s => s.id === active)

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: '260px 1fr', alignItems: 'start' }}>
      {/* 左侧菜单 */}
      <div className="glass-card rounded-md overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold text-foreground" >配置中心</h2>
        </div>
        <div className="p-1.5 space-y-0.5">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActive(s.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-left transition-all",
                active === s.id ? "border" : "hover:bg-[hsl(218_28%_10%)]"
              )}
              style={active === s.id ? {
                background: 'hsl(218 30% 11%)',
                borderColor: 'hsl(190 60% 24% / 0.35)',
                color: 'hsl(190 90% 72%)',
              } : { color: 'hsl(218 16% 55%)' }}>
              <span>{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-medium", active === s.id ? '' : 'text-[hsl(210_30%_78%)]')}>{s.label}</p>
                <p className="text-[10px] mt-0.5 truncate text-muted-foreground" >{s.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 右侧内容 */}
      <div className="glass-card rounded-md overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'hsl(190 60% 16% / 0.5)', border: '1px solid hsl(190 60% 24% / 0.3)', color: 'hsl(190 90% 68%)' }}>
              {activeSection?.icon}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground" >{activeSection?.label}</h2>
              <p className="text-xs mt-0.5 text-muted-foreground" >{activeSection?.desc}</p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {active === 'llm' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs mb-1.5 text-muted-foreground" >AI 服务商</label>
                <div className="grid grid-cols-3 gap-2">
                  {(showMoreProviders ? LLM_PROVIDERS : LLM_PROVIDERS.slice(0, 6)).map(p => (
                    <button key={p.id} onClick={() => { setLlmProvider(p.id); if (p.url) setLlmUrl(p.url) }}
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
                <button onClick={() => setShowMoreProviders(!showMoreProviders)}
                  className="flex items-center gap-1 mt-2 text-xs"
                  style={{ color: 'hsl(218 16% 44%)' }}>
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showMoreProviders && "rotate-180")} />
                  {showMoreProviders ? '收起' : '显示更多'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1.5 text-muted-foreground" >API Key</label>
                  <input className="vm-input" type="password" placeholder="sk-..." value={llmKey} onChange={e => setLlmKey(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5 text-muted-foreground" >模型</label>
                  <div className="flex gap-1">
                    <input className="vm-input" placeholder="deepseek-chat / gpt-4" value={llmModel} onChange={e => setLlmModel(e.target.value)} />
                    <Button variant="outline" size="sm" onClick={handleListModels} title="获取模型列表">
                      <Globe className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <ModelChips
                    models={models}
                    provider={llmProvider}
                    selected={llmModel}
                    customModels={customModels}
                    onSelect={setLlmModel}
                    onAdd={addCustomModel}
                    onRemove={removeCustomModel}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5 text-muted-foreground" >Base URL</label>
                  <input className="vm-input" placeholder="https://api.deepseek.com" value={llmUrl} onChange={e => setLlmUrl(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5 text-muted-foreground" >Temperature</label>
                  <input className="vm-input" placeholder="0.2" value={llmTemp} onChange={e => setLlmTemp(e.target.value)} />
                </div>
              </div>

              {testResult && (
                <div className={cn("flex items-center gap-2 p-3 rounded text-xs",
                  testResult === 'ok'
                    ? "bg-[hsl(152_50%_14%/0.5)] border border-[hsl(152_50%_22%/0.4)] text-[hsl(152_72%_65%)]"
                    : "bg-[hsl(356_50%_14%/0.5)] border border-[hsl(356_50%_22%/0.4)] text-[hsl(356_84%_72%)]"
                )}>
                  {testResult === 'ok'
                    ? <><CheckCircle2 className="w-3.5 h-3.5" /> 模型连接成功</>
                    : <><AlertCircle className="w-3.5 h-3.5" /> 连接失败，请检查配置</>}
                </div>
              )}

              <div className="flex gap-2.5">
                <Button variant="primary" onClick={handleSaveLlm}>
                  <Save className="w-4 h-4" />
                  保存配置
                </Button>
                <Button variant="outline" onClick={handleTestLlm} disabled={testing}>
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5" />}
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

              {/* 飞书连接状态 */}
              <div className={cn("flex items-center gap-3 p-3 rounded-lg",
                state?.isFeishuLoggedIn ? "" : "")}
                style={{
                  background: state?.isFeishuLoggedIn ? 'hsl(152 50% 14% / 0.4)' : 'hsl(218 36% 8%)',
                  border: `1px solid ${state?.isFeishuLoggedIn ? 'hsl(152 50% 24% / 0.4)' : 'hsl(218 24% 16%)'}`,
                }}>
                {state?.isFeishuLoggedIn ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: 'hsl(152 72% 55%)' }} />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-muted-foreground"  />
                )}
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground" >
                    {state?.isFeishuLoggedIn ? `飞书已登录${state?.feishuUser?.name ? `: ${state.feishuUser.name}` : ''}` : '飞书未登录'}
                  </p>
                </div>
                {state?.isFeishuLoggedIn ? (
                  <Button variant="ghost" size="sm" onClick={() => logoutFeishu()}>退出飞书</Button>
                ) : (
                  <Button variant="cyan" size="sm" onClick={handleLoginFeishu}>
                    <Zap className="w-3.5 h-3.5" />
                    登录飞书
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1.5 text-muted-foreground" >App ID</label>
                  <input className="vm-input" placeholder="cli_xxx" value={appId} onChange={e => setAppId(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5 text-muted-foreground" >App Secret</label>
                  <input className="vm-input" type="password" placeholder="仅保存在本机"
                    value={appSecret} onChange={e => setAppSecret(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5 text-muted-foreground" >飞书文件夹 Token</label>
                  <input className="vm-input" placeholder="root 或 fldcn..." value={folderToken} onChange={e => setFolderToken(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5 text-muted-foreground" >加密口令</label>
                  <input className="vm-input" type="password" placeholder="至少 8 位" value={passphrase} onChange={e => setPassphrase(e.target.value)} />
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-lg cursor-pointer"
                style={{ background: 'hsl(218 36% 8%)', border: '1px solid hsl(218 24% 16%)' }}>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-muted-foreground text-primary"
                  checked={autoSync}
                  onChange={e => setAutoSync(e.target.checked)}
                />
                <div>
                  <p className="text-xs font-medium text-foreground" >创建内容后自动同步到飞书</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">开启后，新建文本/链接条目会尝试自动上传到飞书云盘</p>
                </div>
              </label>

              <div className="flex gap-2.5 flex-wrap">
                <Button variant="primary" onClick={handleSaveFeishu}>
                  <Save className="w-4 h-4" />
                  保存配置
                </Button>
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
                  <label className="block text-xs mb-1.5 text-muted-foreground" >Wiki Space ID（可选）</label>
                  <input className="vm-input" placeholder="留空搜索全部空间" value={wikiSpaceId} onChange={e => setWikiSpaceId(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="wiki-enabled" checked={wikiEnabled}
                  onChange={e => setWikiEnabled(e.target.checked)} className="w-3.5 h-3.5" />
                <label htmlFor="wiki-enabled" className="text-xs" style={{ color: 'hsl(218 16% 56%)' }}>
                  启用飞书知识库检索 — 将 Wiki 内容纳入 AI 对话上下文
                </label>
              </div>
              <Button variant="primary" onClick={handleSaveWiki}>
                <Save className="w-4 h-4" />
                保存配置
              </Button>
            </div>
          )}

          {active === 'vector' && (
            <div className="space-y-4 max-w-2xl">
              <div className="p-4 rounded-lg"
                style={{ background: 'hsl(190 60% 12% / 0.3)', border: '1px solid hsl(190 60% 22% / 0.3)' }}>
                <p className="text-xs leading-relaxed" style={{ color: 'hsl(190 60% 60%)' }}>
                  开启后，本地内容会自动生成向量索引。语义搜索时优先按意思匹配，不再只靠关键词。
                  首次使用需要下载 embedding 模型（约 80MB）。
                </p>
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-lg cursor-pointer"
                style={{ background: 'hsl(218 36% 8%)', border: '1px solid hsl(218 24% 16%)' }}>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-muted-foreground text-primary"
                  checked={localVectorSearch}
                  onChange={e => setLocalVectorSearch(e.target.checked)}
                />
                <div>
                  <p className="text-xs font-medium text-foreground" >启用本地向量搜索</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">新建/上传内容时自动生成向量索引</p>
                </div>
              </label>

              <div>
                <label className="block text-xs mb-1.5 text-muted-foreground" >Embedding 模型</label>
                <input className="vm-input" placeholder="Xenova/all-MiniLM-L6-v2"
                  value={localVectorModel}
                  onChange={e => setLocalVectorModel(e.target.value)}
                  disabled={!localVectorSearch} />
                <p className="text-[10px] text-muted-foreground mt-1">推荐：Xenova/all-MiniLM-L6-v2（80MB，中英文通用）</p>
              </div>

              <div className="flex gap-2.5 flex-wrap">
                <Button variant="primary" onClick={handleSaveLocalVector} disabled={vectorModelLoading}>
                  {vectorModelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  保存配置
                </Button>
              </div>

              <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-xs font-medium text-foreground mb-3" >外部向量数据库（可选）</p>
                <KnowledgeSourceConfig type="vector" />
              </div>
            </div>
          )}

          {(active === 'knowledge' || active === 'obsidian') && (
            <KnowledgeSourceConfig type={active} />
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
                <label className="block text-xs mb-1.5 text-muted-foreground" >绑定手机</label>
                <input className="vm-input" placeholder="+86 手机号" value={recoveryPhone} onChange={e => setRecoveryPhone(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs mb-1.5 text-muted-foreground" >恢复邮箱</label>
                <input className="vm-input" placeholder="recovery@example.com" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} />
              </div>
              <Button variant="primary" onClick={handleSaveRecovery}>
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

// ── Knowledge Source Config Component ─────────────────────

function ModelChips({
  models,
  provider,
  selected,
  customModels,
  onSelect,
  onAdd,
  onRemove,
}: {
  models: string[]
  provider: string
  selected: string
  customModels: Record<string, string[]>
  onSelect: (m: string) => void
  onAdd: (m: string) => void
  onRemove: (m: string) => void
}) {
  const [draft, setDraft] = useState('')
  const presets = MODEL_PRESETS[provider] || []
  const suggestions = models.length > 0
    ? Array.from(new Set([...models, ...presets, ...(customModels[provider] || [])]))
    : Array.from(new Set([...presets, ...(customModels[provider] || [])]))

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {suggestions.slice(0, 12).map(m => {
          const isCustom = (customModels[provider] || []).includes(m)
          return (
            <button key={m} onClick={() => onSelect(m)}
              className={cn(
                "group flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-sm transition-colors",
                selected === m
                  ? "text-[hsl(190_90%_72%)]"
                  : "text-[hsl(218_16%_52%)] hover:text-[hsl(218_16%_72%)]"
              )}
              style={{ background: selected === m ? 'hsl(190 60% 18%)' : 'hsl(218 28% 14%)' }}>
              {m}
              {isCustom && (
                <span
                  onClick={e => { e.stopPropagation(); onRemove(m) }}
                  className="ml-0.5 opacity-60 group-hover:opacity-100 hover:text-[hsl(352_84%_60%)]"
                  title="删除自定义模型">
                  ×
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="flex gap-1">
        <input
          className="vm-input text-[11px] py-1"
          style={{ minHeight: 0 }}
          placeholder="输入自定义模型 ID，例如 glm-5.2-flash"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onAdd(draft)
              setDraft('')
            }
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => { onAdd(draft); setDraft('') }}
          disabled={!draft.trim() || !provider}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

function KnowledgeSourceConfig({ type }: { type: 'knowledge' | 'vector' | 'obsidian' }) {
  const { state } = useAppStore()
  const toast = useToast()
  const [name, setName] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [collection, setCollection] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [insecureTls, setInsecureTls] = useState(false)

  const sources = type === 'knowledge' ? state?.knowledgeCenter.knowledgeSources
    : type === 'vector' ? state?.knowledgeCenter.vectorSources
    : state?.knowledgeCenter.obsidianSources

  const isVector = type === 'vector'
  const isObsidian = type === 'obsidian'

  const handleAdd = async () => {
    if (!name || (!endpoint && !baseUrl)) {
      toast('请填写名称和地址', 'warning')
      return
    }
    try {
      const existing = sources || []
      const newSource: any = {
        id: crypto.randomUUID(),
        name,
        apiKey: apiKey || undefined,
        enabled: true,
        createdAt: new Date().toISOString(),
      }
      if (isObsidian) {
        newSource.baseUrl = baseUrl || endpoint
        newSource.insecureTls = insecureTls
        await vaultApi.saveObsidianSources([...existing, newSource])
      } else {
        newSource.endpoint = endpoint || baseUrl
        if (isVector) newSource.collection = collection
        if (isVector) {
          await vaultApi.saveVectorSources([...existing, newSource])
        } else {
          await vaultApi.saveKnowledgeSources([...existing, newSource])
        }
      }
      toast('已添加', 'success')
      setName(''); setEndpoint(''); setApiKey(''); setCollection(''); setBaseUrl('')
    } catch (err: any) {
      toast(err.message || '添加失败', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    const src = (sources || []).find((s: any) => s.id === id)
    if (!window.confirm(`确定要删除${isVector ? '向量库' : isObsidian ? 'Obsidian' : '知识库'}「${src?.name || '未命名'}」吗？`)) return
    try {
      const remaining = (sources || []).filter(s => s.id !== id)
      if (isObsidian) {
        await vaultApi.saveObsidianSources(remaining)
      } else if (isVector) {
        await vaultApi.saveVectorSources(remaining)
      } else {
        await vaultApi.saveKnowledgeSources(remaining)
      }
      toast('已删除', 'success')
    } catch (err: any) {
      toast(err.message || '删除失败', 'error')
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs mb-1.5 text-muted-foreground" >名称</label>
          <input className="vm-input" placeholder={isVector ? 'Milvus / Qdrant' : isObsidian ? '我的 Vault' : '公司知识库'}
            value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 text-muted-foreground" >
            {isObsidian ? 'Base URL' : '检索接口 URL'}
          </label>
          <input className="vm-input"
            placeholder={isObsidian ? 'https://127.0.0.1:27124' : 'https://server/search'}
            value={isObsidian ? baseUrl : endpoint}
            onChange={e => isObsidian ? setBaseUrl(e.target.value) : setEndpoint(e.target.value)} />
        </div>
        {isVector && (
          <div>
            <label className="block text-xs mb-1.5 text-muted-foreground" >Collection</label>
            <input className="vm-input" placeholder="personal_docs" value={collection} onChange={e => setCollection(e.target.value)} />
          </div>
        )}
        <div>
          <label className="block text-xs mb-1.5 text-muted-foreground" >API Key（可选）</label>
          <input className="vm-input" type="password" placeholder="可选" value={apiKey} onChange={e => setApiKey(e.target.value)} />
        </div>
      </div>
      {isObsidian && (
        <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'hsl(218 16% 54%)' }}>
          <input type="checkbox" checked={insecureTls} onChange={e => setInsecureTls(e.target.checked)} className="w-3.5 h-3.5" />
          允许自签名 HTTPS 证书
        </label>
      )}
      <Button variant="primary" onClick={handleAdd}>
        <Plus className="w-4 h-4" />
        添加{isVector ? '向量库' : isObsidian ? 'Obsidian' : '知识库'}
      </Button>

      {sources && sources.length > 0 && (
        <div className="mt-4 space-y-2">
          {sources.map((src: any) => (
            <div key={src.id} className="flex items-center gap-3 p-3 rounded"
              style={{ background: 'hsl(218 36% 8%)', border: '1px solid var(--border)' }}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: src.enabled ? 'hsl(152 72% 52%)' : 'hsl(218 16% 40%)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground" >{src.name}</p>
                <p className="text-[10px] text-muted-foreground" >
                  {src.endpoint || src.baseUrl}
                  {src.collection ? ` · ${src.collection}` : ''}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" style={{ color: 'hsl(352 84% 60%)' }} onClick={() => handleDelete(src.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
