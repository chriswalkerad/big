import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import type { SignalDef, SignalResult } from '@/types'
import { SignalRow } from './signal-row'

afterEach(cleanup)

const DEF: SignalDef = { id: 'clarity', name: 'Clarity', mode: 'inline', threshold: 70, prompt: '' }

function result(severity: 'risk' | 'minor'): SignalResult {
  return {
    signalId: 'clarity',
    score: 40,
    rationale: 'unclear',
    issues: [{ quote: 'vague phrase', message: 'be specific', severity }],
  }
}

describe('SignalRow — severity is not color-only', () => {
  it('marks a risk phrase with a visually-hidden "Risk:" text marker', () => {
    render(<SignalRow def={DEF} result={result('risk')} inline />)
    const quote = screen.getByText('“vague phrase”')
    expect(within(quote).getByText('Risk:', { exact: false })).toBeInTheDocument()
  })

  it('marks a minor phrase with a visually-hidden "Suggestion:" text marker', () => {
    render(<SignalRow def={DEF} result={result('minor')} inline />)
    const quote = screen.getByText('“vague phrase”')
    expect(within(quote).getByText('Suggestion:', { exact: false })).toBeInTheDocument()
  })

  it('names the phrase button as a navigation affordance (sr-only suffix)', () => {
    render(<SignalRow def={DEF} result={result('risk')} inline />)
    // The accessible name includes the quote + message + the "go to this phrase" suffix.
    expect(
      screen.getByRole('button', { name: /vague phrase.*go to this phrase/i }),
    ).toBeInTheDocument()
  })
})

describe('SignalRow — pass/flag is not color-only', () => {
  it('states a flagged signal with its threshold for assistive tech', () => {
    // score 40 < threshold 70 → flagged.
    render(<SignalRow def={DEF} result={result('risk')} inline />)
    expect(
      screen.getByText('Clarity, 40 out of 100, below threshold 70 — flagged.'),
    ).toBeInTheDocument()
  })

  it('states a passing signal with its threshold for assistive tech', () => {
    const passing: SignalResult = { signalId: 'clarity', score: 80, rationale: 'clear', issues: [] }
    render(<SignalRow def={DEF} result={passing} />)
    expect(
      screen.getByText('Clarity, 80 out of 100, meets threshold 70 — passes.'),
    ).toBeInTheDocument()
  })
})
