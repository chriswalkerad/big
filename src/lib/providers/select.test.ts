import { describe, expect, it } from 'vitest'
import {
  hasAzureConfig,
  hasGeminiKey,
  hasTranscribeConfig,
  resolveTranscribeConfig,
  selectProvider,
} from './select'
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

describe('transcription config', () => {
  const TRANSCRIBE_ENV = {
    ...AZURE_ENV,
    AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT: 'openai--whisper-large-v3-turbo',
  }

  it('requires endpoint + key + transcribe deployment all present', () => {
    expect(hasTranscribeConfig({})).toBe(false)
    // Endpoint + key but no transcription deployment.
    expect(hasTranscribeConfig(AZURE_ENV)).toBe(false)
    // Deployment but no endpoint/key at all.
    expect(
      hasTranscribeConfig({ AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT: 'whisper' }),
    ).toBe(false)
    expect(hasTranscribeConfig(TRANSCRIBE_ENV)).toBe(true)
  })

  it('treats blank/whitespace values as unset', () => {
    expect(
      hasTranscribeConfig({
        AZURE_OPENAI_ENDPOINT: '  ',
        AZURE_OPENAI_API_KEY: 'k',
        AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT: 'whisper',
      }),
    ).toBe(false)
  })

  it('resolves endpoint and key from the main Azure values by default', () => {
    expect(resolveTranscribeConfig(TRANSCRIBE_ENV)).toEqual({
      endpoint: AZURE_ENV.AZURE_OPENAI_ENDPOINT,
      apiKey: AZURE_ENV.AZURE_OPENAI_API_KEY,
      deployment: 'openai--whisper-large-v3-turbo',
    })
  })

  it('prefers the transcription-specific endpoint and key overrides when set', () => {
    const resolved = resolveTranscribeConfig({
      ...TRANSCRIBE_ENV,
      AZURE_OPENAI_TRANSCRIBE_ENDPOINT: 'https://whisper.inference.ai.azure.com/openai/v1',
      AZURE_OPENAI_TRANSCRIBE_API_KEY: 'whisper-only-key',
    })
    expect(resolved.endpoint).toBe('https://whisper.inference.ai.azure.com/openai/v1')
    expect(resolved.apiKey).toBe('whisper-only-key')
    expect(resolved.deployment).toBe('openai--whisper-large-v3-turbo')
  })

  it('is configured via a transcribe endpoint even without the main endpoint', () => {
    expect(
      hasTranscribeConfig({
        AZURE_OPENAI_TRANSCRIBE_ENDPOINT: 'https://whisper.inference.ai.azure.com/openai/v1',
        AZURE_OPENAI_API_KEY: 'k',
        AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT: 'whisper',
      }),
    ).toBe(true)
  })

  it('trims resolved values', () => {
    const resolved = resolveTranscribeConfig({
      AZURE_OPENAI_TRANSCRIBE_ENDPOINT: '  https://e/openai/v1  ',
      AZURE_OPENAI_TRANSCRIBE_API_KEY: '  key  ',
      AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT: '  whisper  ',
    })
    expect(resolved).toEqual({ endpoint: 'https://e/openai/v1', apiKey: 'key', deployment: 'whisper' })
  })
})
