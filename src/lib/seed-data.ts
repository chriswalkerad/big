// Seed records loaded by StorageRepository on first run (empty localStorage).
// Grounded in Big Shot Pictures' two announced franchises — Eloise at The Plaza
// (kids 6-12) and Speed — The Anime (teens 13-24). Each project's documents are
// designed to produce specific scorecards so the demo shows range across both
// franchises. Inline issue `quote` values are EXACT substrings of each body so
// canvas highlighting anchors. The per-project document sets live in
// ./seed/eloise.ts and ./seed/speed.ts; this module aggregates them and owns the
// shared signal definitions. See specs/bsp-seed-data-spec.md — do not paraphrase
// the bodies.

import type { Document, Project, SignalDef } from '@/types'
import { eloiseDocuments, eloiseProject } from './seed/eloise'
import { speedDocuments, speedProject } from './seed/speed'

/**
 * Seed schema version. Bump this whenever the seed content below changes so that
 * StorageRepository refreshes the demo records in already-seeded browsers (it
 * upserts the seed records on a version change without deleting user-created
 * documents). v1 = single Eloise project; v2 = Eloise + Speed (13 documents);
 * v3 = adds Project.owner + Document.reviewer (Person) from the people roster.
 * v4 = rescales signal scores and thresholds from a 0–10 to a 0–100 scale.
 * v5 = re-seed to refresh snapshots that held the stale "[paste your text here]"
 * suggested-prompt placeholder from before it was removed.
 */
export const SEED_VERSION = 5

/** Both seeded projects, in display order. */
export const seedProjects: Project[] = [eloiseProject, speedProject]

/**
 * The project the app opens into, also exported singularly for the consumers
 * (and tests) that reference a single seed project. Kept as `seedProjects[0]`.
 */
export const seedProject: Project = eloiseProject

export const seedSignals: SignalDef[] = [
  {
    id: 'clarity',
    name: 'Clarity',
    mode: 'inline',
    threshold: 70,
    prompt:
      "Judge whether the concept reads clearly on a first pass. Flag any vague, confusing, or contradictory phrase, returning the exact phrase and what's unclear. Score 0-100.",
  },
  {
    id: 'completeness',
    name: 'Completeness',
    mode: 'doc',
    threshold: 70,
    prompt:
      "Check whether the concept includes a clear premise, target audience, format (short/series/film), and a main character. Call out what's missing. Score 0-100, where 100 means nothing important is missing.",
  },
  {
    id: 'brand_safety',
    name: 'Brand Safety',
    mode: 'inline',
    threshold: 70,
    prompt:
      "Reviewing a concept for a kids' brand (ages 6-12). Flag anything unsafe or off-brand for a family audience or kids' platform: violence, scary imagery, mature themes, mean-spirited messaging, or anything advertisers avoid. Return the exact phrase and a one-line reason for each. Score 0-100 for family-safety.",
  },
  {
    id: 'hook_strength',
    name: 'Hook Strength',
    mode: 'doc',
    threshold: 60,
    prompt:
      'Judge whether this grabs attention immediately, like a thumbnail and the first seconds of a YouTube video. Does the premise promise something a kid would stop scrolling for? Quote the opening line or the weakest line in the rationale. Score 0-100.',
  },
  {
    id: 'character',
    name: 'Character Distinctiveness',
    mode: 'doc',
    threshold: 60,
    prompt:
      'Judge whether the lead is specific, memorable, and ownable rather than a generic archetype, with a distinct voice, want, or quirk that could carry a franchise. Score 0-100.',
  },
  {
    id: 'franchise_fit',
    name: 'Franchise Fit',
    mode: 'doc',
    threshold: 60,
    prompt:
      "Judge how well the concept fits the project's world, tone, and audience. For Eloise: playful, precocious, upscale-Manhattan voice, family tone for 6-12. For IShowSpeed Anime: high-energy, global teen audience, anime aesthetics, creator-authentic. Note any mismatch. Score 0-100.",
  },
]

/** Every seeded document across all projects (Eloise first, then Speed). */
export const seedDocuments: Document[] = [...eloiseDocuments, ...speedDocuments]
