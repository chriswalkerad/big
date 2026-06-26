// Zod schemas for everything that crosses a trust boundary: the POST /api/review
// request body and the ReviewResult a provider returns. All external/AI data is
// validated here so the rest of the app can rely on the typed shapes from @/types.

import { z } from 'zod'
import type {
  ApplyRequest,
  Person,
  Project,
  ReviewRequest,
  ReviewResult,
  SignalDef,
  SignalIssue,
  SignalResult,
} from '@/types'

// Upper bound on the document text forwarded to the AI provider. A short creative
// concept (premise, character sketch, brief, script excerpt) is well under this;
// the cap rejects an oversized body with a typed validation error BEFORE it reaches
// a paid model on a 60s timeout, rather than forwarding unbounded input.
export const MAX_TEXT_LENGTH = 50_000

const documentTextSchema = z
  .string()
  .max(MAX_TEXT_LENGTH, `Text must be at most ${MAX_TEXT_LENGTH.toLocaleString()} characters.`)

export const textSubtypeSchema = z.enum([
  'story_premise',
  'character_concept',
  'world_building',
  'script_excerpt',
  'creative_brief',
])

export const signalModeSchema = z.enum(['inline', 'doc'])

export const severitySchema = z.enum(['risk', 'minor'])

export const verdictLabelSchema = z.enum(['looks_ready', 'needs_work', 'not_ready'])

export const personSchema: z.ZodType<Person> = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
})

export const projectSchema: z.ZodType<Project> = z.object({
  id: z.string(),
  name: z.string(),
  audience: z.string(),
  franchiseContext: z.string(),
  tags: z.array(z.string()),
  owner: personSchema,
})

export const signalDefSchema: z.ZodType<SignalDef> = z.object({
  id: z.string(),
  name: z.string(),
  prompt: z.string(),
  threshold: z.number(),
  mode: signalModeSchema,
})

export const signalIssueSchema: z.ZodType<SignalIssue> = z.object({
  quote: z.string(),
  message: z.string(),
  severity: severitySchema,
})

export const signalResultSchema: z.ZodType<SignalResult> = z.object({
  signalId: z.string(),
  // Signals score on a 0–100 scale. A real model occasionally emits a value
  // fractionally out of range (e.g. 100.5, -1) from rounding artifacts. Clamp
  // into 0–100 (and round to an integer) rather than rejecting — throwing here
  // would surface as AI_BAD_JSON and lose the entire review over one stray score.
  score: z
    .number()
    .transform((v) => Math.round(Math.max(0, Math.min(100, v)))),
  rationale: z.string(),
  issues: z.array(signalIssueSchema),
})

export const reviewVerdictSchema = z.object({
  label: verdictLabelSchema,
  flagCount: z.number(),
})

export const reviewResultSchema: z.ZodType<ReviewResult> = z.object({
  detectedSubtype: textSubtypeSchema,
  suggestedTitle: z.string(),
  themes: z.array(z.string()),
  signals: z.array(signalResultSchema),
  verdict: reviewVerdictSchema,
  summary: z.string().optional(),
  suggestedPrompt: z.string().optional(),
})

/** Request body for POST /api/review. */
export const reviewRequestSchema: z.ZodType<ReviewRequest> = z.object({
  text: documentTextSchema,
  project: projectSchema,
  signals: z.array(signalDefSchema),
})

/** Request body for POST /api/apply. */
export const applyRequestSchema: z.ZodType<ApplyRequest> = z.object({
  text: documentTextSchema,
  instruction: z.string(),
  project: projectSchema,
})

export type ReviewResultInput = z.input<typeof reviewResultSchema>
export type ReviewRequestInput = z.input<typeof reviewRequestSchema>
export type ApplyRequestInput = z.input<typeof applyRequestSchema>
