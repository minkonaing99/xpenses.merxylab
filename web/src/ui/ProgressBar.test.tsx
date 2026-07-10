import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  it('renders a fill proportional to value/max, clamped at 100%', () => {
    const { container } = render(<ProgressBar value={6420} max={6000} color="var(--color-error)" />)
    const fill = container.querySelector('.progress-bar__fill') as HTMLElement
    expect(fill.style.width).toBe('100%')
  })

  it('renders a partial fill under the max', () => {
    const { container } = render(<ProgressBar value={1480} max={3000} color="var(--color-primary)" />)
    const fill = container.querySelector('.progress-bar__fill') as HTMLElement
    expect(fill.style.width).toBe('49.333333333333336%')
  })

  it('renders an empty (0%) fill instead of NaN% when max is 0', () => {
    const { container } = render(<ProgressBar value={0} max={0} color="var(--color-primary)" />)
    const fill = container.querySelector('.progress-bar__fill') as HTMLElement
    expect(fill.style.width).toBe('0%')
  })
})
