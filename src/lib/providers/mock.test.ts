import { describe, expect, it } from 'vitest'
import { MockProvider, reviewSync } from './mock'
import { reviewResultSchema } from '@/lib/schemas'
import { seedDocuments, seedProject, seedSignals } from '@/lib/seed-data'
import type { ReviewInput } from './interface'

function inputFor(text: string): ReviewInput {
  return { text, project: seedProject, signals: seedSignals }
}

describe('MockProvider', () => {
  it('produces output that matches the ReviewResult schema', async () => {
    const provider = new MockProvider()
    const result = await provider.review(inputFor(seedDocuments[0].body))
    expect(() => reviewResultSchema.parse(result)).not.toThrow()
  })

  it('is deterministic: identical input yields identical output', async () => {
    const provider = new MockProvider()
    const text = seedDocuments[1].body
    const a = await provider.review(inputFor(text))
    const b = await provider.review(inputFor(text))
    expect(a).toEqual(b)
    // Stable across a fresh provider instance and the sync core too.
    expect(reviewSync(inputFor(text))).toEqual(a)
  })

  it('produces different output for different input', () => {
    const a = reviewSync(inputFor(seedDocuments[0].body))
    const b = reviewSync(inputFor(seedDocuments[2].body))
    expect(a).not.toEqual(b)
  })

  it('every inline issue quote is a real substring of the input', () => {
    for (const doc of seedDocuments) {
      const result = reviewSync(inputFor(doc.body))
      for (const signal of result.signals) {
        for (const issue of signal.issues) {
          expect(doc.body.includes(issue.quote)).toBe(true)
          expect(issue.quote.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('also anchors quotes for arbitrary pasted concepts', () => {
    const text =
      'They are really cool and have a whole vibe. The villain keeps a rising body count as the city empties out.'
    const result = reviewSync(inputFor(text))
    const quotes = result.signals.flatMap((s) => s.issues.map((i) => i.quote))
    expect(quotes.length).toBeGreaterThan(0)
    for (const q of quotes) {
      expect(text.includes(q)).toBe(true)
    }
  })

  it('reproduces the seeded haunted-elevator brand-safety risk (not_ready)', () => {
    const doc = seedDocuments.find((d) => d.id === 'doc-haunted-elevator')
    if (!doc) throw new Error('missing seed doc')
    const result = reviewSync(inputFor(doc.body))
    const brandSafety = result.signals.find((s) => s.signalId === 'brand_safety')
    expect(brandSafety).toBeDefined()
    expect(brandSafety!.score).toBeLessThan(7) // below threshold
    expect(brandSafety!.issues.length).toBeGreaterThanOrEqual(2)
    for (const issue of brandSafety!.issues) {
      expect(issue.severity).toBe('risk')
      expect(doc.body.includes(issue.quote)).toBe(true)
    }
    // Body count and "never seen again" are the off-limits phrases.
    const allQuotes = brandSafety!.issues.map((i) => i.quote.toLowerCase()).join(' | ')
    expect(allQuotes).toContain('body count')
    expect(allQuotes).toContain('never seen again')
    expect(result.verdict.label).toBe('not_ready')
  })

  it('reproduces the seeded vague-friend soft-gate (needs_work, clarity flagged)', () => {
    const doc = seedDocuments.find((d) => d.id === 'doc-new-friend')
    if (!doc) throw new Error('missing seed doc')
    const result = reviewSync(inputFor(doc.body))
    const clarity = result.signals.find((s) => s.signalId === 'clarity')
    expect(clarity).toBeDefined()
    expect(clarity!.score).toBeLessThan(7)
    expect(clarity!.issues.length).toBeGreaterThanOrEqual(1)
    for (const issue of clarity!.issues) {
      expect(issue.severity).toBe('minor')
      expect(doc.body.includes(issue.quote)).toBe(true)
    }
    // No brand-safety risk here, so it should be a soft-gate, not a hard stop.
    expect(result.verdict.label).toBe('needs_work')
  })

  it('treats the strong happy-path concept as looks_ready', () => {
    const doc = seedDocuments.find((d) => d.id === 'doc-midnight-caper')
    if (!doc) throw new Error('missing seed doc')
    const result = reviewSync(inputFor(doc.body))
    const brandSafety = result.signals.find((s) => s.signalId === 'brand_safety')
    expect(brandSafety!.issues).toHaveLength(0)
    expect(result.verdict.label).toBe('looks_ready')
  })

  it('detects subtype, suggests a title from the first line, and extracts themes', () => {
    const result = reviewSync(inputFor(seedDocuments[0].body))
    expect(result.detectedSubtype).toBe('story_premise')
    expect(result.suggestedTitle.length).toBeGreaterThan(0)
    expect(seedDocuments[0].body.toLowerCase()).toContain(result.suggestedTitle.toLowerCase().slice(0, 10))
    expect(result.themes.length).toBeGreaterThan(0)
  })

  it('only ever scores within 0..10', () => {
    for (const doc of seedDocuments) {
      const result = reviewSync(inputFor(doc.body))
      for (const s of result.signals) {
        expect(s.score).toBeGreaterThanOrEqual(0)
        expect(s.score).toBeLessThanOrEqual(10)
      }
    }
  })

  it('never produces inline issues for doc-mode signals', () => {
    const result = reviewSync(inputFor(seedDocuments[2].body))
    const docModeIds = new Set(seedSignals.filter((s) => s.mode === 'doc').map((s) => s.id))
    for (const s of result.signals) {
      if (docModeIds.has(s.signalId)) {
        expect(s.issues).toHaveLength(0)
      }
    }
  })

  it('handles custom signals with a generic fallback', () => {
    const customSignal = {
      id: 'pacing',
      name: 'Pacing',
      prompt: 'Judge the pacing.',
      threshold: 6,
      mode: 'doc' as const,
    }
    const result = reviewSync({
      text: seedDocuments[0].body,
      project: seedProject,
      signals: [customSignal],
    })
    expect(result.signals).toHaveLength(1)
    expect(result.signals[0].signalId).toBe('pacing')
    expect(() => reviewResultSchema.parse(result)).not.toThrow()
  })
})
