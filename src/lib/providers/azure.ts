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
import type { ReviewInput, ReviewProvider } from './interface'
import { buildPrompt, buildSystemInstruction } from './gemini'

export const DEFAULT_AZURE_DEPLOYMENT = 'gpt-5.5'

/** gpt-5-class reasoning models can take longer than a flash model, so allow more. */
const REQUEST_TIMEOUT_MS = 60_000

// JSON Schema for OpenAI strict structured outputs, mirroring ReviewResult.
// Strict mode requires every object to set additionalProperties:false and list
// all of its properties in "required" — ReviewResult already requires them all.
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
          score: { type: 'number' },
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
  },
  required: ['detectedSubtype', 'suggestedTitle', 'themes', 'signals', 'verdict'],
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
}
