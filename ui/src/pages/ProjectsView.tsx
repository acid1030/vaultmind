import { useState } from 'react'
import { GitBranch, Clock, Columns, Bug } from 'lucide-react'
import GitPanel from '../components/project/GitPanel'
import CommitTimeline from '../components/project/CommitTimeline'
import KanbanBoard from '../components/project/KanbanBoard'
import IssueTracker from '../components/project/IssueTracker'

type ProjectTab = 'git' | 'timeline' | 'kanban' | 'issues'

const TABS: { id: ProjectTab; label: string; icon: React.ElementType }[] = [
  { id: 'git',      label: 'Git 面板',  icon: GitBranch },
  { id: 'timeline', label: '提交时间线', icon: Clock     },
  { id: 'kanban',   label: '看板',      icon: Columns   },
  { id: 'issues',   label: 'Issue',     icon: Bug       },
]

export default function ProjectsView() {
  const [activeTab, setActiveTab] = useState<ProjectTab>('git')

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="glass-panel border-b border-white/5 px-6 py-0 flex-shrink-0">
        <div className="flex gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all duration-200
                  ${active
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-white/20'
                  }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'git'      && <GitPanel />}
        {activeTab === 'timeline' && <CommitTimeline />}
        {activeTab === 'kanban'   && <KanbanBoard />}
        {activeTab === 'issues'   && <IssueTracker />}
      </div>
    </div>
  )
}
