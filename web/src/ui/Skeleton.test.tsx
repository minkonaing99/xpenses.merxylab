import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('renders a placeholder block with the given width and height', () => {
    const { container } = render(<Skeleton width="60%" height="14px" />)
    const el = container.firstElementChild as HTMLElement
    expect(el).toHaveStyle({ width: '60%', height: '14px' })
  })

  it('is hidden from assistive tech', () => {
    const { container } = render(<Skeleton width="40px" height="40px" circle />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
