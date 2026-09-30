import appIcon from '@/assets/app-icon-axonmind.png'
import { cn } from '@/lib/utils'

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  decorative?: boolean
}

const SIZE_CLASSES = {
  sm: 'w-9 h-9 rounded-[11px]',
  md: 'w-12 h-12 rounded-[14px]',
  lg: 'w-[72px] h-[72px] rounded-[20px]',
}

export default function BrandMark({ size = 'md', className, decorative = false }: BrandMarkProps) {
  return (
    <span className={cn('vm-brand-image-wrap', SIZE_CLASSES[size], className)} aria-hidden={decorative || undefined}>
      <img src={appIcon} alt={decorative ? '' : 'AxonMind'} className="w-full h-full object-cover" draggable={false} />
    </span>
  )
}
