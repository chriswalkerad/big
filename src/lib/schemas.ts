// Zod schemas for everything that crosses a trust boundary: the POST /api/review
// request body and the ReviewResult a provider returns. All external/AI data is
// validated here so the rest of the app can rely on the typed shapes from @/types.
// See specs/bsp-backend-build-spec.md.

import { z } from 'zod'
import type {
  Project,
  ReviewRequest,
  ReviewResult,
  SignalDef,
  SignalIssue,
  SignalResult,
} from '@/types'

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

export const projectSchema: z.ZodType<Project> = z.object({
  id: z.string(),
  name: z.string(),
  audience: z.string(),
  franchiseContext: z.string(),
  tags: z.array(z.string()),
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
  score: z.number(),
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
})

/** Request body for POST /api/review. */
export const reviewRequestSchema: z.ZodType<ReviewRequest> = z.object({
  text: z.string(),
  project: projectSchema,
  signals: z.array(signalDefSchema),
})

export type ReviewResultInput = z.input<typeof reviewResultSchema>
export type ReviewRequestInput = z.input<typeof reviewRequestSchema>
