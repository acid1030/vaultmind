import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, X, Calendar, User, Tag, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

type Status = 'todo' | 'doing' | 'review' | 'done'

interface Task {
  id: string
  title: string
  labels: string[]
  assignee: string
  initials: string
  due?: string
  priority: 'high' | 'mid' | 'low'
}

const LABEL_COLORS: Record<string, string> = {
  'feat': 'hsl(190 60% 20% / 0.5)',
  'bug': 'hsl(352 50% 20% / 0.5)',
  'docs': 'hsl(43 60% 20% / 0.5)',
  'refactor': 'hsl(262 50% 20% / 0.5)',
  'test': 'hsl(152 50% 20% / 0.5)',
  'chore': 'hsl(218 28% 18% / 0.5)',
}
const LABEL_TEXT: Record<string, string> = {
  'feat': 'hsl(190 90% 68%)',
  'bug': 'hsl(352 84% 72%)',
  'docs': 'hsl(43 90% 68%)',
  'refactor': 'hsl(262 80% 78%)',
  'test': 'hsl(152 72% 62%)',
  'chore': 'hsl(218 16% 56%)',
}
const PRIORITY_COLORS: Record<string, string> = {
  high: 'hsl(352 80% 60%)',
  mid: 'hsl(43 90% 60%)',
  low: 'hsl(218 16% 50%)',
}

const INITIAL_TASKS: Record<Status, Task[]> = {
  todo: [
    { id: 't1', title: '实现 WebDAV 同步适配器', labels: ['feat'], assignee: 'Alice', initials: 'AL', due: '06-10', priority: 'high' },
    { id: 't2', title: '添加 TOTP 导入功能', labels: ['feat'], assignee: 'Bob', initials: 'BW', due: '06-15', priority: 'mid' },
    { id: 't3', title: '修复 SQLite 大文件写入崩溃', labels: ['bug'], assignee: '', initials: '', priority: 'high' },
  ],
  doing: [
    { id: 't4', title: '项目管理 Git 面板重构', labels: ['refactor', 'feat'], assignee: 'Carol', initials: 'CL', due: '06-08', priority: 'high' },
    { id: 't5', title: '多云存储配置 UI', labels: ['feat'], assignee: 'Alice', initials: 'AL', due: '06-09', priority: 'mid' },
  ],
  review: [
    { id: 't6', title: '飞书 Wiki 检索集成', labels: ['feat'], assignee: 'David', initials: 'DZ', due: '06-05', priority: 'mid' },
  ],
  done: [
    { id: 't7', title: '登录页面 UI 重设计', labels: ['feat'], assignee: 'Alice', initials: 'AL', priority: 'low' },
    { id: 't8', title: '用户组密钥轮换修复', labels: ['bug'], assignee: 'Bob', initials: 'BW', priority: 'mid' },
  ],
}

const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: 'todo', label: '待办', color: 'hsl(218 16% 50%)' },
  { id: 'doing', label: '进行中', color: 'hsl(190 90% 60%)' },
  { id: 'review', label: '评审中', color: 'hsl(43 90% 60%)' },
  { id: 'done', label: '已完成', color: 'hsl(152 72% 52%)' },
]

const AVATAR_COLORS: Record<string, string> = {
  AL: 'linear-gradient(135deg, hsl(190 60% 24%), hsl(190 80% 32%))',
  BW: 'linear-gradient(135deg, hsl(262 50% 28%), hsl(262 70% 38%))',
  CL: 'linear-gradient(135deg, hsl(152 50% 20%), hsl(152 60% 30%))',
  DZ: 'linear-gradient(135deg, hsl(43 60% 24%), hsl(43 80% 36%))',
}

