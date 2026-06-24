// Seed records loaded by StorageRepository on first run (empty localStorage).
// Grounded in Big Shot Pictures' first franchise, Eloise at The Plaza (kids 6-12).
// The four documents are designed to produce specific scorecards so the demo shows
// range: a happy path, a soft-gate, a risk, and a thin stub. Inline issue `quote`
// values are EXACT substrings of each body so canvas highlighting anchors.
// See specs/bsp-seed-data-spec.md — do not paraphrase the bodies.

import type { Document, Project, ReviewResult, SignalDef } from '@/types'

export const seedProject: Project = {
  id: 'proj-eloise',
  name: 'Eloise at The Plaza',
  audience: 'Kids 6-12 and their families',
  franchiseContext:
    "Eloise is a precocious, mischievous six-year-old who lives at New York's Plaza Hotel with her Nanny, her dog Weenie, and her turtle Skipperdee. Big Shot is reimagining the franchise digital-first: YouTube shorts and series to build audience and fan love before expanding to theatrical, streaming, games, and consumer products. Voice is playful, witty, warm, and upscale-Manhattan whimsical. Everything must be family-safe for ages 6-12.",
  tags: ['family', 'comedy', 'character-driven', 'YouTube-first', 'ages 6-12'],
}

export const seedSignals: SignalDef[] = [
  {
    id: 'clarity',
    name: 'Clarity',
    mode: 'inline',
    threshold: 7,
    prompt:
      "Judge whether the concept reads clearly on a first pass. Flag any vague, confusing, or contradictory phrase, returning the exact phrase and what's unclear. Score 0-10.",
  },
  {
    id: 'completeness',
    name: 'Completeness',
    mode: 'doc',
    threshold: 7,
    prompt:
      "Check whether the concept includes a clear premise, target audience, format (short/series/film), and a main character. Call out what's missing. Score 0-10, where 10 means nothing important is missing.",
  },
  {
    id: 'brand_safety',
    name: 'Brand Safety',
    mode: 'inline',
    threshold: 7,
    prompt:
      "Reviewing a concept for a kids' brand (ages 6-12). Flag anything unsafe or off-brand for a family audience or kids' platform: violence, scary imagery, mature themes, mean-spirited messaging, or anything advertisers avoid. Return the exact phrase and a one-line reason for each. Score 0-10 for family-safety.",
  },
  {
    id: 'hook_strength',
    name: 'Hook Strength',
    mode: 'doc',
    threshold: 6,
    prompt:
      'Judge whether this grabs attention immediately, like a thumbnail and the first seconds of a YouTube video. Does the premise promise something a kid would stop scrolling for? Quote the opening line or the weakest line in the rationale. Score 0-10.',
  },
  {
    id: 'character',
    name: 'Character Distinctiveness',
    mode: 'doc',
    threshold: 6,
    prompt:
      'Judge whether the lead is specific, memorable, and ownable rather than a generic archetype, with a distinct voice, want, or quirk that could carry a franchise. Score 0-10.',
  },
  {
    id: 'franchise_fit',
    name: 'Franchise Fit',
    mode: 'doc',
    threshold: 6,
    prompt:
      'Judge how well the concept fits the project\'s world, tone, and audience. For Eloise: playful, precocious, upscale-Manhattan voice, family tone for 6-12. Note any mismatch. Score 0-10.',
  },
]

const DOC1_BODY =
  "When the Plaza's kitchen closes for the night, Eloise appoints herself head chef and runs a secret midnight room-service operation for the hotel's sleepless guests: a homesick ballerina, a stage-frightened magician, and one very large, very hungry dog. Every delivery turns into a tiny adventure, and Eloise discovers that the best thing on the menu is a little company. A 6-minute animated short for kids 6-12, built as the pilot for a YouTube series, ending on a runner that teases the next caper."

const DOC1_REVIEW: ReviewResult = {
  detectedSubtype: 'story_premise',
  suggestedTitle: 'Eloise and the Midnight Room-Service Caper',
  themes: ['friendship', 'adventure', 'hospitality'],
  signals: [
    { signalId: 'clarity', score: 9, rationale: 'Reads cleanly on a first pass; premise and format are immediately clear.', issues: [] },
    { signalId: 'completeness', score: 9, rationale: 'Premise, audience (kids 6-12), format (6-minute YouTube pilot), and lead are all present.', issues: [] },
    { signalId: 'brand_safety', score: 10, rationale: 'Warm, gentle, and fully family-safe.', issues: [] },
    { signalId: 'hook_strength', score: 9, rationale: 'A secret midnight room-service operation is an instant, scroll-stopping hook.', issues: [] },
    { signalId: 'character', score: 8, rationale: 'Eloise is specific and ownable, with a clear want and a streak of mischief.', issues: [] },
    { signalId: 'franchise_fit', score: 9, rationale: 'Playful, upscale-Manhattan, family tone — squarely in the Eloise world.', issues: [] },
  ],
  verdict: { label: 'looks_ready', flagCount: 0 },
}

const DOC2_BODY =
  "There's a new kid who moves into the Plaza and becomes Eloise's friend, or maybe her rival. They're really cool and have a whole vibe. Kids will love them. We're not totally sure on the details yet, but the energy is there. Could be a recurring character or a one-off, we'll see."

