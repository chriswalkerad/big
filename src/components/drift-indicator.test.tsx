import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DriftIndicator } from './drift-indicator'

afterEach(cleanup)

describe('DriftIndicator — Resubmit label contrast on the brand yellow', () => {
  it('labels the yellow Resubmit button with the dark-in-both-themes token, not text-bg', () => {
    render(<DriftIndicator onResubmit={vi.fn()} onUnsubmit={vi.fn()} />)
    const resubmit = screen.getByRole('button', { name: /resubmit/i })
    // bg-accent is the brand yellow; the label must use --on-accent (dark in both
    // themes), never --bg (white in light → 1.53:1).
    expect(resubmit.className).toContain('bg-accent')
    expect(resubmit.className).toContain('text-on-accent')
    expect(resubmit.className).not.toContain('text-bg')
  })
})
