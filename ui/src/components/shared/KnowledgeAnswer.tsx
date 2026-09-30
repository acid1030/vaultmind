import { Fragment } from 'react'
import { ArrowUpRight, FileText, ShieldCheck } from 'lucide-react'
import type { Evidence } from '@/lib/ipc'

type AnswerBlock =
  | { type: 'heading'; text: string; level: number }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; text: string; language: string }

function parseAnswer(value: string): AnswerBlock[] {
  const lines = String(value || '').replace(/\r\n/g, '\n').split('\n')
  const blocks: AnswerBlock[] = []
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim()
    if (!line) { index += 1; continue }
    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const code: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith('```')) code.push(lines[index++])
      if (index < lines.length) index += 1
      blocks.push({ type: 'code', text: code.join('\n'), language })
      continue
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      index += 1
      continue
    }
    const listMatch = line.match(/^(?:([-*])|(\d+)\.)\s+(.+)$/)
    if (listMatch) {
      const ordered = Boolean(listMatch[2])
      const items: string[] = []
      while (index < lines.length) {
        const next = lines[index].trim().match(/^(?:([-*])|(\d+)\.)\s+(.+)$/)
        if (!next || Boolean(next[2]) !== ordered) break
        items.push(next[3])
        index += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }
    const paragraph = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !/^(?:#{1,3}\s|```|[-*]\s|\d+\.\s)/.test(lines[index].trim())) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
  }
  return blocks
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean)
  return <>{parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    return <Fragment key={index}>{part}</Fragment>
  })}</>
}

interface KnowledgeAnswerProps {
  content: string
  evidence?: Evidence[]
  onOpenEvidence?: (evidence: Evidence) => void
}

export default function KnowledgeAnswer({ content, evidence = [], onOpenEvidence }: KnowledgeAnswerProps) {
  const blocks = parseAnswer(content)
  const sources = evidence.filter(item => !item.isHint).slice(0, 6)
  return (
    <div className="vm-answer">
      <div className="vm-answer-body">
        {blocks.map((block, index) => {
          if (block.type === 'heading') return <h3 key={index} data-level={block.level}><InlineText text={block.text} /></h3>
          if (block.type === 'code') return <pre key={index}><span>{block.language || 'TEXT'}</span><code>{block.text}</code></pre>
          if (block.type === 'list') {
            const List = block.ordered ? 'ol' : 'ul'
            return <List key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><InlineText text={item} /></li>)}</List>
          }
          return <p key={index}><InlineText text={block.text} /></p>
        })}
      </div>
      {sources.length > 0 && (
        <div className="vm-answer-sources">
          <div className="vm-answer-sources-heading"><ShieldCheck className="w-3.5 h-3.5" />参考来源 <span>{sources.length}</span></div>
          <div className="vm-answer-source-grid">
            {sources.map((item, index) => {
              const openEvidence = onOpenEvidence
              const canOpen = Boolean(openEvidence && item.assetId)
              const SourceTag = canOpen ? 'button' : 'div'
              return (
                <SourceTag key={`${item.source}-${item.title}-${index}`} className="vm-answer-source" onClick={canOpen && openEvidence ? () => openEvidence(item) : undefined}>
                  <span className="vm-answer-source-icon"><FileText className="w-3.5 h-3.5" /></span>
                  <span className="min-w-0 flex-1">
                    <strong>{item.title || '未命名资料'}</strong>
                    <small>{item.source || '知识库'} · {item.kind || item.type || '资料'}</small>
                    {item.content && <p>{item.content.slice(0, 180)}</p>}
                  </span>
                  {canOpen && <ArrowUpRight className="w-3.5 h-3.5" />}
                </SourceTag>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
