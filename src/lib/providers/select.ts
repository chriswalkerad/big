// Provider selection. The only reason the server exists is to keep provider keys
// off the client. Priority: Azure (OpenAI-compatible) when configured, else Gemini
// when a key is present, else the deterministic mock. Factored out so it can be
// unit-tested without any keys. See specs/bsp-backend-build-spec.md.

import { AzureProvider } from './azure'
import { GeminiProvider } from './gemini'
import { MockProvider } from './mock'
import type { ReviewProvider } from './interface'

export type ProviderEnv = {
  GEMINI_API_KEY?: string
  GEMINI_MODEL_ID?: string
  AZURE_OPENAI_API_KEY?: string
  AZURE_OPENAI_ENDPOINT?: string
  AZURE_OPENAI_DEPLOYMENT?: string
  // Azure AI Speech "fast transcription" (model MAI-Transcribe-1.5).
  AZURE_SPEECH_ENDPOINT?: string
  AZURE_SPEECH_KEY?: string
  AZURE_SPEECH_TRANSCRIBE_MODEL?: string
  // Legacy OpenAI-compatible transcription names, kept only as fallbacks.
  AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT?: string
  AZURE_OPENAI_TRANSCRIBE_ENDPOINT?: string
  AZURE_OPENAI_TRANSCRIBE_API_KEY?: string
} & Record<string, string | undefined>

/** Env needed for Azure AI Speech "fast transcription" (a subset of ProviderEnv).
 * The index signature keeps `process.env` assignable, matching ProviderEnv's shape.
 *
 * The Speech resource is a distinct service from the chat model, so it has its own
 * endpoint/key/model. The legacy AZURE_OPENAI_TRANSCRIBE_* (and the main
 * AZURE_OPENAI_*) names are honored as fallbacks so existing deployments keep
 * working, but the AZURE_SPEECH_* names are primary. */
export type TranscribeEnv = {
  /** Speech resource base URL, e.g. https://<region>.api.cognitive.microsoft.com. */
  AZURE_SPEECH_ENDPOINT?: string
  /** Ocp-Apim-Subscription-Key for the Speech resource. */
  AZURE_SPEECH_KEY?: string
  /** Fast-transcription model, e.g. mai-transcribe-1.5. */
  AZURE_SPEECH_TRANSCRIBE_MODEL?: string
  /** Azure region for the Speech resource, e.g. eastus. Required to mint the
   * short-lived token the real-time Speech SDK streams with. */
  AZURE_SPEECH_REGION?: string
  // Legacy fallbacks (deprecated; OpenAI-compatible transcriptions path).
  AZURE_OPENAI_API_KEY?: string
  AZURE_OPENAI_ENDPOINT?: string
  AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT?: string
  AZURE_OPENAI_TRANSCRIBE_ENDPOINT?: string
  AZURE_OPENAI_TRANSCRIBE_API_KEY?: string
} & Record<string, string | undefined>

/** Resolve the effective Speech endpoint/key/model. The AZURE_SPEECH_* names are
 * primary; the legacy AZURE_OPENAI_TRANSCRIBE_* / AZURE_OPENAI_* names are honored
 * as fallbacks. Returns trimmed strings, possibly empty. */
export function resolveTranscribeConfig(env: TranscribeEnv = process.env): {
  endpoint: string
  apiKey: string
  model: string
  region: string
} {
  // Use `||` (not `??`) so an empty-but-present value (e.g. AZURE_SPEECH_KEY=
  // left over from .env.example) falls through to the next candidate. With `??`
  // an empty string is not nullish, so it would shadow valid legacy creds and
  // the mic would never appear.
  const endpoint = (
    env.AZURE_SPEECH_ENDPOINT ||
    env.AZURE_OPENAI_TRANSCRIBE_ENDPOINT ||
    env.AZURE_OPENAI_ENDPOINT ||
    ''
  ).trim()
  const apiKey = (
    env.AZURE_SPEECH_KEY ||
    env.AZURE_OPENAI_TRANSCRIBE_API_KEY ||
    env.AZURE_OPENAI_API_KEY ||
    ''
  ).trim()
  const model = (
    env.AZURE_SPEECH_TRANSCRIBE_MODEL ||
    env.AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT ||
    ''
  ).trim()
  // Region has no legacy fallback — it's only needed by the streaming token path.
  const region = (env.AZURE_SPEECH_REGION || '').trim()
  return { endpoint, apiKey, model, region }
}

/** True when a usable Gemini key is configured. */
export function hasGeminiKey(env: ProviderEnv = process.env): boolean {
  const key = env.GEMINI_API_KEY
  return typeof key === 'string' && key.trim().length > 0
}

/** True when an Azure OpenAI-compatible endpoint + key are both configured. */
export function hasAzureConfig(env: ProviderEnv = process.env): boolean {
  const key = env.AZURE_OPENAI_API_KEY
  const endpoint = env.AZURE_OPENAI_ENDPOINT
  return (
    typeof key === 'string' &&
    key.trim().length > 0 &&
    typeof endpoint === 'string' &&
    endpoint.trim().length > 0
  )
}

/**
 * True when Azure AI Speech fast transcription is fully configured: a Speech
 * endpoint + key + model must all be present (each resolved with the legacy
 * fallbacks). Unlike the chat deployment (which has a sensible default),
 * transcription has no fallback model, so the model name is required.
 */
export function hasTranscribeConfig(env: TranscribeEnv = process.env): boolean {
  const { endpoint, apiKey, model } = resolveTranscribeConfig(env)
  return endpoint.length > 0 && apiKey.length > 0 && model.length > 0
}

/**
 * True when the streaming Speech token path is fully configured: a Speech
 * endpoint + key + region must all be present. The real-time Speech SDK
 * authenticates with a short-lived token + region (NOT the model), so unlike
 * {@link hasTranscribeConfig} the region is required and the model is not.
 */
export function hasSpeechTokenConfig(env: TranscribeEnv = process.env): boolean {
  const { endpoint, apiKey, region } = resolveTranscribeConfig(env)
  return endpoint.length > 0 && apiKey.length > 0 && region.length > 0
}

/** Select the review provider based on the environment (Azure > Gemini > mock). */
export function selectProvider(env: ProviderEnv = process.env): ReviewProvider {
  if (hasAzureConfig(env)) {
    return new AzureProvider(
      env.AZURE_OPENAI_ENDPOINT!.trim(),
      env.AZURE_OPENAI_API_KEY!.trim(),
      env.AZURE_OPENAI_DEPLOYMENT,
    )
  }
  if (hasGeminiKey(env)) {
    return new GeminiProvider(env.GEMINI_API_KEY!.trim(), env.GEMINI_MODEL_ID)
  }
  return new MockProvider()
}
