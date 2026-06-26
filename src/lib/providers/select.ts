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
} & Record<string, string | undefined>

/** Env needed for Azure speech-to-text (a subset of ProviderEnv). The index
 * signature keeps `process.env` assignable, matching ProviderEnv's shape. */
export type TranscribeEnv = {
  AZURE_OPENAI_API_KEY?: string
  AZURE_OPENAI_ENDPOINT?: string
  AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT?: string
} & Record<string, string | undefined>

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
 * True when Azure speech-to-text is fully configured: endpoint + key + a
 * transcription deployment must all be present. Unlike the chat deployment (which
 * has a sensible default), transcription has no fallback model, so the deployment
 * name is required.
 */
export function hasTranscribeConfig(env: TranscribeEnv = process.env): boolean {
  const key = env.AZURE_OPENAI_API_KEY
  const endpoint = env.AZURE_OPENAI_ENDPOINT
  const deployment = env.AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT
  return (
    typeof key === 'string' &&
    key.trim().length > 0 &&
    typeof endpoint === 'string' &&
    endpoint.trim().length > 0 &&
    typeof deployment === 'string' &&
    deployment.trim().length > 0
  )
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
