// Provider selection. The only reason the server exists is to keep the Gemini key
// off the client: if GEMINI_API_KEY is present we use the real provider, otherwise
// the deterministic mock. Factored out so it can be unit-tested without a key.
// See specs/bsp-backend-build-spec.md.

import { GeminiProvider } from './gemini'
import { MockProvider } from './mock'
import type { ReviewProvider } from './interface'

export type ProviderEnv = {
  GEMINI_API_KEY?: string
  GEMINI_MODEL_ID?: string
} & Record<string, string | undefined>

/** True when a usable Gemini key is configured. */
export function hasGeminiKey(env: ProviderEnv = process.env): boolean {
  const key = env.GEMINI_API_KEY
  return typeof key === 'string' && key.trim().length > 0
}

/** Select the review provider based on the environment. */
export function selectProvider(env: ProviderEnv = process.env): ReviewProvider {
  if (hasGeminiKey(env)) {
    return new GeminiProvider(env.GEMINI_API_KEY!.trim(), env.GEMINI_MODEL_ID)
  }
  return new MockProvider()
}
