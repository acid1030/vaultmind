import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageHeroTone = 'cyan' | 'gold' | 'emerald' | 'violet'

interface PageHeroProps {
  eyebrow: string
  title: string
  description: string
  details?: string[]
  tone?: PageHeroTone
  actions?: ReactNode
}

export default function PageHero({
  eyebrow,
  title,
  description,
  details = [],
  tone = 'cyan',
  actions,
}: PageHeroProps) {
  return (
    <section className={cn('vm-page-hero', `vm-page-hero-${tone}`)}>
      <div className="vm-page-hero-copy">
        <span className="vm-page-hero-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {(details.length > 0 || actions) && (
          <div className="vm-page-hero-footer">
            {details.length > 0 && (
              <div className="vm-page-hero-details" aria-label="页面能力">
                {details.map(detail => <span key={detail}>{detail}</span>)}
              </div>
            )}
            {actions && <div className="vm-page-hero-actions">{actions}</div>}
          </div>
        )}
      </div>
    </section>
  )
}
