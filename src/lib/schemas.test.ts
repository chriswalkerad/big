import { describe, expect, it } from 'vitest'
import { reviewResultSchema } from './schemas'
import type { ReviewResult } from '@/types'

const base: ReviewResult = {
  detectedSubtype: 'story_premise',
  suggestedTitle: 'Title',
  themes: ['adventure'],
  signals: [{ signalId: 'clarity', score: 8, rationale: 'Clear.', issues: [] }],
  verdict: { label: 'needs_work', flagCount: 1 },
}

describe('reviewResultSchema summary + suggestedPrompt', () => {
  it('accepts a review with summary and suggestedPrompt present', () => {
    const result = reviewResultSchema.parse({
      ...base,
      summary: 'Tighten the weakest signals and resubmit.',
      suggestedPrompt: 'Revise the following concept:\n\n[paste your text here]',
    })
    expect(result.summary).toBe('Tighten the weakest signals and resubmit.')
    expect(result.suggestedPrompt).toContain('[paste your text here]')
  })

  it('still accepts a review with neither field (they are optional)', () => {
    const result = reviewResultSchema.parse(base)
    expect(result.summary).toBeUndefined()
    expect(result.suggestedPrompt).toBeUndefined()
  })

  it('accepts just one of the two fields', () => {
    expect(() => reviewResultSchema.parse({ ...base, summary: 'Do this.' })).not.toThrow()
    expect(() =>
      reviewResultSchema.parse({ ...base, suggestedPrompt: 'Improve this.' }),
    ).not.toThrow()
  })

  it('rejects a non-string summary', () => {
    // Deliberately wrong type to confirm validation rejects bad AI output.
    expect(() => reviewResultSchema.parse({ ...base, summary: 42 })).toThrow()
  })
})
