import { describe, it, expect } from 'vitest'
import type {
  Document,
  ReviewResult,
  SignalDef,
  SignalResult,
  SubmittedSnapshot,
} from '@/types'
import {
  VERDICT_LABELS,
  isVerdictProminent,
  formatFlagCount,
  barTone,
  barFillPercent,
  hasDrift,
  canTransition,
  statusAfterSubmit,
  applyPrefill,
  toHighlightIssues,
  inlineSignalIdSet,
  makeSnapshot,
  REVIEWER_STATUSES,
} from './doc-page'

const SIGNALS: SignalDef[] = [
  { id: 'clarity', name: 'Clarity', mode: 'inline', threshold: 70, prompt: '' },
  { id: 'brand_safety', name: 'Brand Safety', mode: 'inline', threshold: 70, prompt: '' },
  { id: 'hook_strength', name: 'Hook Strength', mode: 'doc', threshold: 60, prompt: '' },
]

function review(overrides: Partial<ReviewResult> = {}): ReviewResult {
  return {
    detectedSubtype: 'story_premise',
    suggestedTitle: 'Suggested Title',
    themes: ['friendship'],
    signals: [],
    verdict: { label: 'needs_work', flagCount: 2 },
    ...overrides,
  }
}

describe('verdict + flag formatting', () => {
  it('maps every verdict label to a human string', () => {
    expect(VERDICT_LABELS.looks_ready).toBe('Looks ready')
    expect(VERDICT_LABELS.needs_work).toBe('Needs work')
    expect(VERDICT_LABELS.not_ready).toBe('Not ready')
  })

  it('marks needs_work and not_ready as prominent, looks_ready as not', () => {
    expect(isVerdictProminent('looks_ready')).toBe(false)
    expect(isVerdictProminent('needs_work')).toBe(true)
    expect(isVerdictProminent('not_ready')).toBe(true)
  })

  it('formats the flag count as "X of N need attention"', () => {
    expect(formatFlagCount(2, 6)).toBe('2 of 6 need attention')
    expect(formatFlagCount(0, 6)).toBe('0 of 6 need attention')
  })
})

describe('barTone — color maps to the signal threshold', () => {
  it('is pass when score >= threshold (boundary and above)', () => {
    expect(barTone(70, 70)).toBe('pass')
    expect(barTone(100, 70)).toBe('pass')
    expect(barTone(60, 60)).toBe('pass')
  })

  it('is minor when up to 20 below threshold', () => {
    expect(barTone(60, 70)).toBe('minor') // 10 below
    expect(barTone(50, 70)).toBe('minor') // 20 below
    expect(barTone(40, 60)).toBe('minor') // 20 below, different threshold
  })

  it('is risk when more than 20 below threshold', () => {
    expect(barTone(40, 70)).toBe('risk') // 30 below
    expect(barTone(20, 70)).toBe('risk') // 50 below
    expect(barTone(30, 60)).toBe('risk') // 30 below
  })
})

describe('barFillPercent', () => {
  it('is proportional and clamped 0-100', () => {
    expect(barFillPercent(0)).toBe(0)
    expect(barFillPercent(50)).toBe(50)
    expect(barFillPercent(100)).toBe(100)
    expect(barFillPercent(120)).toBe(100)
    expect(barFillPercent(-30)).toBe(0)
  })
})

describe('version drift', () => {
  const snapshot: SubmittedSnapshot = {
    body: 'original body',
    review: review(),
    submittedAt: '2026-06-20T00:00:00.000Z',
  }

  it('is false with no snapshot', () => {
    expect(hasDrift('anything', undefined)).toBe(false)
  })

  it('is false when body equals the snapshot body', () => {
    expect(hasDrift('original body', snapshot)).toBe(false)
  })

  it('is true when body differs from the snapshot body', () => {
    expect(hasDrift('edited body', snapshot)).toBe(true)
  })
})

