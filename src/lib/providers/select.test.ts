import { describe, expect, it } from 'vitest'
import { hasGeminiKey, selectProvider } from './select'
import { GeminiProvider } from './gemini'
import { MockProvider } from './mock'

describe('provider selection', () => {
  it('reports no key when GEMINI_API_KEY is absent or blank', () => {
    expect(hasGeminiKey({})).toBe(false)
    expect(hasGeminiKey({ GEMINI_API_KEY: '' })).toBe(false)
    expect(hasGeminiKey({ GEMINI_API_KEY: '   ' })).toBe(false)
  })

  it('reports a key when GEMINI_API_KEY is set', () => {
    expect(hasGeminiKey({ GEMINI_API_KEY: 'abc123' })).toBe(true)
  })

  it('selects MockProvider when no key is present', () => {
    expect(selectProvider({})).toBeInstanceOf(MockProvider)
    expect(selectProvider({ GEMINI_API_KEY: '' })).toBeInstanceOf(MockProvider)
  })

  it('selects GeminiProvider when a key is present', () => {
    const provider = selectProvider({ GEMINI_API_KEY: 'fake-key', GEMINI_MODEL_ID: 'gemini-3.5-flash' })
    expect(provider).toBeInstanceOf(GeminiProvider)
  })
})
