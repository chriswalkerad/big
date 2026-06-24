import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { ReviewResult, SignalDef } from '@/types'
import { appError } from '@/lib/errors'
import { ResultsDrawer } from './results-drawer'

afterEach(cleanup)

const SIGNALS: SignalDef[] = [
  { id: 'clarity', name: 'Clarity', mode: 'inline', threshold: 7, prompt: '' },
  { id: 'completeness', name: 'Completeness', mode: 'doc', threshold: 7, prompt: '' },
  { id: 'brand_safety', name: 'Brand Safety', mode: 'inline', threshold: 7, prompt: '' },
  { id: 'hook_strength', name: 'Hook Strength', mode: 'doc', threshold: 6, prompt: '' },
  { id: 'character', name: 'Character Distinctiveness', mode: 'doc', threshold: 6, prompt: '' },
  { id: 'franchise_fit', name: 'Franchise Fit', mode: 'doc', threshold: 6, prompt: '' },
]

const REVIEW: ReviewResult = {
  detectedSubtype: 'story_premise',
  suggestedTitle: 'Title',
  themes: [],
  signals: [
    { signalId: 'clarity', score: 4, rationale: 'unclear', issues: [{ quote: 'vague phrase', message: 'unclear', severity: 'minor' }] },
    { signalId: 'completeness', score: 4, rationale: 'missing pieces', issues: [] },
    { signalId: 'brand_safety', score: 9, rationale: 'safe', issues: [] },
    { signalId: 'hook_strength', score: 9, rationale: 'strong', issues: [] },
    { signalId: 'character', score: 3, rationale: 'thin', issues: [] },
    { signalId: 'franchise_fit', score: 6, rationale: 'plausible fit', issues: [] },
  ],
  verdict: { label: 'needs_work', flagCount: 3 },
}

function renderDrawer(props: Partial<React.ComponentProps<typeof ResultsDrawer>> = {}) {
  return render(
    <ResultsDrawer open review={REVIEW} signals={SIGNALS} onClose={() => {}} {...props} />,
  )
}

describe('ResultsDrawer header', () => {
  it('renders the verdict label and flag count from the review', () => {
    renderDrawer()
    expect(screen.getByText('Needs work')).toBeInTheDocument()
    expect(screen.getByText('3 of 6 need attention')).toBeInTheDocument()
  })

  it('renders "Looks ready" with zero flags', () => {
    const review: ReviewResult = { ...REVIEW, verdict: { label: 'looks_ready', flagCount: 0 } }
    renderDrawer({ review })
    expect(screen.getByText('Looks ready')).toBeInTheDocument()
    expect(screen.getByText('0 of 6 need attention')).toBeInTheDocument()
  })

  it('marks not_ready as the most prominent state', () => {
    const review: ReviewResult = { ...REVIEW, verdict: { label: 'not_ready', flagCount: 2 } }
    renderDrawer({ review })
    expect(screen.getByText('Not ready')).toBeInTheDocument()
    expect(screen.getByText('Action needed')).toBeInTheDocument()
  })
})

describe('ResultsDrawer body', () => {
  it('renders a row per signal with name and score', () => {
    renderDrawer()
    expect(screen.getByText('Clarity')).toBeInTheDocument()
    expect(screen.getByText('Franchise Fit')).toBeInTheDocument()
    // Six rows, six meters.
    const meters = screen.getAllByRole('meter')
    expect(meters).toHaveLength(6)
  })

  it('lists flagged phrases only for inline signals', () => {
    renderDrawer()
    expect(screen.getByText('“vague phrase”')).toBeInTheDocument()
  })

  it('fires onPhraseClick with the signal id and quote', () => {
    const onPhraseClick = vi.fn()
    renderDrawer({ onPhraseClick })
    fireEvent.click(screen.getByText('“vague phrase”'))
    expect(onPhraseClick).toHaveBeenCalledWith('clarity', 'vague phrase')
  })

  it('exposes a franchise affordance that fires onFranchiseClick', () => {
    const onFranchiseClick = vi.fn()
    renderDrawer({ onFranchiseClick })
    fireEvent.click(screen.getByText('View franchise'))
    expect(onFranchiseClick).toHaveBeenCalled()
  })
})

describe('ResultsDrawer states', () => {
  it('shows a loading state while reviewing', () => {
    renderDrawer({ loading: true, review: null })
    expect(screen.getByLabelText('Running review…')).toBeInTheDocument()
  })

  it('shows an error state with retry when retryable', () => {
    const onRetry = vi.fn()
    renderDrawer({ error: appError('AI_RATE_LIMIT'), review: null, onRetry })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('emphasises the focused row', () => {
    const { container } = renderDrawer({ focusedSignalId: 'clarity' })
    const focused = container.querySelector('[data-signal-id="clarity"][data-focused="true"]')
    expect(focused).toBeTruthy()
  })
})

describe('ResultsDrawer confirm submission (review-then-confirm)', () => {
  it('shows a Confirm submission button for a pending preview and fires onConfirm', () => {
    const onConfirm = vi.fn()
    renderDrawer({ pending: true, onConfirm })
    const confirm = screen.getByRole('button', { name: /confirm submission/i })
    expect(confirm).toBeInTheDocument()
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('hides Confirm submission for an already-submitted snapshot (not pending)', () => {
    renderDrawer({ onConfirm: () => {} })
    expect(screen.queryByRole('button', { name: /confirm submission/i })).not.toBeInTheDocument()
  })

  it('does not show Confirm submission while loading or on error', () => {
    const onConfirm = vi.fn()
    renderDrawer({ pending: true, loading: true, review: null, onConfirm })
    expect(screen.queryByRole('button', { name: /confirm submission/i })).not.toBeInTheDocument()
    cleanup()
    renderDrawer({ pending: true, error: appError('AI_RATE_LIMIT'), review: null, onConfirm })
    expect(screen.queryByRole('button', { name: /confirm submission/i })).not.toBeInTheDocument()
  })
})
