import { useState, type ReactNode } from 'react'
import { ArrowRight, BookOpen, Check, Cloud, Monitor, RefreshCw, Users } from 'lucide-react'
import { useAppStore } from '@/store/app'
import { effectiveContentKind } from '@/lib/content-kind'
import { tagDistribution } from '@/lib/dashboard'
import KnowledgeOrb from './KnowledgeOrb'

type View = 'library' | 'vault' | 'add' | 'chat' | 'groups' | 'sync'
export default function WorkbenchOverview({ onNavigate, children }: { onNavigate: (view: View) => void; children: ReactNode }) {
  const { state } = useAppStore()
  const [mode, setMode] = useState('all')
  const items = state?.items || [], records = state?.records || [], groups = state?.groups || []
  const devices = state?.accountSync?.devices.filter(device => device.status === 'active') || []
  const tags = tagDistribution(items)
  const shared = items.filter(item => item.scope === 'group')
  const cloud = Boolean(state?.isFeishuLoggedIn), linked = Boolean(state?.accountSync?.linked)
  const sync = state?.autoSync
  const syncLabel = !cloud ? '尚未连接飞书' : !linked ? '待绑定云端账号' : sync?.status === 'syncing' ? '正在同步' : sync?.lastError ? '同步需要处理' : sync?.lastSuccessAt ? '最近同步成功' : '等待首次同步'
  const kinds = [{ id: 'file', label: '文件', color: 'var(--console-cyan)' }, { id: 'text', label: '文本', color: 'var(--console-green)' }, { id: 'secret', label: '凭据', color: 'var(--console-gold)' }, { id: 'web', label: '链接', color: 'var(--console-pink)' }, { id: 'video', label: '视频', color: '262 50% 62%' }]
  const events = [
    ...items.map(item => ({ id: `item:${item.id}`, time: item.downloadedAt, label: item.remoteOnly ? '云端内容' : '内容入库', title: item.title || item.name, view: (effectiveContentKind(item) === 'secret' ? 'vault' : 'library') as View })),
    ...records.map(record => ({ id: `record:${record.id}`, time: record.uploadedAt, label: '加密上传', title: record.fileName, view: 'sync' as View })),
  ].filter(event => event.time && Number.isFinite(Date.parse(event.time))).sort((a, b) => Date.parse(b.time) - Date.parse(a.time)).slice(0, 5)
  const time = (value: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '暂无记录'
  const distributions = mode === 'tags' ? tags.slice(0, 5).map((tag, index) => ({ ...tag, color: kinds[index % kinds.length].color })) : kinds.map(kind => ({ ...kind, count: items.filter(item => effectiveContentKind(item) === kind.id).length }))
  return <section className="vm-dashboard-panels" aria-label="知识中枢实时数据">
    <article className="glass-card vm-orb-panel" aria-label="知识网络图谱">
      <div className="vm-section-heading"><h2>知识网络图谱 <small>KNOWLEDGE NETWORK</small></h2><div className="vm-orb-tabs" role="group" aria-label="图谱视图">{[{ id: 'all', label: '全局' }, { id: 'types', label: '分类' }, { id: 'tags', label: '标签' }].map(tab => <button key={tab.id} aria-pressed={mode === tab.id} onClick={() => setMode(tab.id)}>{tab.label}</button>)}</div></div>
      <div className="vm-orb-stage">
        <dl className="vm-orb-metrics"><div><dt>内容节点</dt><dd>{items.length.toLocaleString()}</dd></div><div><dt>有效标签</dt><dd>{tags.length}</dd></div><div><dt>共享条目</dt><dd>{shared.length}</dd></div><div><dt>本机可用</dt><dd>{items.filter(item => !item.remoteOnly).length}</dd></div></dl>
        <div className="vm-orb-visual"><KnowledgeOrb mode={mode} /><small>空间粒子视效 · 非语义关系推断</small></div>
        <div className="vm-orb-breakdown"><h3>{mode === 'tags' ? '标签分布 · Top 5' : '内容类型分布'}</h3>{mode === 'tags' && <p className="vm-tag-coverage-note">条目覆盖率 · 多标签可重叠</p>}{distributions.length ? distributions.map(entry => <div key={entry.label} style={{ '--asset-color': entry.color } as React.CSSProperties}><span><i />{entry.label}</span><strong>{items.length ? `${(entry.count / items.length * 100).toFixed(1)}%` : '0%'}</strong><em style={{ width: `${items.length ? Math.min(100, entry.count / items.length * 100) : 0}%` }} /></div>) : <p>添加标签后显示分布</p>}<footer><span>云端记录 <b>{records.length}</b></span><span>待取回 <b>{items.filter(item => item.remoteOnly).length}</b></span></footer></div>
      </div>
    </article>
    <div className="vm-dashboard-right">
      <article className="glass-card vm-activity-panel"><div className="vm-section-heading"><h2>最近活动 <small>ACTIVITY</small></h2><span className="vm-badge">{events.length} 条</span></div>
        {events.length ? <ol className="vm-activity-list">{events.map(event => <li key={event.id}><button onClick={() => onNavigate(event.view)}><time>{time(event.time)}</time><span className="vm-event-label">{event.label}</span><strong title={event.title}>{event.title}</strong><ArrowRight className="w-3 h-3" /></button></li>)}</ol> : <div className="vm-empty py-7"><BookOpen className="w-6 h-6" /><p>暂无内容活动</p><button className="vm-network-link" onClick={() => onNavigate('add')}>添加第一条内容</button></div>}
        <p className="vm-dashboard-caption">按入库与上传时间整理</p>
      </article>
      <article className="glass-card vm-sync-health"><div className="vm-section-heading"><h2>同步状态 <small>SYNC STATUS</small></h2><button className="vm-network-link" onClick={() => onNavigate('sync')}>查看详情 <ArrowRight className="w-3 h-3" /></button></div><button className="vm-sync-health-body" onClick={() => onNavigate('sync')}><span className={`vm-status-ring ${cloud && linked && !sync?.lastError ? 'ready' : ''}`}>{sync?.status === 'syncing' ? <RefreshCw className="animate-spin" /> : cloud && linked && sync?.lastSuccessAt && !sync.lastError ? <Check /> : <Cloud />}</span><span><strong>{syncLabel}</strong><small>上次成功：{time(sync?.lastSuccessAt || '')}</small><small>{sync?.lastError ? '进入同步中心查看原因' : cloud ? '加密上传 · 按间隔更新' : '连接飞书后开启多端同步'}</small></span></button></article>
    </div>
    <div className="vm-dashboard-bottom">
      {children}
      <article className="glass-card vm-team-panel"><div className="vm-section-heading"><h2>团队协作 <small>COLLABORATION</small></h2><button className="vm-network-link" onClick={() => onNavigate('groups')}>查看团队 <ArrowRight className="w-3 h-3" /></button></div>
        <div className="vm-team-totals"><button onClick={() => onNavigate('groups')}><strong>{groups.length}</strong><span>用户组</span></button><button onClick={() => onNavigate('library')}><strong>{shared.length}</strong><span>共享内容</span></button><button onClick={() => onNavigate('groups')}><strong>{state?.pendingInvites.length || 0}</strong><span>待处理邀请</span></button></div>
        <h3 className="vm-team-subtitle">协作空间</h3><div className="vm-team-list">{groups.length ? groups.slice(0, 4).map(group => <button key={group.id} onClick={() => onNavigate('groups')}><span className="vm-team-avatar">{group.name.charAt(0)}</span><span><strong>{group.name}</strong><small>{{ owner: '所有者', admin: '管理员', member: '成员', viewer: '只读' }[group.role] || group.role} · {items.filter(item => item.groupId === group.id).length} 项可见内容</small></span><ArrowRight className="w-3 h-3" /></button>) : <div className="vm-empty py-6"><Users className="w-6 h-6" /><p>还没有协作空间</p><button className="vm-network-link" onClick={() => onNavigate('groups')}>创建或加入用户组</button></div>}</div>
        <button className="vm-workbench-connection" onClick={() => onNavigate('chat')}>打开个人留言与群聊 <ArrowRight className="w-3 h-3" /></button>
      </article>
      <article className="glass-card vm-device-panel"><div className="vm-section-heading"><h2>设备同步 <small>DEVICE SYNC</small></h2><button className="vm-network-link" onClick={() => onNavigate('sync')}>管理 <ArrowRight className="w-3 h-3" /></button></div>
        <div className="vm-device-total"><span className={`vm-status-ring ${linked ? 'ready' : ''}`}><Monitor /></span><div><strong>{linked ? devices.length : 1}</strong><span>{linked ? '台授权设备' : '台本机设备'}</span><small>{linked ? '授权设备不等于全部已同步' : '尚未绑定云端账号'}</small></div></div>
        <div className="vm-workbench-devices">{devices.length ? devices.slice(0, 4).map(device => <div key={device.id}><Monitor className="w-4 h-4" /><span><strong>{device.name}{device.current ? ' · 本机' : ''}</strong><small>{device.platform} · {time(device.lastSeenAt)}</small></span><em>{device.current ? '当前设备' : device.online ? '近期活跃' : '未活跃'}</em></div>) : <div><Monitor className="w-4 h-4" /><span><strong>{state?.accountSync?.deviceName || '当前设备'}</strong><small>内容保存在本机</small></span></div>}</div>
      </article>
    </div>
  </section>
}