export default function KanbanBoard() {
  const [tasks, setTasks] = useState(INITIAL_TASKS)
  const [showAdd, setShowAdd] = useState<Status | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [draggedTask, setDraggedTask] = useState<{ id: string; from: Status } | null>(null)

  const addTask = (col: Status) => {
    if (!newTitle.trim()) return
    const id = `task-${Date.now()}`
    setTasks(prev => ({
      ...prev,
      [col]: [...prev[col], { id, title: newTitle, labels: [], assignee: '', initials: '', priority: 'mid' }]
    }))
    setNewTitle('')
    setShowAdd(null)
  }

  const removeTask = (col: Status, id: string) => {
    setTasks(prev => ({ ...prev, [col]: prev[col].filter(t => t.id !== id) }))
  }

  const onDragStart = (id: string, from: Status) => setDraggedTask({ id, from })

  const onDrop = (to: Status) => {
    if (!draggedTask || draggedTask.from === to) return
    const task = tasks[draggedTask.from].find(t => t.id === draggedTask.id)
    if (!task) return
    setTasks(prev => ({
      ...prev,
      [draggedTask.from]: prev[draggedTask.from].filter(t => t.id !== draggedTask.id),
      [to]: [...prev[to], task],
    }))
    setDraggedTask(null)
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)', height: 'calc(100vh - 180px)' }}>
      {COLUMNS.map(col => (
        <div key={col.id}
          className="flex flex-col gap-2 rounded-xl p-3"
          style={{ background: 'hsl(218 36% 7% / 0.6)', border: '1px solid hsl(218 24% 13%)' }}
          onDragOver={e => e.preventDefault()}
          onDrop={() => onDrop(col.id)}>

          {/* 列头 */}
          <div className="flex items-center justify-between px-1 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
              <span className="text-xs font-semibold" style={{ color: 'hsl(210 30% 82%)' }}>{col.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-sm"
                style={{ background: 'hsl(218 28% 14%)', color: 'hsl(218 16% 48%)' }}>
                {tasks[col.id].length}
              </span>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setShowAdd(col.id)}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* 新建输入 */}
          {showAdd === col.id && (
            <div className="rounded-lg p-3 space-y-2 animate-fade-in"
              style={{ background: 'hsl(218 30% 11%)', border: '1px solid hsl(218 24% 18%)' }}>
              <input className="vm-input text-xs h-8" placeholder="任务标题..."
                value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask(col.id)}
                autoFocus />
              <div className="flex gap-1.5">
                <Button variant="primary" size="sm" className="flex-1 text-xs h-7" onClick={() => addTask(col.id)}>添加</Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowAdd(null)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {/* 任务卡片 */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
            {tasks[col.id].map(task => (
              <div key={task.id}
                draggable
                onDragStart={() => onDragStart(task.id, col.id)}
                className="rounded-lg p-3 cursor-grab active:cursor-grabbing group transition-all"
                style={{
                  background: 'hsl(218 30% 10%)',
                  border: `1px solid hsl(218 24% 16%)`,
                }}>
                {/* 优先级指示 + 拖拽 */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: PRIORITY_COLORS[task.priority] }} />
                  <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'hsl(218 16% 40%)' }} />
                  <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon-sm" className="h-6 w-6"
                      onClick={() => removeTask(col.id, task.id)}>
                      <X className="w-2.5 h-2.5" />
                    </Button>
                  </div>
                </div>

                {/* 标题 */}
                <p className="text-xs font-medium leading-relaxed mb-2.5" style={{ color: 'hsl(210 30% 88%)' }}>
                  {task.title}
                </p>

                {/* 标签 */}
                {task.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2.5">
                    {task.labels.map(l => (
                      <span key={l} className="text-[10px] px-1.5 py-0.5 rounded-sm font-medium"
                        style={{
                          background: LABEL_COLORS[l] || 'hsl(218 28% 16%)',
                          color: LABEL_TEXT[l] || 'hsl(218 16% 60%)',
                          border: `1px solid ${LABEL_COLORS[l]?.replace('/ 0.5', '/ 0.8') || 'hsl(218 24% 20%)'}`,
                        }}>
                        {l}
                      </span>
                    ))}
                  </div>
                )}

                {/* 底部：指派人 + 截止日期 */}
                <div className="flex items-center justify-between">
                  {task.initials ? (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{ background: AVATAR_COLORS[task.initials] || 'hsl(218 30% 18%)', color: 'white' }}>
                      {task.initials}
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border border-dashed flex items-center justify-center"
                      style={{ borderColor: 'hsl(218 24% 22%)' }}>
                      <User className="w-3 h-3" style={{ color: 'hsl(218 16% 40%)' }} />
                    </div>
                  )}
                  {task.due && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" style={{ color: 'hsl(218 16% 42%)' }} />
                      <span className="text-[10px]" style={{ color: 'hsl(218 16% 44%)' }}>{task.due}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
