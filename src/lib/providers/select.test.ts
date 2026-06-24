import { describe, expect, it } from 'vitest'
import { hasAzureConfig, hasGeminiKey, selectProvider } from './select'
import { AzureProvider } from './azure'
import { GeminiProvider } from './gemini'
import { MockProvider } from './mock'

const AZURE_ENV = {
  AZURE_OPENAI_ENDPOINT: 'https://r.services.ai.azure.com/openai/v1',
  AZURE_OPENAI_API_KEY: 'fake-azure-key',
  AZURE_OPENAI_DEPLOYMENT: 'gpt-5.5',
}

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

  it('reports Azure config only when both endpoint and key are set', () => {
    expect(hasAzureConfig({})).toBe(false)
    expect(hasAzureConfig({ AZURE_OPENAI_API_KEY: 'k' })).toBe(false)
    expect(hasAzureConfig({ AZURE_OPENAI_ENDPOINT: 'https://e/openai/v1' })).toBe(false)
    expect(hasAzureConfig(AZURE_ENV)).toBe(true)
  })

  it('selects AzureProvider when Azure is configured', () => {
    expect(selectProvider(AZURE_ENV)).toBeInstanceOf(AzureProvider)
  })

  it('prefers Azure over Gemini when both are configured', () => {
    expect(selectProvider({ ...AZURE_ENV, GEMINI_API_KEY: 'fake-key' })).toBeInstanceOf(AzureProvider)
  })
})
