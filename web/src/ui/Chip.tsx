import type { ReactNode } from 'react'
import './Chip.css'

interface ChipProps {
  children: ReactNode
  selected: boolean
  onClick: () => void
}

export function Chip({ children, selected, onClick }: ChipProps) {
  const classes = ['chip', selected ? 'chip--selected' : ''].filter(Boolean).join(' ')
  return (
    <button type="button" className={classes} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  )
}
