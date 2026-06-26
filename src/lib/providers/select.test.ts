import { describe, expect, it } from 'vitest'
import {
  hasAzureConfig,
  hasGeminiKey,
  hasSpeechTokenConfig,
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

describe('transcription config (Azure AI Speech fast transcription)', () => {
  const SPEECH_ENV = {
    AZURE_SPEECH_ENDPOINT: 'https://eastus.api.cognitive.microsoft.com',
    AZURE_SPEECH_KEY: 'speech-key',
    AZURE_SPEECH_TRANSCRIBE_MODEL: 'mai-transcribe-1.5',
    AZURE_SPEECH_REGION: 'eastus',
  }

  it('requires endpoint + key + model all present', () => {
    expect(hasTranscribeConfig({})).toBe(false)
    // Endpoint + key but no model.
    expect(
      hasTranscribeConfig({
        AZURE_SPEECH_ENDPOINT: SPEECH_ENV.AZURE_SPEECH_ENDPOINT,
        AZURE_SPEECH_KEY: SPEECH_ENV.AZURE_SPEECH_KEY,
      }),
    ).toBe(false)
    // Model but no endpoint/key at all.
    expect(hasTranscribeConfig({ AZURE_SPEECH_TRANSCRIBE_MODEL: 'mai-transcribe-1.5' })).toBe(false)
    expect(hasTranscribeConfig(SPEECH_ENV)).toBe(true)
  })

  it('treats blank/whitespace values as unset', () => {
    expect(
      hasTranscribeConfig({
        AZURE_SPEECH_ENDPOINT: '  ',
        AZURE_SPEECH_KEY: 'k',
        AZURE_SPEECH_TRANSCRIBE_MODEL: 'mai-transcribe-1.5',
      }),
    ).toBe(false)
  })

  it('resolves the AZURE_SPEECH_* values', () => {
    expect(resolveTranscribeConfig(SPEECH_ENV)).toEqual({
      endpoint: SPEECH_ENV.AZURE_SPEECH_ENDPOINT,
      apiKey: SPEECH_ENV.AZURE_SPEECH_KEY,
      model: 'mai-transcribe-1.5',
      region: 'eastus',
    })
  })

  it('prefers AZURE_SPEECH_* over the legacy AZURE_OPENAI_TRANSCRIBE_* fallbacks', () => {
    const resolved = resolveTranscribeConfig({
      ...SPEECH_ENV,
      AZURE_OPENAI_TRANSCRIBE_ENDPOINT: 'https://legacy/openai/v1',
      AZURE_OPENAI_TRANSCRIBE_API_KEY: 'legacy-key',
      AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT: 'whisper',
    })
    expect(resolved).toEqual({
      endpoint: SPEECH_ENV.AZURE_SPEECH_ENDPOINT,
      apiKey: SPEECH_ENV.AZURE_SPEECH_KEY,
      model: 'mai-transcribe-1.5',
      region: 'eastus',
    })
  })

  it('falls back to the legacy AZURE_OPENAI_TRANSCRIBE_* names when AZURE_SPEECH_* are unset', () => {
    const env = {
      AZURE_OPENAI_TRANSCRIBE_ENDPOINT: 'https://legacy.api.cognitive.microsoft.com',
      AZURE_OPENAI_TRANSCRIBE_API_KEY: 'legacy-key',
      AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT: 'mai-transcribe-1.5',
    }
    expect(hasTranscribeConfig(env)).toBe(true)
    expect(resolveTranscribeConfig(env)).toEqual({
      endpoint: 'https://legacy.api.cognitive.microsoft.com',
      apiKey: 'legacy-key',
      model: 'mai-transcribe-1.5',
      // Region has no legacy fallback, so it resolves empty here.
      region: '',
    })
  })

  it('falls through an empty-string primary to a legacy value (|| not ??)', () => {
    // Empty-but-present AZURE_SPEECH_* (left from .env.example) must NOT shadow
    // valid legacy creds — `??` would keep the '' and break transcription.
    const env = {
      AZURE_SPEECH_ENDPOINT: '',
      AZURE_SPEECH_KEY: '',
      AZURE_SPEECH_TRANSCRIBE_MODEL: '',
      AZURE_OPENAI_TRANSCRIBE_ENDPOINT: 'https://legacy.api.cognitive.microsoft.com',
      AZURE_OPENAI_TRANSCRIBE_API_KEY: 'legacy-key',
      AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT: 'mai-transcribe-1.5',
    }
    expect(resolveTranscribeConfig(env)).toEqual({
      endpoint: 'https://legacy.api.cognitive.microsoft.com',
      apiKey: 'legacy-key',
      model: 'mai-transcribe-1.5',
      region: '',
    })
    expect(hasTranscribeConfig(env)).toBe(true)
  })

  it('falls back to the main AZURE_OPENAI_* endpoint/key', () => {
    const resolved = resolveTranscribeConfig({
      AZURE_OPENAI_ENDPOINT: 'https://main.api.cognitive.microsoft.com',
      AZURE_OPENAI_API_KEY: 'main-key',
      AZURE_SPEECH_TRANSCRIBE_MODEL: 'mai-transcribe-1.5',
    })
    expect(resolved).toEqual({
      endpoint: 'https://main.api.cognitive.microsoft.com',
      apiKey: 'main-key',
      model: 'mai-transcribe-1.5',
      region: '',
    })
  })

  it('trims resolved values', () => {
    const resolved = resolveTranscribeConfig({
      AZURE_SPEECH_ENDPOINT: '  https://e.api.cognitive.microsoft.com  ',
      AZURE_SPEECH_KEY: '  key  ',
      AZURE_SPEECH_TRANSCRIBE_MODEL: '  mai-transcribe-1.5  ',
      AZURE_SPEECH_REGION: '  eastus  ',
    })
    expect(resolved).toEqual({
      endpoint: 'https://e.api.cognitive.microsoft.com',
      apiKey: 'key',
      model: 'mai-transcribe-1.5',
      region: 'eastus',
    })
  })

  it('hasSpeechTokenConfig requires endpoint + key + region (model not needed)', () => {
    expect(hasSpeechTokenConfig({})).toBe(false)
    // Endpoint + key but no region.
    expect(
      hasSpeechTokenConfig({
        AZURE_SPEECH_ENDPOINT: SPEECH_ENV.AZURE_SPEECH_ENDPOINT,
        AZURE_SPEECH_KEY: SPEECH_ENV.AZURE_SPEECH_KEY,
      }),
    ).toBe(false)
    // Region present but blank/whitespace counts as unset.
    expect(
      hasSpeechTokenConfig({
        AZURE_SPEECH_ENDPOINT: SPEECH_ENV.AZURE_SPEECH_ENDPOINT,
        AZURE_SPEECH_KEY: SPEECH_ENV.AZURE_SPEECH_KEY,
        AZURE_SPEECH_REGION: '  ',
      }),
    ).toBe(false)
    // Endpoint + key + region, no model needed.
    expect(
      hasSpeechTokenConfig({
        AZURE_SPEECH_ENDPOINT: SPEECH_ENV.AZURE_SPEECH_ENDPOINT,
        AZURE_SPEECH_KEY: SPEECH_ENV.AZURE_SPEECH_KEY,
        AZURE_SPEECH_REGION: 'eastus',
      }),
    ).toBe(true)
    expect(hasSpeechTokenConfig(SPEECH_ENV)).toBe(true)
  })
})
