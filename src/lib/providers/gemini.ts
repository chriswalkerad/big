// Real provider backed by Google's Gemini models via @google/genai (v2.x). It is
// SERVER-ONLY: it reads GEMINI_API_KEY and is only ever constructed from the API
// route. It uses structured JSON output (responseMimeType + responseSchema) so the
// model returns a shape close to ReviewResult; the route still re-validates with
// zod before trusting it. Failures are mapped to typed AppErrors.
// See specs/bsp-backend-build-spec.md.

import { GoogleGenAI, Type, type Schema } from '@google/genai'
import type { ReviewResult } from '@/types'
import { appError, toAppError } from '@/lib/errors'
import type { ReviewInput, ReviewProvider } from './interface'

export const DEFAULT_GEMINI_MODEL_ID = 'gemini-3.5-flash'

/** Default per-request timeout; a slow model call maps to AI_TIMEOUT. */
const REQUEST_TIMEOUT_MS = 30_000

// Structured-output schema mirroring ReviewResult. The model is constrained to
// this shape; we still validate with zod downstream because structured output is
// best-effort, not a guarantee.
const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    detectedSubtype: {
      type: Type.STRING,
      enum: ['story_premise', 'character_concept', 'world_building', 'script_excerpt', 'creative_brief'],
    },
    suggestedTitle: { type: Type.STRING },
    themes: { type: Type.ARRAY, items: { type: Type.STRING } },
    signals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          signalId: { type: Type.STRING },
          score: { type: Type.NUMBER },
          rationale: { type: Type.STRING },
          issues: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                quote: { type: Type.STRING },
                message: { type: Type.STRING },
                severity: { type: Type.STRING, enum: ['risk', 'minor'] },
              },
              required: ['quote', 'message', 'severity'],
              propertyOrdering: ['quote', 'message', 'severity'],
            },
          },
        },
        required: ['signalId', 'score', 'rationale', 'issues'],
        propertyOrdering: ['signalId', 'score', 'rationale', 'issues'],
      },
    },
    verdict: {
      type: Type.OBJECT,
      properties: {
        label: { type: Type.STRING, enum: ['looks_ready', 'needs_work', 'not_ready'] },
        flagCount: { type: Type.NUMBER },
      },
      required: ['label', 'flagCount'],
      propertyOrdering: ['label', 'flagCount'],
    },
    summary: { type: Type.STRING },
    suggestedPrompt: { type: Type.STRING },
  },
  required: ['detectedSubtype', 'suggestedTitle', 'themes', 'signals', 'verdict', 'summary', 'suggestedPrompt'],
  propertyOrdering: [
    'detectedSubtype',
    'suggestedTitle',
    'themes',
    'signals',
    'verdict',
    'summary',
    'suggestedPrompt',
  ],
}

export function buildSystemInstruction(input: ReviewInput): string {
  const { project } = input
  return [
    'You are a creative-development reviewer for a studio. You review a single creative concept against a fixed set of signals and return a structured assessment.',
    '',
    'PROJECT CONTEXT',
    `Name: ${project.name}`,
    `Audience: ${project.audience}`,
    `Tags: ${project.tags.join(', ')}`,
    `Franchise context: ${project.franchiseContext}`,
    '',
    'OUTPUT RULES',
    '- Return JSON only, matching the provided schema exactly. No prose outside the JSON.',
    '- For every signal in the criteria below, return one entry in "signals" whose "signalId" is that signal\'s id.',
    '- Score each signal 0-10.',
    '- Only signals whose mode is "inline" may include "issues". Doc-mode signals must return an empty "issues" array.',
    '- Each issue\'s "quote" MUST be an EXACT, VERBATIM substring of the concept text below — copy it character-for-character, do not paraphrase, trim, or correct it. If you cannot quote verbatim, omit the issue.',
    '- Brand-safety issues use severity "risk"; clarity/other inline issues use severity "minor".',
    '- "flagCount" is the number of signals scoring below their threshold. Verdict: "looks_ready" if none are below threshold; "not_ready" if any Brand Safety signal is below threshold OR 4+ signals are flagged; otherwise "needs_work".',
    '- "summary": a 1-3 sentence plain-language overview of what the author should do next. Reference the lowest-scoring signals and call out any brand-safety risk specifically. Be concrete and actionable.',
    '- "suggestedPrompt": a ready-to-paste prompt the author can give an AI to revise their text in line with this review. Target the weakest signals, instruct the AI to keep audience/format/on-brand details intact, and end with a placeholder like "[paste your text here]" for the author\'s concept.',
  ].join('\n')
}

export function buildPrompt(input: ReviewInput): string {
  const { text, signals } = input
  const criteria = signals
    .map(
      (s, i) =>
        `${i + 1}. id="${s.id}" name="${s.name}" mode="${s.mode}" threshold=${s.threshold}\n   prompt: ${s.prompt}`,
    )
    .join('\n')
  return [
    'CONCEPT TEXT (quote exact substrings from here):',
    '"""',
    text,
    '"""',
    '',
    'SIGNAL CRITERIA (return one signal entry per id):',
    criteria,
  ].join('\n')
}

export class GeminiProvider implements ReviewProvider {
  private readonly client: GoogleGenAI
  private readonly modelId: string

  constructor(apiKey: string, modelId?: string) {
    this.client = new GoogleGenAI({ apiKey })
    this.modelId = modelId ?? process.env.GEMINI_MODEL_ID ?? DEFAULT_GEMINI_MODEL_ID
  }

  async review(input: ReviewInput): Promise<ReviewResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await this.client.models.generateContent({
        model: this.modelId,
        contents: buildPrompt(input),
        config: {
          systemInstruction: buildSystemInstruction(input),
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2,
          abortSignal: controller.signal,
        },
      })

      const raw = response.text
      if (!raw || !raw.trim()) {
        throw appError('AI_BAD_JSON', 'The model returned an empty response.')
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch (e) {
        throw appError('AI_BAD_JSON', "Couldn't parse the model's JSON response.", e)
      }

      // Trust nothing: the route validates against the zod ReviewResult schema. We
      // return the parsed value typed loosely; the route does the real check.
      return parsed as ReviewResult
    } catch (e) {
      // toAppError already maps AbortError -> AI_TIMEOUT, status 429 -> AI_RATE_LIMIT,
      // fetch/offline -> NETWORK_OFFLINE, SyntaxError/json -> AI_BAD_JSON, and passes
      // through AppErrors we threw above unchanged.
      throw toAppError(e)
    } finally {
      clearTimeout(timer)
    }
  }
}
