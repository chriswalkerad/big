// Real provider backed by an Azure AI Foundry deployment exposed through the
// OpenAI-compatible endpoint (/openai/v1). SERVER-ONLY: it reads
// AZURE_OPENAI_API_KEY / AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_DEPLOYMENT and is
// only constructed from the API route. It uses OpenAI structured outputs
// (response_format json_schema) so the model returns a shape close to
// ReviewResult; the route still re-validates with zod before trusting it.
// Failures map to typed AppErrors. The system/user prompt is shared with the
// Gemini provider so both real providers review against the identical rules.

import OpenAI from 'openai'
import type { ReviewResult } from '@/types'
import { appError, toAppError } from '@/lib/errors'
import { hasTranscribeConfig, resolveTranscribeConfig, type TranscribeEnv } from './select'
import type { ApplyInput, ReviewInput, ReviewProvider } from './interface'
import {
  buildApplyPrompt,
  buildApplySystemInstruction,
  buildPrompt,
  buildSystemInstruction,
} from './gemini'

export const DEFAULT_AZURE_DEPLOYMENT = 'gpt-5.5'

/** gpt-5-class reasoning models can take longer than a flash model, so allow more. */
const REQUEST_TIMEOUT_MS = 60_000

// JSON Schema for OpenAI strict structured outputs, mirroring ReviewResult.
// Strict mode requires every object to set additionalProperties:false and list
// all of its properties in "required". ReviewResult's two optional fields
// (summary, suggestedPrompt) are listed in "required" here so strict stays valid;
// the model always emits them, and the route re-validates with zod regardless.
const RESPONSE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    detectedSubtype: {
      type: 'string',
      enum: ['story_premise', 'character_concept', 'world_building', 'script_excerpt', 'creative_brief'],
    },
    suggestedTitle: { type: 'string' },
    themes: { type: 'array', items: { type: 'string' } },
    signals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          signalId: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 100 },
          rationale: { type: 'string' },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                quote: { type: 'string' },
                message: { type: 'string' },
                severity: { type: 'string', enum: ['risk', 'minor'] },
              },
              required: ['quote', 'message', 'severity'],
            },
          },
        },
        required: ['signalId', 'score', 'rationale', 'issues'],
      },
    },
    verdict: {
      type: 'object',
      additionalProperties: false,
      properties: {
        label: { type: 'string', enum: ['looks_ready', 'needs_work', 'not_ready'] },
        flagCount: { type: 'number' },
      },
      required: ['label', 'flagCount'],
    },
    summary: { type: 'string' },
    suggestedPrompt: { type: 'string' },
  },
  // Strict json_schema requires every property to be listed in "required". These
  // two are optional on ReviewResult, but the model always returns them (asked for
  // in buildSystemInstruction), so listing them keeps strict mode valid.
  required: ['detectedSubtype', 'suggestedTitle', 'themes', 'signals', 'verdict', 'summary', 'suggestedPrompt'],
}

export class AzureProvider implements ReviewProvider {
  private readonly endpoint: string
  private readonly apiKey: string
  private readonly deployment: string
  private client: OpenAI | undefined

  constructor(endpoint: string, apiKey: string, deployment?: string) {
    // baseURL points at the OpenAI-compatible surface, e.g.
    // https://<resource>.services.ai.azure.com/openai/v1
    this.endpoint = endpoint
    this.apiKey = apiKey
    this.deployment = deployment?.trim() || DEFAULT_AZURE_DEPLOYMENT
  }

  // Construct the SDK client lazily, on first use. The provider is only ever
  // exercised from the server route, so the client never needs to exist until a
  // review actually runs (and construction stays out of the constructor).
  private getClient(): OpenAI {
    return (this.client ??= new OpenAI({ baseURL: this.endpoint, apiKey: this.apiKey }))
  }

  async review(input: ReviewInput): Promise<ReviewResult> {
    try {
      const completion = await this.getClient().chat.completions.create(
        {
          model: this.deployment,
          messages: [
            { role: 'system', content: buildSystemInstruction(input) },
            { role: 'user', content: buildPrompt(input) },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'review_result', schema: RESPONSE_JSON_SCHEMA, strict: true },
          },
        },
        { timeout: REQUEST_TIMEOUT_MS },
      )

      const raw = completion.choices[0]?.message?.content
      if (!raw || !raw.trim()) {
        throw appError('AI_BAD_JSON', 'The model returned an empty response.')
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch (e) {
        throw appError('AI_BAD_JSON', "Couldn't parse the model's JSON response.", e)
      }

      // Trust nothing: the route validates against the zod ReviewResult schema.
      return parsed as ReviewResult
    } catch (e) {
      // toAppError maps timeouts -> AI_TIMEOUT, 429 -> AI_RATE_LIMIT, 5xx ->
      // AI_UNAVAILABLE, offline -> NETWORK_OFFLINE, and passes AppErrors through.
      throw toAppError(e)
    }
  }