describe('status state machine', () => {
  it('allows draft -> submitted only', () => {
    expect(canTransition('draft', 'submitted')).toBe(true)
    expect(canTransition('draft', 'approved')).toBe(false)
    expect(canTransition('draft', 'in_review')).toBe(false)
  })

  it('allows reviewer transitions from submitted/in_review', () => {
    expect(canTransition('submitted', 'in_review')).toBe(true)
    expect(canTransition('submitted', 'changes_requested')).toBe(true)
    expect(canTransition('submitted', 'approved')).toBe(true)
    expect(canTransition('in_review', 'approved')).toBe(true)
    expect(canTransition('changes_requested', 'in_review')).toBe(true)
  })

  it('allows unsubmit (any non-draft -> draft)', () => {
    expect(canTransition('submitted', 'draft')).toBe(true)
    expect(canTransition('in_review', 'draft')).toBe(true)
    expect(canTransition('approved', 'draft')).toBe(true)
  })

  it('treats identity transitions as allowed', () => {
    expect(canTransition('approved', 'approved')).toBe(true)
  })

  it('rejects illegal jumps', () => {
    expect(canTransition('draft', 'changes_requested')).toBe(false)
    expect(canTransition('approved', 'submitted')).toBe(false)
  })

  it('auto-advances draft to submitted on submit; preserves others', () => {
    expect(statusAfterSubmit('draft')).toBe('submitted')
    expect(statusAfterSubmit('in_review')).toBe('in_review')
    expect(statusAfterSubmit('changes_requested')).toBe('changes_requested')
    expect(statusAfterSubmit('approved')).toBe('approved')
  })

  it('exposes the reviewer status options', () => {
    expect(REVIEWER_STATUSES).toEqual(['in_review', 'changes_requested', 'approved'])
  })
})

describe('submit prefill (respecting user sources)', () => {
  const base: Pick<Document, 'title' | 'subtype' | 'subtypeSource'> = {
    title: '',
    subtype: 'creative_brief',
    subtypeSource: 'auto',
  }

  it('fills an empty title from the suggestion', () => {
    const out = applyPrefill(base, review({ suggestedTitle: 'AI Title' }))
    expect(out.title).toBe('AI Title')
  })

  it('keeps a non-empty title untouched', () => {
    const out = applyPrefill({ ...base, title: 'My Title' }, review({ suggestedTitle: 'AI Title' }))
    expect(out.title).toBe('My Title')
  })

  it('overrides subtype while source is auto', () => {
    const out = applyPrefill(base, review({ detectedSubtype: 'character_concept' }))
    expect(out.subtype).toBe('character_concept')
    expect(out.subtypeSource).toBe('auto')
  })

  it('does NOT override subtype once the user picked it', () => {
    const userDoc = { ...base, subtype: 'world_building' as const, subtypeSource: 'user' as const }
    const out = applyPrefill(userDoc, review({ detectedSubtype: 'character_concept' }))
    expect(out.subtype).toBe('world_building')
    expect(out.subtypeSource).toBe('user')
  })
})

describe('inline highlight mapping', () => {
  const results: SignalResult[] = [
    {
      signalId: 'clarity',
      score: 40,
      rationale: '',
      issues: [{ quote: 'vague phrase', message: 'unclear', severity: 'minor' }],
    },
    {
      signalId: 'brand_safety',
      score: 20,
      rationale: '',
      issues: [{ quote: 'body count', message: 'unsafe', severity: 'risk' }],
    },
    {
      signalId: 'hook_strength',
      score: 90,
      rationale: '',
      issues: [{ quote: 'should be ignored', message: 'doc-level', severity: 'minor' }],
    },
  ]

  it('keeps only inline signals and tags each issue with its signalId', () => {
    const inline = inlineSignalIdSet(SIGNALS)
    const issues = toHighlightIssues(results, inline)
    expect(issues).toHaveLength(2)
    expect(issues.map((i) => i.signalId)).toEqual(['clarity', 'brand_safety'])
    expect(issues[0]).toMatchObject({ quote: 'vague phrase', signalId: 'clarity', severity: 'minor' })
  })

  it('excludes doc-level signals like Hook Strength', () => {
    const inline = inlineSignalIdSet(SIGNALS)
    const issues = toHighlightIssues(results, inline)
    expect(issues.some((i) => i.signalId === 'hook_strength')).toBe(false)
  })
})

describe('makeSnapshot', () => {
  it('captures body, review, and timestamp', () => {
    const r = review()
    const snap = makeSnapshot('the body', r, '2026-06-23T00:00:00.000Z')
    expect(snap).toEqual({ body: 'the body', review: r, submittedAt: '2026-06-23T00:00:00.000Z' })
  })
})
