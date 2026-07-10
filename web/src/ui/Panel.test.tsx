import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Panel } from './Panel'

describe('Panel', () => {
  it('renders children inside a single elevated surface', () => {
    render(
      <Panel>
        <p>Recent</p>
      </Panel>,
    )
    expect(screen.getByText('Recent')).toBeInTheDocument()
  })
})
