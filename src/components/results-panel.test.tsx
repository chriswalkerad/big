import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { ReviewResult, SignalDef } from '@/types'
import { appError } from '@/lib/errors'
import { ResultsPanel } from './results-panel'

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

function renderPanel(props: Partial<React.ComponentProps<typeof ResultsPanel>> = {}) {
  return render(<ResultsPanel review={REVIEW} signals={SIGNALS} {...props} />)
}

describe('ResultsPanel header', () => {
  it('renders the verdict label and flag count from the review', () => {
    renderPanel()
    expect(screen.getByText('Needs work')).toBeInTheDocument()
    expect(screen.getByText('3 of 6 need attention')).toBeInTheDocument()
  })

  it('renders "Looks ready" with zero flags', () => {
    const review: ReviewResult = { ...REVIEW, verdict: { label: 'looks_ready', flagCount: 0 } }
    renderPanel({ review })
    expect(screen.getByText('Looks ready')).toBeInTheDocument()
    expect(screen.getByText('0 of 6 need attention')).toBeInTheDocument()
  })

  it('marks not_ready as the most prominent state', () => {
    const review: ReviewResult = { ...REVIEW, verdict: { label: 'not_ready', flagCount: 2 } }
    renderPanel({ review })
    expect(screen.getByText('Not ready')).toBeInTheDocument()
    expect(screen.getByText('Action needed')).toBeInTheDocument()
  })

  it('exposes a labelled "Review results" region (inline, not a dialog)', () => {
    renderPanel()
    expect(screen.getByRole('region', { name: 'Review results' })).toBeInTheDocument()
    // The old bottom-sheet dialog and its dismiss affordance are gone.
    expect(screen.queryByRole('dialog', { name: 'Review results' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /dismiss results/i })).not.toBeInTheDocument()
  })
})

describe('ResultsPanel body', () => {
  it('renders a row per signal with name and score', () => {
    renderPanel()
    expect(screen.getByText('Clarity')).toBeInTheDocument()
    expect(screen.getByText('Franchise Fit')).toBeInTheDocument()
    // Six rows, six meters.
    const meters = screen.getAllByRole('meter')
    expect(meters).toHaveLength(6)
  })

  it('renders NOTHING when there is no review, run, or error (hide-until-review)', () => {
    const { container } = renderPanel({ review: null })
    // No verdict, no "0 of N", no empty placeholder — the whole review section is hidden
    // until a review exists. The drawer above it still shows metadata + Run review.
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('region', { name: 'Review results' })).not.toBeInTheDocument()
    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
    expect(screen.queryByText('No review yet.')).not.toBeInTheDocument()
  })

  it('lists flagged phrases only for inline signals', () => {
    renderPanel()
    expect(screen.getByText('“vague phrase”')).toBeInTheDocument()
  })

  it('fires onPhraseClick with the signal id and quote', () => {
    const onPhraseClick = vi.fn()
    renderPanel({ onPhraseClick })
    fireEvent.click(screen.getByText('“vague phrase”'))
    expect(onPhraseClick).toHaveBeenCalledWith('clarity', 'vague phrase')
  })

  it('exposes a franchise affordance that fires onFranchiseClick', () => {
    const onFranchiseClick = vi.fn()
    renderPanel({ onFranchiseClick })
    fireEvent.click(screen.getByText('View franchise'))
    expect(onFranchiseClick).toHaveBeenCalled()
  })
})

describe('ResultsPanel summary + suggested prompt (Apply)', () => {
  const REVIEW_WITH_SUMMARY: ReviewResult = {
    ...REVIEW,
    summary: 'Tighten Character Distinctiveness and resubmit.',
    suggestedPrompt: 'Revise the following concept:\n\n[paste your text here]',
  }

  it('renders the summary above the signal rows when present', () => {
    renderPanel({ review: REVIEW_WITH_SUMMARY })
    expect(screen.getByText('Summary — what to do')).toBeInTheDocument()
    expect(
      screen.getByText('Tighten Character Distinctiveness and resubmit.'),
    ).toBeInTheDocument()
    // Signal rows still render alongside the summary.
    expect(screen.getByText('Clarity')).toBeInTheDocument()
  })

  it('renders the suggested prompt with an Apply button (replacing Copy)', () => {
    renderPanel({ review: REVIEW_WITH_SUMMARY, onApplyPrompt: () => {} })
    expect(screen.getByText('Suggested prompt')).toBeInTheDocument()
    expect(
      screen.getByText('Revise the following concept:', { exact: false }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /apply suggested prompt/i })).toBeInTheDocument()
    // The old clipboard "Copy" button is gone.
    expect(screen.queryByRole('button', { name: /copy suggested prompt/i })).not.toBeInTheDocument()
  })

  it('fires onApplyPrompt when the Apply button is clicked', () => {
    const onApplyPrompt = vi.fn()
    renderPanel({ review: REVIEW_WITH_SUMMARY, onApplyPrompt })
    fireEvent.click(screen.getByRole('button', { name: /apply suggested prompt/i }))
    expect(onApplyPrompt).toHaveBeenCalledTimes(1)
  })

  it('shows a busy/disabled Apply button while applying', () => {
    renderPanel({ review: REVIEW_WITH_SUMMARY, onApplyPrompt: () => {}, applying: true })
    const apply = screen.getByRole('button', { name: /apply suggested prompt/i })
    expect(apply).toBeDisabled()
    expect(apply).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Applying…')).toBeInTheDocument()
  })

  it('omits the Apply button when no onApplyPrompt handler is provided', () => {
    renderPanel({ review: REVIEW_WITH_SUMMARY })
    expect(screen.getByText('Suggested prompt')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /apply suggested prompt/i })).not.toBeInTheDocument()
  })

  it('omits the summary block when no summary is provided', () => {
    renderPanel()
    expect(screen.queryByText('Summary — what to do')).not.toBeInTheDocument()
  })

  it('renders the summary without a prompt block when suggestedPrompt is absent', () => {
    const review: ReviewResult = { ...REVIEW, summary: 'Do a final proofread.' }
    renderPanel({ review, onApplyPrompt: () => {} })
    expect(screen.getByText('Do a final proofread.')).toBeInTheDocument()
    expect(screen.queryByText('Suggested prompt')).not.toBeInTheDocument()
    // No prompt → no Apply affordance.
    expect(screen.queryByRole('button', { name: /apply suggested prompt/i })).not.toBeInTheDocument()
  })
})