  async applyEdit(input: ApplyInput): Promise<string> {
    try {
      const completion = await this.getClient().chat.completions.create(
        {
          model: this.deployment,
          messages: [
            { role: 'system', content: buildApplySystemInstruction(input) },
            { role: 'user', content: buildApplyPrompt(input) },
          ],
        },
        { timeout: REQUEST_TIMEOUT_MS },
      )

      const raw = completion.choices[0]?.message?.content
      if (!raw || !raw.trim()) {
        throw appError('AI_BAD_JSON', 'The model returned an empty rewrite.')
      }
      return raw.trim()
    } catch (e) {
      throw toAppError(e)
    }
  }
}

// ---------------------------------------------------------------------------
// Speech-to-text (voice dictation). Azure-only, and intentionally NOT part of the
// ReviewProvider interface: it has nothing to do with reviewing text, and the mock /
// Gemini providers don't offer it. It calls the Azure AI Speech "fast transcription"
// API (model MAI-Transcribe-1.5) directly over fetch — a distinct Speech resource
// from the chat model, with its own endpoint/key/model (AZURE_SPEECH_ENDPOINT /
// AZURE_SPEECH_KEY / AZURE_SPEECH_TRANSCRIBE_MODEL); legacy AZURE_OPENAI_TRANSCRIBE_*
// names remain as fallbacks — see resolveTranscribeConfig.

/** Speech fast-transcription is quick, but keep a generous ceiling for long clips. */
const TRANSCRIBE_TIMEOUT_MS = 60_000

/** Azure AI Speech fast-transcription API version. */
const TRANSCRIBE_API_VERSION = '2025-10-15'

/** Shape of the fast-transcription response we read text out of. */
interface FastTranscriptionResponse {
  combinedPhrases?: Array<{ text?: string }>
  phrases?: Array<{ text?: string }>
}

/** Join the transcript text from a fast-transcription response: prefer
 * `combinedPhrases`, falling back to `phrases`. Returns the trimmed result. */
function extractTranscript(body: FastTranscriptionResponse): string {
  const source = body.combinedPhrases?.length ? body.combinedPhrases : body.phrases
  return (source ?? [])
    .map((p) => p.text ?? '')
    .join(' ')
    .trim()
}

/**
 * Transcribe an audio clip (the client sends WAV) to plain text via the Azure AI
 * Speech fast-transcription API (MAI-Transcribe-1.5). SERVER-ONLY. Throws a typed
 * AppError on any failure; the route catches and serializes it. Assumes the caller
 * has already checked {@link hasTranscribeConfig}.
 */
export async function transcribeAudio(
  audio: Blob | File,
  env: TranscribeEnv = process.env,
): Promise<string> {
  try {
    if (!hasTranscribeConfig(env)) {
      // Defensive: the route short-circuits before calling, but never assume.
      throw appError('AI_UNAVAILABLE', 'Speech-to-text is not configured.')
    }
    const { endpoint, apiKey, model } = resolveTranscribeConfig(env)

    // Build the fast-transcription URL off the resolved endpoint (no trailing slash).
    const base = endpoint.replace(/\/+$/, '')
    const url = `${base}/speechtotext/transcriptions:transcribe?api-version=${TRANSCRIBE_API_VERSION}`

    // multipart/form-data: the audio file + a JSON `definition` enabling enhanced
    // (fast) mode with the configured model. Let fetch set the boundary.
    const form = new FormData()
    form.append('audio', audio, 'audio.wav')
    form.append(
      'definition',
      JSON.stringify({
        enhancedMode: { enabled: true, model, transcribeStyle: 'verbatim' },
      }),
    )

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Ocp-Apim-Subscription-Key': apiKey },
        body: form,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) {
      // Read the body best-effort for context; status drives the error mapping.
      const detail = await res.text().catch(() => '')
      throw appError(
        res.status === 429 ? 'AI_RATE_LIMIT' : res.status >= 500 ? 'AI_UNAVAILABLE' : 'UNKNOWN',
        `Speech transcription failed (HTTP ${res.status}).${detail ? ` ${detail}` : ''}`,
      )
    }

    const body = (await res.json()) as FastTranscriptionResponse
    const text = extractTranscript(body)
    if (!text) {
      throw appError('AI_BAD_JSON', 'The transcription came back empty.')
    }
    return text
  } catch (e) {
    // Maps AbortError -> AI_TIMEOUT, offline -> NETWORK_OFFLINE, and passes
    // AppErrors through unchanged.
    throw toAppError(e)
  }
}
