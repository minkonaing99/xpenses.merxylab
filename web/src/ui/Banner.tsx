import { WarningCircle, CloudSlash, X } from '@phosphor-icons/react'
import './Banner.css'

type BannerTone = 'warning' | 'error'

interface BannerProps {
  tone: BannerTone
  message: string
  onDismiss?: () => void
}

const TONE_ICON = {
  warning: WarningCircle,
  error: CloudSlash,
} as const

export function Banner({ tone, message, onDismiss }: BannerProps) {
  const Icon = TONE_ICON[tone]
  return (
    <div className={`banner banner--${tone}`}>
      <Icon size={20} weight="fill" className="banner__icon" aria-hidden="true" />
      <p className="banner__message">{message}</p>
      {onDismiss && (
        <button type="button" className="banner__dismiss" aria-label="Dismiss" onClick={onDismiss}>
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
