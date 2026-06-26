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
  AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT?: string
  AZURE_OPENAI_TRANSCRIBE_ENDPOINT?: string
  AZURE_OPENAI_TRANSCRIBE_API_KEY?: string
} & Record<string, string | undefined>

/** Env needed for Azure speech-to-text (a subset of ProviderEnv). The index
 * signature keeps `process.env` assignable, matching ProviderEnv's shape.
 *
 * Transcription models (e.g. a Foundry/HF-hosted Whisper deployment like
 * openai--whisper-large-v3-turbo) can live on a DIFFERENT inference endpoint than
 * the main chat one, so the endpoint and key are independently overridable and fall
 * back to the main AZURE_OPENAI_* values when unset. */
export type TranscribeEnv = {
  AZURE_OPENAI_API_KEY?: string
  AZURE_OPENAI_ENDPOINT?: string
  AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT?: string
  /** Base URL for the transcription client; defaults to AZURE_OPENAI_ENDPOINT. */
  AZURE_OPENAI_TRANSCRIBE_ENDPOINT?: string
  /** Auth key for the transcription client; defaults to AZURE_OPENAI_API_KEY. */
  AZURE_OPENAI_TRANSCRIBE_API_KEY?: string
} & Record<string, string | undefined>

/** Resolve the effective transcription endpoint/key/deployment, applying the
 * fallbacks to the main Azure values. Returns trimmed strings, possibly empty. */
export function resolveTranscribeConfig(env: TranscribeEnv = process.env): {
  endpoint: string
  apiKey: string
  deployment: string
} {
  const endpoint = (env.AZURE_OPENAI_TRANSCRIBE_ENDPOINT ?? env.AZURE_OPENAI_ENDPOINT ?? '').trim()
  const apiKey = (env.AZURE_OPENAI_TRANSCRIBE_API_KEY ?? env.AZURE_OPENAI_API_KEY ?? '').trim()
  const deployment = (env.AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT ?? '').trim()
  return { endpoint, apiKey, deployment }
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
 * True when Azure speech-to-text is fully configured: a transcription endpoint
 * (its own, or the main one as a fallback) + a key (its own, or the main one) + a
 * transcription deployment must all be present. Unlike the chat deployment (which
 * has a sensible default), transcription has no fallback model, so the deployment
 * name is required.
 */
export function hasTranscribeConfig(env: TranscribeEnv = process.env): boolean {
  const { endpoint, apiKey, deployment } = resolveTranscribeConfig(env)
  return endpoint.length > 0 && apiKey.length > 0 && deployment.length > 0
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
