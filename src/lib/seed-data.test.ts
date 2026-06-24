import { describe, it, expect } from 'vitest'
import { seedDocuments, seedSignals } from './seed-data'

describe('seed signals', () => {
  it('has the six signals with exact ids in order', () => {
    expect(seedSignals.map((s) => s.id)).toEqual([
      'clarity',
      'completeness',
      'brand_safety',
      'hook_strength',
      'character',
      'franchise_fit',
    ])
  })
})

describe('seed documents', () => {
  it('every inline issue quote is an exact substring of its document body', () => {
    for (const doc of seedDocuments) {
      const review = doc.submittedSnapshot?.review
      if (!review) continue
      for (const signal of review.signals) {
        for (const issue of signal.issues) {
          expect(
            doc.body.includes(issue.quote),
            `"${issue.quote}" not found in ${doc.id}`,
          ).toBe(true)
        }
      }
    }
  })

  it('matches the designed verdicts and flag counts', () => {
    const byId = Object.fromEntries(seedDocuments.map((d) => [d.id, d]))
    expect(byId['doc-midnight-caper'].submittedSnapshot?.review.verdict).toEqual({ label: 'looks_ready', flagCount: 0 })
    expect(byId['doc-new-friend'].submittedSnapshot?.review.verdict).toEqual({ label: 'needs_work', flagCount: 3 })
    expect(byId['doc-haunted-elevator'].submittedSnapshot?.review.verdict).toEqual({ label: 'not_ready', flagCount: 2 })
    expect(byId['doc-rooftop-stub'].submittedSnapshot).toBeUndefined()
  })

  it('flagCount equals the number of signals scoring below threshold', () => {
    const thresholds = { clarity: 7, completeness: 7, brand_safety: 7, hook_strength: 6, character: 6, franchise_fit: 6 } as Record<string, number>
    for (const doc of seedDocuments) {
      const review = doc.submittedSnapshot?.review
      if (!review) continue
      const below = review.signals.filter((s) => s.score < thresholds[s.signalId]).length
      expect(below).toBe(review.verdict.flagCount)
    }
  })
})