describe('ResultsPanel states', () => {
  it('shows a loading state while reviewing', () => {
    renderPanel({ loading: true, review: null })
    expect(screen.getByLabelText('Running review…')).toBeInTheDocument()
  })

  it('shows an error state with retry when retryable', () => {
    const onRetry = vi.fn()
    renderPanel({ error: appError('AI_RATE_LIMIT'), review: null, onRetry })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('emphasises the focused row', () => {
    const { container } = renderPanel({ focusedSignalId: 'clarity' })
    const focused = container.querySelector('[data-signal-id="clarity"][data-focused="true"]')
    expect(focused).toBeTruthy()
  })
})

describe('ResultsPanel score explanation', () => {
  function toggle() {
    return screen.getByRole('button', { name: /how is this calculated\?/i })
  }

  it('offers the "How is this calculated?" toggle for a settled review', () => {
    renderPanel()
    const button = toggle()
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('does not offer the toggle while loading or on error', () => {
    renderPanel({ loading: true, review: null })
    expect(screen.queryByRole('button', { name: /how is this calculated\?/i })).not.toBeInTheDocument()
    cleanup()
    renderPanel({ error: appError('AI_RATE_LIMIT'), review: null })
    expect(screen.queryByRole('button', { name: /how is this calculated\?/i })).not.toBeInTheDocument()
  })

  it('replaces the signal rows with the explanation when toggled on', () => {
    renderPanel()
    // Rows visible first (one meter per signal).
    expect(screen.getAllByRole('meter')).toHaveLength(6)
    fireEvent.click(toggle())
    // Explanation panel is shown; the score-bar meters are gone.
    expect(screen.getByRole('region', { name: /how the score is calculated/i })).toBeInTheDocument()
    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
    // Toggle reflects the open state.
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  })

  it('lists each signal with its pass threshold in the explanation', () => {
    renderPanel()
    fireEvent.click(toggle())
    // Every signal name appears (within the methodology list).
    for (const def of SIGNALS) {
      expect(screen.getByText(def.name)).toBeInTheDocument()
    }
    // Thresholds are stated as "passes at N/10".
    const passesAt = screen.getAllByText(/passes at/i)
    expect(passesAt).toHaveLength(SIGNALS.length)
  })

  it('explains the verdict rule (looks ready / not ready / needs work)', () => {
    renderPanel()
    fireEvent.click(toggle())
    // "Needs work" also appears in the header verdict for this fixture, so allow ≥1.
    expect(screen.getAllByText('Looks ready').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Not ready').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Needs work').length).toBeGreaterThanOrEqual(1)
  })

  it('"Back to results" restores the signal rows', () => {
    renderPanel()
    fireEvent.click(toggle())
    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /back to results/i }))
    // Rows are back.
    expect(screen.getAllByRole('meter')).toHaveLength(6)
  })
})

describe('ResultsPanel hide-until-review', () => {
  it('still renders the region while a review is running (loading)', () => {
    renderPanel({ loading: true, review: null })
    expect(screen.getByRole('region', { name: 'Review results' })).toBeInTheDocument()
    expect(screen.getByLabelText('Running review…')).toBeInTheDocument()
  })

  it('still renders the region on error', () => {
    renderPanel({ error: appError('AI_RATE_LIMIT'), review: null })
    expect(screen.getByRole('region', { name: 'Review results' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('ResultsPanel confirm submission (review-then-confirm)', () => {
  it('shows a Confirm submission button for a pending preview and fires onConfirm', () => {
    const onConfirm = vi.fn()
    renderPanel({ pending: true, onConfirm })
    const confirm = screen.getByRole('button', { name: /confirm submission/i })
    expect(confirm).toBeInTheDocument()
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('pins the confirm footer to the bottom of the drawer scroll (sticky)', () => {
    renderPanel({ pending: true, onConfirm: () => {} })
    const footer = screen
      .getByRole('button', { name: /confirm submission/i })
      .closest('footer')
    expect(footer).not.toBeNull()
    // Sticky to the bottom so it stays reachable while the drawer body scrolls.
    expect(footer).toHaveClass('sticky')
    expect(footer).toHaveClass('bottom-0')
  })

  it('hides Confirm submission for an already-submitted snapshot (not pending)', () => {
    renderPanel({ onConfirm: () => {} })
    expect(screen.queryByRole('button', { name: /confirm submission/i })).not.toBeInTheDocument()
  })

  it('does not show Confirm submission while loading or on error', () => {
    const onConfirm = vi.fn()
    renderPanel({ pending: true, loading: true, review: null, onConfirm })
    expect(screen.queryByRole('button', { name: /confirm submission/i })).not.toBeInTheDocument()
    cleanup()
    renderPanel({ pending: true, error: appError('AI_RATE_LIMIT'), review: null, onConfirm })
    expect(screen.queryByRole('button', { name: /confirm submission/i })).not.toBeInTheDocument()
  })
})
