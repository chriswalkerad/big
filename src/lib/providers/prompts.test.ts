import { describe, expect, it } from 'vitest'
import { buildPrompt, buildSystemInstruction } from './prompts'
import { seedProject, seedSignals } from '@/lib/seed-data'
import type { ReviewInput } from './interface'

const input: ReviewInput = {
  text: 'Eloise runs a secret midnight room-service operation at the Plaza.',
  project: seedProject,
  signals: seedSignals,
}

describe('shared prompt building', () => {
  it('system instruction carries project context and the verbatim-quote rule', () => {
    const sys = buildSystemInstruction(input)
    expect(sys).toContain(seedProject.name)
    expect(sys).toContain(seedProject.audience)
    expect(sys).toContain(seedProject.franchiseContext)
    expect(sys.toLowerCase()).toContain('verbatim')
    expect(sys.toLowerCase()).toContain('exact')
    // Encodes the verdict rule so the model can fill it in.
    expect(sys).toContain('looks_ready')
    expect(sys).toContain('not_ready')
  })

  it('asks for an overall summary and a ready-to-use suggested prompt with no placeholder', () => {
    const sys = buildSystemInstruction(input)
    expect(sys).toContain('"summary"')
    expect(sys).toContain('"suggestedPrompt"')
    expect(sys.toLowerCase()).not.toContain('[paste your text here]')
  })

  it('prompt embeds the concept text and every signal as a labeled criterion', () => {
    const prompt = buildPrompt(input)
    expect(prompt).toContain(input.text)
    for (const signal of seedSignals) {
      expect(prompt).toContain(`id="${signal.id}"`)
      expect(prompt).toContain(`name="${signal.name}"`)
      expect(prompt).toContain(`mode="${signal.mode}"`)
      expect(prompt).toContain(signal.prompt)
    }
  })
})
