import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.css'

// Not yet consumed: none of the four v1 screens need a standalone full-width
// CTA. Reserved per docs/DESIGN.md Component Inventory for future screens.

type ButtonVariant = 'primary' | 'secondary' | 'destructive'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: ButtonVariant
}

export function Button({ children, variant = 'primary', className, ...rest }: ButtonProps) {
  const classes = ['button', `button--${variant}`, className].filter(Boolean).join(' ')
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  )
}
