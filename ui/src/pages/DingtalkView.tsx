import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  MessageSquare, Bot, Send, Paperclip, Bell, RefreshCw,
  Upload, Download, CheckCircle2, AlertCircle, FileText,
  Users, Hash, ChevronRight, Plus, Zap, Clock, Image,
  File, Archive
} from 'lucide-react'
import { cn } from '@/lib/utils'

type DingTab = 'assistant' | 'files' | 'notify' | 'groups'

const MOCK_CHAT_MESSAGES = [
  { role: 'user',      text: '帮我生成一份本周研发进度总结' },
  { role: 'assistant', text: '好的，以下是根据知识库内容生成的本周研发进度总结：\n\n**本周主要完成：**\n1. 完成了用户鉴权模块的核心逻辑\n2. Redis 缓存层已接入，命中率提升 40%\n3. API 文档更新至 v2.3\n\n**存在问题：**\n- 消息队列延迟在高并发下偶发超时（Issues #42）\n\n**下周计划：**\n- 完成压测并修复队列问题\n- 启动前端重构第一阶段' },
  { role: 'user',      text: '把这份总结推送给研发群' },
  { role: 'assistant', text: '已将进度总结推送至"研发团队"钉钉群，共通知 12 名成员。' },
]

const MOCK_FILES = [
  { name: 'API文档_v2.3.pdf',         type: 'pdf',  size: '2.4 MB', time: '10分钟前', synced: true  },
  { name: '架构图_系统整体.png',         type: 'img',  size: '1.1 MB', time: '1小时前',  synced: true  },
  { name: '需求文档_2026Q2.docx',      type: 'doc',  size: '580 KB', time: '2小时前',  synced: false },
  { name: '周报模板.xlsx',              type: 'xlsx', size: '120 KB', time: '昨天',     synced: true  },
  { name: '合同_第三方服务.zip',         type: 'zip',  size: '8.2 MB', time: '3天前',   synced: false },
]

const MOCK_NOTIFY_HISTORY = [
  { id: 'n1', title: '部署通知',      content: 'v2.3.1 已成功部署到生产环境',   time: '14:32', status: 'success', group: '研发团队' },
  { id: 'n2', title: '告警',          content: 'CPU 使用率超过 85%，请关注',    time: '12:05', status: 'warn',    group: '运维群'   },
  { id: 'n3', title: '周报提醒',      content: '请在今日 18:00 前提交本周周报', time: '09:00', status: 'info',    group: '全员公告' },
  { id: 'n4', title: '代码审核通过',   content: 'PR #156 已通过审核，可合并',   time: '昨天',  status: 'success', group: '研发团队' },
]

const MOCK_GROUPS = [
  { id: 'g1', name: '研发团队',  count: 12, unread: 3,  avatar: '👨‍💻', latest: '刚刚更新了接口文档' },
  { id: 'g2', name: '运维群',    count: 6,  unread: 0,  avatar: '🔧', latest: '服务器巡检完成'   },
  { id: 'g3', name: '产品设计',  count: 8,  unread: 1,  avatar: '🎨', latest: '新版原型已上传'   },
  { id: 'g4', name: '全员公告',  count: 45, unread: 0,  avatar: '📢', latest: '五月假期安排通知' },
]

const FILE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, img: Image, doc: FileText, xlsx: FileText, zip: Archive,
}

