import { describe, expect, it } from 'vitest'
import { applyRequestSchema, reviewResultSchema } from './schemas'
import { seedProject } from './seed-data'
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

describe('applyRequestSchema', () => {
  it('accepts a well-formed apply request', () => {
    const parsed = applyRequestSchema.parse({
      text: 'A short caper at the Plaza.',
      instruction: 'Tighten the opening.',
      project: seedProject,
    })
    expect(parsed.text).toContain('Plaza')
    expect(parsed.instruction).toContain('Tighten')
    expect(parsed.project.id).toBe(seedProject.id)
  })

  it('rejects a missing instruction', () => {
    expect(() =>
      applyRequestSchema.parse({ text: 'hi', project: seedProject }),
    ).toThrow()
  })

  it('rejects a non-string text', () => {
    expect(() =>
      applyRequestSchema.parse({ text: 123, instruction: 'go', project: seedProject }),
    ).toThrow()
  })

  it('rejects a malformed project', () => {
    expect(() =>
      applyRequestSchema.parse({ text: 'hi', instruction: 'go', project: { id: 'x' } }),
    ).toThrow()
  })
})
