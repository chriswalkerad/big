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
})