export default function DingtalkView() {
  const [tab, setTab] = useState<DingTab>('assistant')
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState(MOCK_CHAT_MESSAGES)
  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyContent, setNotifyContent] = useState('')
  const [notifyGroup, setNotifyGroup] = useState('研发团队')
  const [connected] = useState(true)

  const sendChat = () => {
    if (!chatInput.trim()) return
    setMessages(prev => [...prev,
      { role: 'user', text: chatInput },
      { role: 'assistant', text: '正在处理您的请求，请稍候...' }
    ])
    setChatInput('')
  }

  return (
    <div className="flex flex-col h-full" style={{ maxHeight: 'calc(100vh - 104px)' }}>
      {/* 顶栏状态 */}
      <div className="glass-card rounded-lg mb-4 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: 'linear-gradient(145deg, hsl(200 80% 32%), hsl(210 80% 22%))', border: '1px solid hsl(200 60% 30%)' }}>
            钉
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[hsl(210_30%_90%)]">钉钉集成</span>
              <span className={cn("vm-badge text-[10px]", connected ? "vm-badge-emerald" : "vm-badge-gold")}>
                {connected ? <><CheckCircle2 className="w-2.5 h-2.5" />已连接</> : <><AlertCircle className="w-2.5 h-2.5" />未连接</>}
              </span>
            </div>
            <p className="text-[10px] text-[hsl(218_16%_44%)]">企业: Moonlight Technology · 成员: 48 · 群: 7</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </Button>
          <Button variant="primary" size="sm">
            <Zap className="w-3.5 h-3.5" />
            重新授权
          </Button>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="glass-card rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="flex border-b border-[hsl(218_24%_14%)] px-2 flex-shrink-0">
          {([
            { id: 'assistant' as DingTab, label: 'AI 助手',  icon: Bot          },
            { id: 'files'     as DingTab, label: '文件同步',  icon: Upload       },
            { id: 'notify'    as DingTab, label: '通知推送',  icon: Bell         },
            { id: 'groups'    as DingTab, label: '群组管理',  icon: Users        },
          ] as const).map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-all",
                  tab === t.id ? "border-cyan-400 text-cyan-400" : "border-transparent text-[hsl(218_16%_48%)] hover:text-[hsl(210_30%_72%)]"
                )}>
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* AI 助手 */}
        {tab === 'assistant' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-2.5 max-w-3xl", msg.role === 'user' && "ml-auto flex-row-reverse")}>
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs",
                    msg.role === 'user'
                      ? "bg-[hsl(190_60%_22%)] text-cyan-400"
                      : "bg-[hsl(218_28%_14%)] text-[hsl(218_16%_56%)]"
                  )}>
                    {msg.role === 'user' ? 'U' : <Bot className="w-3.5 h-3.5" />}
                  </div>
                  <div className={cn(
                    "px-3.5 py-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap max-w-xl",
                    msg.role === 'user'
                      ? "text-[hsl(210_30%_90%)] rounded-tr-sm"
                      : "text-[hsl(218_16%_72%)] rounded-tl-sm"
                  )}
                    style={{
                      background: msg.role === 'user'
                        ? 'linear-gradient(135deg, hsl(190 60% 18%), hsl(152 50% 14%))'
                        : 'hsl(218 32% 11%)',
                      border: '1px solid',
                      borderColor: msg.role === 'user' ? 'hsl(190 60% 24% / 0.5)' : 'hsl(218 24% 16%)',
                    }}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* 快捷操作 */}
            <div className="px-4 pb-2 flex gap-2 flex-wrap flex-shrink-0">
              {['生成周报总结', '推送部署通知', '同步文档', '查询群成员'].map(q => (
                <button key={q}
                  onClick={() => setChatInput(q)}
                  className="text-[10px] px-2.5 py-1 rounded-full border border-[hsl(218_24%_20%)] text-[hsl(218_16%_52%)] hover:text-[hsl(190_90%_72%)] hover:border-[hsl(190_60%_24%)] transition-colors">
                  {q}
                </button>
              ))}
            </div>

            {/* 输入框 */}
            <div className="p-4 flex gap-2 border-t border-[hsl(218_24%_14%)] flex-shrink-0">
              <input
                className="vm-input flex-1"
                placeholder="输入指令，AI 将联动知识库和钉钉群组..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
              />
              <Button variant="ghost" size="icon-sm">
                <Paperclip className="w-3.5 h-3.5" />
              </Button>
              <Button variant="primary" size="icon-sm" onClick={sendChat}>
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* 文件同步 */}
        {tab === 'files' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {/* 拖放上传区域 */}
            <div className="rounded-xl border-2 border-dashed border-[hsl(218_24%_18%)] p-6 text-center
              hover:border-[hsl(190_60%_30%)] transition-colors cursor-pointer">
              <Upload className="w-8 h-8 mx-auto mb-2 text-[hsl(218_16%_36%)]" />
              <p className="text-xs text-[hsl(218_16%_48%)]">拖拽文件到此处，或点击选择</p>
              <p className="text-[10px] text-[hsl(218_16%_36%)] mt-1">支持从钉钉群直接同步到知识库</p>
            </div>

            {/* 文件列表 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-xs font-semibold text-[hsl(218_16%_52%)] uppercase tracking-wider">已同步文件</span>
                <Button variant="ghost" size="sm">
                  <Plus className="w-3 h-3" />
                  从钉钉群拉取
                </Button>
              </div>
              {MOCK_FILES.map((file, i) => {
                const Icon = FILE_ICONS[file.type] || File
                return (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[hsl(218_30%_11%)] transition-colors group">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'hsl(218 28% 14%)', border: '1px solid hsl(218 24% 18%)', color: 'hsl(190 90% 60%)' }}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-[hsl(210_30%_86%)] truncate">{file.name}</div>
                      <div className="text-[10px] text-[hsl(218_16%_40%)]">{file.size} · {file.time}</div>
                    </div>
                    <span className={cn("vm-badge text-[9px] flex-shrink-0", file.synced ? "vm-badge-emerald" : "vm-badge-gold")}>
                      {file.synced ? '已同步' : '待同步'}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon-sm" title="下载">
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 通知推送 */}
        {tab === 'notify' && (
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {/* 发送通知 */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[hsl(218_16%_52%)] uppercase tracking-wider">发送新通知</h3>
                <input
                  className="vm-input w-full"
                  placeholder="通知标题"
                  value={notifyTitle}
                  onChange={e => setNotifyTitle(e.target.value)} />
                <textarea
                  className="vm-input w-full"
                  rows={4}
                  placeholder="通知内容（支持 Markdown）"
                  value={notifyContent}
                  onChange={e => setNotifyContent(e.target.value)} />
                <select
                  className="vm-input w-full"
                  value={notifyGroup}
                  onChange={e => setNotifyGroup(e.target.value)}>
                  {MOCK_GROUPS.map(g => <option key={g.id}>{g.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[hsl(218_16%_50%)]">通知类型</label>
                    <select className="vm-input w-full text-xs">
                      <option>普通消息</option>
                      <option>Markdown</option>
                      <option>卡片消息</option>
                      <option>@所有人</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[hsl(218_16%_50%)]">定时发送</label>
                    <select className="vm-input w-full text-xs">
                      <option>立即发送</option>
                      <option>1 小时后</option>
                      <option>明天上午 9:00</option>
                      <option>自定义...</option>
                    </select>
                  </div>
                </div>
                <Button variant="primary" className="w-full"
                  disabled={!notifyTitle.trim() || !notifyContent.trim()}>
                  <Bell className="w-3.5 h-3.5" />
                  推送到 {notifyGroup}
                </Button>
              </div>

              {/* 历史记录 */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[hsl(218_16%_52%)] uppercase tracking-wider">推送历史</h3>
                <div className="space-y-2">
                  {MOCK_NOTIFY_HISTORY.map(n => (
                    <div key={n.id} className="p-3 rounded-lg border border-[hsl(218_24%_14%)] hover:bg-[hsl(218_30%_10%)] transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0",
                          n.status === 'success' ? "bg-[hsl(152_72%_52%)]" :
                          n.status === 'warn'    ? "bg-[hsl(38_90%_60%)]" :
                          "bg-[hsl(190_90%_60%)]"
                        )} />
                        <span className="text-xs font-medium text-[hsl(210_30%_86%)]">{n.title}</span>
                        <span className="ml-auto text-[10px] text-[hsl(218_16%_40%)] flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />{n.time}
                        </span>
                      </div>
                      <p className="text-[11px] text-[hsl(218_16%_56%)] leading-relaxed pl-3.5">{n.content}</p>
                      <div className="flex items-center gap-1 mt-1.5 pl-3.5">
                        <Hash className="w-2.5 h-2.5 text-[hsl(218_16%_40%)]" />
                        <span className="text-[10px] text-[hsl(218_16%_44%)]">{n.group}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 群组管理 */}
        {tab === 'groups' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[hsl(218_16%_52%)] uppercase tracking-wider">已关联群组</span>
              <Button variant="primary" size="sm">
                <Plus className="w-3.5 h-3.5" />
                添加群组
              </Button>
            </div>
            <div className="space-y-2">
              {MOCK_GROUPS.map(g => (
                <div key={g.id} className="flex items-center gap-3 p-3.5 rounded-lg border border-[hsl(218_24%_14%)] hover:bg-[hsl(218_30%_11%)] transition-all group cursor-pointer">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: 'hsl(218 28% 14%)', border: '1px solid hsl(218 24% 20%)' }}>
                    {g.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[hsl(210_30%_88%)]">{g.name}</span>
                      {g.unread > 0 && (
                        <span className="vm-badge vm-badge-cyan text-[9px] min-w-[18px] text-center">
                          {g.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Users className="w-2.5 h-2.5 text-[hsl(218_16%_40%)]" />
                      <span className="text-[10px] text-[hsl(218_16%_44%)]">{g.count} 人</span>
                      <span className="text-[10px] text-[hsl(218_16%_36%)]">·</span>
                      <span className="text-[10px] text-[hsl(218_16%_44%)] truncate">{g.latest}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon-sm" title="发送通知">
                      <MessageSquare className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon-sm">
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
