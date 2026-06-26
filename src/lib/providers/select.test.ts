import { describe, expect, it } from 'vitest'
import {
  hasAzureConfig,
  hasSpeechTokenConfig,
  resolveTranscribeConfig,
  selectProvider,
} from './select'
import { AzureProvider } from './azure'
import { MockProvider } from './mock'

const AZURE_ENV = {
  AZURE_OPENAI_ENDPOINT: 'https://r.services.ai.azure.com/openai/v1',
  AZURE_OPENAI_API_KEY: 'fake-azure-key',
  AZURE_OPENAI_DEPLOYMENT: 'gpt-5.5',
}

describe('provider selection', () => {
  it('selects MockProvider when Azure is not configured', () => {
    expect(selectProvider({})).toBeInstanceOf(MockProvider)
    expect(selectProvider({ AZURE_OPENAI_API_KEY: 'k' })).toBeInstanceOf(MockProvider)
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
})

describe('transcription config (Azure AI Speech streaming dictation)', () => {
  const SPEECH_ENV = {
    AZURE_SPEECH_ENDPOINT: 'https://eastus.api.cognitive.microsoft.com',
    AZURE_SPEECH_KEY: 'speech-key',
    AZURE_SPEECH_REGION: 'eastus',
  }

  it('resolves the AZURE_SPEECH_* values', () => {
    expect(resolveTranscribeConfig(SPEECH_ENV)).toEqual({
      endpoint: SPEECH_ENV.AZURE_SPEECH_ENDPOINT,
      apiKey: SPEECH_ENV.AZURE_SPEECH_KEY,
      region: 'eastus',
    })
  })

  it('prefers AZURE_SPEECH_* over the legacy AZURE_OPENAI_TRANSCRIBE_* fallbacks', () => {
    const resolved = resolveTranscribeConfig({
      ...SPEECH_ENV,
      AZURE_OPENAI_TRANSCRIBE_ENDPOINT: 'https://legacy/openai/v1',
      AZURE_OPENAI_TRANSCRIBE_API_KEY: 'legacy-key',
    })
    expect(resolved).toEqual({
      endpoint: SPEECH_ENV.AZURE_SPEECH_ENDPOINT,
      apiKey: SPEECH_ENV.AZURE_SPEECH_KEY,
      region: 'eastus',
    })
  })

  it('falls back to the legacy AZURE_OPENAI_TRANSCRIBE_* names when AZURE_SPEECH_* are unset', () => {
    const env = {
      AZURE_OPENAI_TRANSCRIBE_ENDPOINT: 'https://legacy.api.cognitive.microsoft.com',
      AZURE_OPENAI_TRANSCRIBE_API_KEY: 'legacy-key',
    }
    expect(resolveTranscribeConfig(env)).toEqual({
      endpoint: 'https://legacy.api.cognitive.microsoft.com',
      apiKey: 'legacy-key',
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
      AZURE_OPENAI_TRANSCRIBE_ENDPOINT: 'https://legacy.api.cognitive.microsoft.com',
      AZURE_OPENAI_TRANSCRIBE_API_KEY: 'legacy-key',
    }
    expect(resolveTranscribeConfig(env)).toEqual({
      endpoint: 'https://legacy.api.cognitive.microsoft.com',
      apiKey: 'legacy-key',
      region: '',
    })
  })

  it('falls back to the main AZURE_OPENAI_* endpoint/key', () => {
    const resolved = resolveTranscribeConfig({
      AZURE_OPENAI_ENDPOINT: 'https://main.api.cognitive.microsoft.com',
      AZURE_OPENAI_API_KEY: 'main-key',
    })
    expect(resolved).toEqual({
      endpoint: 'https://main.api.cognitive.microsoft.com',
      apiKey: 'main-key',
      region: '',
    })
  })

  it('trims resolved values', () => {
    const resolved = resolveTranscribeConfig({
      AZURE_SPEECH_ENDPOINT: '  https://e.api.cognitive.microsoft.com  ',
      AZURE_SPEECH_KEY: '  key  ',
      AZURE_SPEECH_REGION: '  eastus  ',
    })
    expect(resolved).toEqual({
      endpoint: 'https://e.api.cognitive.microsoft.com',
      apiKey: 'key',
      region: 'eastus',
    })
  })

  it('hasSpeechTokenConfig requires endpoint + key + region', () => {
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
    // Endpoint + key + region.
    expect(hasSpeechTokenConfig(SPEECH_ENV)).toBe(true)
  })
})