const DOC2_REVIEW: ReviewResult = {
  detectedSubtype: 'character_concept',
  suggestedTitle: 'A New Friend at the Plaza',
  themes: ['friendship', 'rivalry'],
  signals: [
    {
      signalId: 'clarity',
      score: 4,
      rationale: 'The concept describes a feeling rather than a character, and key details are explicitly unresolved.',
      issues: [
        { quote: "They're really cool and have a whole vibe", message: 'Describes a feeling, not the character', severity: 'minor' },
        { quote: "We're not totally sure on the details yet, but the energy is there", message: 'No concrete details to evaluate', severity: 'minor' },
      ],
    },
    { signalId: 'completeness', score: 4, rationale: 'No audience, format, or concrete character traits.', issues: [] },
    { signalId: 'brand_safety', score: 9, rationale: 'Nothing unsafe or off-brand.', issues: [] },
    { signalId: 'hook_strength', score: 6, rationale: 'A friend-or-rival premise is a serviceable hook but underdeveloped.', issues: [] },
    { signalId: 'character', score: 3, rationale: 'Described by vibe, with no specific trait, want, or quirk.', issues: [] },
    { signalId: 'franchise_fit', score: 6, rationale: 'Plausibly fits the Plaza world, but too thin to be sure.', issues: [] },
  ],
  verdict: { label: 'needs_work', flagCount: 3 },
}

const DOC3_BODY =
  "Eloise discovers that the Plaza's old service elevator is haunted by a vengeful bellhop who was trapped in the shaft decades ago. At night, he drags guests down into the dark, and they're never seen again. Eloise has to outwit him before he comes for Nanny. The tone is genuinely frightening, with real jump scares and a rising body count as the hotel empties out."

const DOC3_REVIEW: ReviewResult = {
  detectedSubtype: 'story_premise',
  suggestedTitle: 'Eloise and the Haunted Service Elevator',
  themes: ['mystery', 'ghost story', 'bravery'],
  signals: [
    { signalId: 'clarity', score: 7, rationale: 'The plot is easy to follow.', issues: [] },
    { signalId: 'completeness', score: 7, rationale: 'Premise, lead, stakes, and tone are all stated.', issues: [] },
    {
      signalId: 'brand_safety',
      score: 2,
      rationale: 'Horror elements and implied deaths are unsafe for a kids 6-12 audience.',
      issues: [
        { quote: "they're never seen again", message: 'Implied harm to people; too dark for ages 6-12', severity: 'risk' },
        { quote: 'a rising body count as the hotel empties out', message: "A body count is off-limits for a kids' brand", severity: 'risk' },
      ],
    },
    { signalId: 'hook_strength', score: 7, rationale: 'A haunted elevator is a strong hook — but in the wrong register for this brand.', issues: [] },
    { signalId: 'character', score: 6, rationale: 'Eloise still reads as herself: resourceful and brave.', issues: [] },
    { signalId: 'franchise_fit', score: 4, rationale: 'A horror tone with a body count clashes with the playful, family-safe Eloise world.', issues: [] },
  ],
  verdict: { label: 'not_ready', flagCount: 2 },
}

const DOC4_BODY = 'Eloise does something on the rooftop. TBD.'

export const seedDocuments: Document[] = [
  {
    id: 'doc-midnight-caper',
    projectId: 'proj-eloise',
    title: 'Eloise and the Midnight Room-Service Caper',
    body: DOC1_BODY,
    subtype: 'story_premise',
    subtypeSource: 'auto',
    status: 'approved',
    routing: 'digital_test',
    createdBy: 'Maya Chen',
    reviewer: 'Theo Park',
    submittedSnapshot: { body: DOC1_BODY, review: DOC1_REVIEW, submittedAt: '2026-06-16T11:00:00.000Z' },
    createdAt: '2026-06-15T09:00:00.000Z',
    updatedAt: '2026-06-18T14:30:00.000Z',
  },
  {
    id: 'doc-new-friend',
    projectId: 'proj-eloise',
    title: 'A New Friend at the Plaza',
    body: DOC2_BODY,
    subtype: 'character_concept',
    subtypeSource: 'auto',
    status: 'submitted',
    createdBy: 'Devon Brooks',
    submittedSnapshot: { body: DOC2_BODY, review: DOC2_REVIEW, submittedAt: '2026-06-19T16:45:00.000Z' },
    createdAt: '2026-06-19T16:00:00.000Z',
    updatedAt: '2026-06-19T16:45:00.000Z',
  },
  {
    id: 'doc-haunted-elevator',
    projectId: 'proj-eloise',
    title: 'Eloise and the Haunted Service Elevator',
    body: DOC3_BODY,
    subtype: 'story_premise',
    subtypeSource: 'auto',
    status: 'changes_requested',
    createdBy: 'Priya Nair',
    reviewer: 'Theo Park',
    submittedSnapshot: { body: DOC3_BODY, review: DOC3_REVIEW, submittedAt: '2026-06-20T10:15:00.000Z' },
    createdAt: '2026-06-20T09:30:00.000Z',
    updatedAt: '2026-06-21T13:00:00.000Z',
  },
  {
    id: 'doc-rooftop-stub',
    projectId: 'proj-eloise',
    title: 'Rooftop idea',
    body: DOC4_BODY,
    subtype: 'world_building',
    subtypeSource: 'auto',
    status: 'draft',
    createdBy: 'Sam Rivera',
    createdAt: '2026-06-22T08:00:00.000Z',
    updatedAt: '2026-06-22T08:00:00.000Z',
  },
]
