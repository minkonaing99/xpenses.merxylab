import type { HTMLAttributes, ReactNode } from 'react'
import './Panel.css'

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

// The winning bake-off direction: one flat elevated surface per screen,
// grouped content inside it — not repeated card grids (see PRODUCT.md anti-references).
export function Panel({ children, className, ...rest }: PanelProps) {
  const classes = ['panel', className].filter(Boolean).join(' ')
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
