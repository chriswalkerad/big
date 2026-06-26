import { describe, expect, it } from 'vitest'
import {
  migrateDocument,
  migrateSignal,
  resolveReviewer,
  stripPromptPlaceholder,
} from './migrate'
import { PEOPLE } from '@/lib/people'
import type { Document, ReviewResult } from '@/types'

function oldScaleReview(): ReviewResult {
  return {
    detectedSubtype: 'story_premise',
    suggestedTitle: 'Old',
    themes: ['t'],
    signals: [
      { signalId: 'clarity', score: 9, rationale: 'r', issues: [] },
      { signalId: 'brand_safety', score: 2, rationale: 'r', issues: [] },
    ],
    verdict: { label: 'needs_work', flagCount: 1 },
    suggestedPrompt: 'Revise the following concept:\n\n[paste your text here]',
  }
}

function legacyDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'user-doc-legacy',
    projectId: 'proj-eloise',
    title: 'Legacy',
    body: 'body',
    subtype: 'story_premise',
    subtypeSource: 'auto',
    status: 'submitted',
    createdBy: 'Me',
    // Persisted before Person existed: a bare string id.
    reviewer: 'person-maya-kambe' as unknown as Document['reviewer'],
    submittedSnapshot: { body: 'body', review: oldScaleReview(), submittedAt: '2026-01-01T00:00:00.000Z' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('resolveReviewer', () => {
  it('resolves a string id to the roster Person', () => {
    expect(resolveReviewer('person-maya-kambe')).toEqual(
      PEOPLE.find((p) => p.id === 'person-maya-kambe'),
    )
  })

  it('resolves a string name (case-insensitive) to the roster Person', () => {
    expect(resolveReviewer('maya kambe')).toEqual(
      PEOPLE.find((p) => p.id === 'person-maya-kambe'),
    )
  })

  it('returns undefined for an unresolvable string', () => {
    expect(resolveReviewer('nobody-here')).toBeUndefined()
    expect(resolveReviewer('')).toBeUndefined()
    expect(resolveReviewer('   ')).toBeUndefined()
  })

  it('returns undefined for null/undefined', () => {
    expect(resolveReviewer(null)).toBeUndefined()
    expect(resolveReviewer(undefined)).toBeUndefined()
  })

  it('keeps an already-resolved Person (canonicalized by id)', () => {
    const stale = { id: 'person-maya-kambe', name: 'Stale Name', role: 'old' }
    expect(resolveReviewer(stale)).toEqual(
      PEOPLE.find((p) => p.id === 'person-maya-kambe'),
    )
  })
})

describe('stripPromptPlaceholder', () => {
  it('strips the trailing placeholder and blank lines', () => {
    expect(stripPromptPlaceholder('Revise this:\n\n[paste your text here]')).toBe('Revise this:')
  })

  it('is case-insensitive on the placeholder', () => {
    expect(stripPromptPlaceholder('Do it:\n\n[PASTE YOUR TEXT HERE]')).toBe('Do it:')
  })

  it('leaves a clean prompt untouched', () => {
    expect(stripPromptPlaceholder('Return only the revised concept:')).toBe(
      'Return only the revised concept:',
    )
  })
})

describe('migrateDocument', () => {
  it('rescales old-scale scores ×10', () => {
    const doc = migrateDocument(legacyDoc())
    const scores = doc.submittedSnapshot?.review.signals.map((s) => s.score)
    expect(scores).toEqual([90, 20])
  })

  it('resolves a string reviewer to a Person', () => {
    const doc = migrateDocument(legacyDoc())
    expect(doc.reviewer).toEqual(PEOPLE.find((p) => p.id === 'person-maya-kambe'))
  })

  it('sets reviewer to undefined when unresolvable', () => {
    const doc = migrateDocument(
      legacyDoc({ reviewer: 'ghost' as unknown as Document['reviewer'] }),
    )
    expect(doc.reviewer).toBeUndefined()
  })

  it('strips the suggestedPrompt placeholder', () => {
    const doc = migrateDocument(legacyDoc())
    expect(doc.submittedSnapshot?.review.suggestedPrompt).toBe('Revise the following concept:')
  })

  it('does not mutate the input document', () => {
    const input = legacyDoc()
    const before = JSON.stringify(input)
    migrateDocument(input)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('is idempotent: migrating an already-migrated doc is a no-op', () => {
    const once = migrateDocument(legacyDoc())
    const twice = migrateDocument(once)
    expect(twice).toEqual(once)
  })

  it('leaves a new-scale review untouched (no double rescale)', () => {
    const doc = legacyDoc({
      reviewer: PEOPLE[0],
      submittedSnapshot: {
        body: 'b',
        review: {
          detectedSubtype: 'story_premise',
          suggestedTitle: 'New',
          themes: [],
          // Top score > 10 → already new-scale, even though one score is exactly 10.
          signals: [
            { signalId: 'clarity', score: 90, rationale: 'r', issues: [] },
            { signalId: 'brand_safety', score: 10, rationale: 'r', issues: [] },
          ],
          verdict: { label: 'needs_work', flagCount: 1 },
        },
        submittedAt: '2026-06-01T00:00:00.000Z',
      },
    })
    const out = migrateDocument(doc)
    expect(out.submittedSnapshot?.review.signals.map((s) => s.score)).toEqual([90, 10])
  })

  it('handles a draft with no snapshot', () => {
    const out = migrateDocument(legacyDoc({ submittedSnapshot: undefined, reviewer: undefined }))
    expect(out.submittedSnapshot).toBeUndefined()
    expect(out.reviewer).toBeUndefined()
  })
})

describe('migrateSignal', () => {
  it('rescales an old-scale threshold ×10', () => {
    expect(migrateSignal({ id: 's', name: 'C', prompt: 'p', threshold: 7, mode: 'inline' }).threshold).toBe(70)
  })

  it('leaves a new-scale threshold untouched and is idempotent', () => {
    const sig = { id: 's', name: 'C', prompt: 'p', threshold: 70, mode: 'inline' as const }
    expect(migrateSignal(sig).threshold).toBe(70)
    expect(migrateSignal(migrateSignal(sig))).toEqual(migrateSignal(sig))
  })
})
