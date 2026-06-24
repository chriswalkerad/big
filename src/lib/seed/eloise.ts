// Seed records for the "Eloise at The Plaza" project (Big Shot's first franchise,
// kids 6-12). The eight documents are designed to produce a spread of scorecards so
// the demo shows range: happy paths, soft-gates, a brand-safety risk, and thin stubs.
// Inline issue `quote` values are EXACT substrings of each body so canvas highlighting
// anchors. Do not paraphrase the bodies — see specs/bsp-seed-data-spec.md.

import type { Document, Project, ReviewResult } from '@/types'

export const eloiseProject: Project = {
  id: 'proj-eloise',
  name: 'Eloise at The Plaza',
  audience: 'Kids 6-12 and their families',
  franchiseContext:
    "Eloise is a precocious, mischievous six-year-old who lives at New York's legendary Plaza Hotel with her Nanny, her dog Weenie, and her turtle Skipperdee. Big Shot acquired rights to Kay Thompson's 1955 children's book series (illustrated by Hilary Knight, 15M+ copies sold) and is reimagining it digital-first: YouTube shorts and series to build audience and fan love before expanding to theatrical (Sony first-look), streaming, gaming, and consumer products. Partnering with Adley McBride (A for Adley) on the animated series. Voice is playful, witty, warm, and upscale-Manhattan whimsical. Everything must be family-safe for ages 6-12.",
  tags: ['family', 'comedy', 'character-driven', 'YouTube-first', 'ages 6-12', 'Eloise', 'Plaza Hotel'],
}

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

const DOC5_BODY =
  "Eloise declares the Plaza Hotel the official home of the First Annual Plaza Mini Olympics, recruiting reluctant guests and staff as competitors. Events include Synchronized Elevator Riding, Competitive Nanny Napping (a stealth sport where you tuck sleeping Nannies under blankets before they wake up), and the Grand Lobby Relay. The twist: the French family in Suite 812 turns out to be a dynasty of actual Olympic medalists who take the whole thing very seriously. A 7-minute short for kids 6-12, format TBD between standalone or series pilot."

const DOC5_REVIEW: ReviewResult = {
  detectedSubtype: 'story_premise',
  suggestedTitle: 'The Plaza Mini Olympics',
  themes: ['competition', 'comedy', 'ensemble'],
  signals: [
    { signalId: 'clarity', score: 8, rationale: 'The premise and its events read clearly on a first pass.', issues: [] },
    {
      signalId: 'completeness',
      score: 6,
      rationale: 'Format is flagged as TBD — commit to standalone or pilot before greenlighting.',
      issues: [],
    },
    { signalId: 'brand_safety', score: 9, rationale: 'Lighthearted competition with nothing unsafe or off-brand.', issues: [] },
    { signalId: 'hook_strength', score: 7, rationale: 'A hotel-wide Mini Olympics with invented events is a fun, scroll-stopping hook.', issues: [] },
    { signalId: 'character', score: 7, rationale: 'Eloise drives the chaos with her signature take-charge mischief.', issues: [] },
    { signalId: 'franchise_fit', score: 8, rationale: 'Playful, upscale-Manhattan ensemble comedy — right in the Eloise world.', issues: [] },
  ],
  verdict: { label: 'needs_work', flagCount: 1 },
}

const DOC6_BODY =
  "For one glorious Saturday, Nanny has the day off. Eloise is left in the care of Mr. Salomone the hotel manager, who has never once dealt with a six-year-old, let alone this six-year-old. By noon, Eloise has reorganized the front desk by color, promoted Weenie to assistant concierge, and accidentally double-booked the Grand Ballroom with a dog show and a debutante ball. A 6-minute YouTube short, family comedy, ages 6-12."

const DOC7_BODY =
  "Below the Plaza's basement level is a whole hidden world that only Eloise knows about: a city of hotel staff who never appear on any shift schedule, a forgotten ballroom that only exists at certain times of day, and a long-sealed kitchen run by a chef who claims to have cooked for kings who abdicated before Eloise was born. The below-lobby world operates by its own rules: time moves differently, food tastes of memory rather than flavor, and the only way in is through a service elevator that requires a very specific knock. This is a world-building document for the writers room, not a script. Intended to give the series a sense of magical depth beneath the comedy."

const DOC7_REVIEW: ReviewResult = {
  detectedSubtype: 'world_building',
  suggestedTitle: 'The Below-Lobby World of the Plaza',
  themes: ['world-building', 'magic', 'mystery'],
  signals: [
    {
      signalId: 'clarity',
      score: 8,
      rationale: 'The hidden world and its rules are mostly easy to follow.',
      issues: [
        { quote: 'food tastes of memory rather than flavor', message: 'Evocative but undefined — clarify what this means for a kid audience', severity: 'minor' },
      ],
    },
    { signalId: 'completeness', score: 6, rationale: 'World-building doc is noted as such, but lacks a suggested format for how this would appear on screen.', issues: [] },
    { signalId: 'brand_safety', score: 9, rationale: 'Whimsical and gentle, with nothing unsafe for a family audience.', issues: [] },
    { signalId: 'hook_strength', score: 5, rationale: 'Strong atmosphere but no clear hook for a 6-year-old viewer.', issues: [] },
    { signalId: 'character', score: 5, rationale: 'No specific character introduced in this document.', issues: [] },
    { signalId: 'franchise_fit', score: 7, rationale: 'The magical depth beneath the comedy fits the upscale, whimsical Eloise world.', issues: [] },
  ],
  verdict: { label: 'needs_work', flagCount: 3 },
}

const DOC8_BODY =
  "Season 1 of the Eloise YouTube series consists of 8 shorts, each 5-7 minutes, designed to launch the franchise digitally and build a subscriber base before the Sony theatrical greenlight conversation. Target audience: kids 6-12 and co-viewing parents. Tone: playful, mischievous, warm, and upscale-Manhattan whimsical. Each episode is self-contained with a recurring cast (Eloise, Nanny, Weenie, Skipperdee, Mr. Salomone, and one rotating guest). Episodes end with a small recurring bit — Eloise's 'Note to Self' — that functions as a series signature. Adley McBride consulted on Eloise's voice to ensure authenticity for a modern digital-native kid audience. Distribution: Big Shot YouTube channel, launching summer 2026. Success metric: 1M views per episode within 30 days. If the series performs, Sony theatrical conversation begins in Q4."

const DOC8_REVIEW: ReviewResult = {
  detectedSubtype: 'creative_brief',
  suggestedTitle: 'Eloise Season 1 — YouTube Creative Brief',
  themes: ['strategy', 'franchise launch', 'digital-first'],
  signals: [
    { signalId: 'clarity', score: 9, rationale: 'The strategy, format, and metrics read cleanly on a first pass.', issues: [] },
    { signalId: 'completeness', score: 10, rationale: 'Premise, audience, format, cast, distribution, and success metric are all specified.', issues: [] },
    { signalId: 'brand_safety', score: 10, rationale: 'Entirely family-safe and on-brand for ages 6-12.', issues: [] },
    { signalId: 'hook_strength', score: 8, rationale: 'A clear digital-first launch with a recurring signature bit is compelling.', issues: [] },
    { signalId: 'character', score: 9, rationale: 'Eloise and her recurring cast are specific, distinct, and franchise-ready.', issues: [] },
    { signalId: 'franchise_fit', score: 10, rationale: 'Playful, mischievous, upscale-Manhattan whimsical — exactly the Eloise brand.', issues: [] },
  ],
  verdict: { label: 'looks_ready', flagCount: 0 },
}

export const eloiseDocuments: Document[] = [
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
  {
    id: 'doc-plaza-olympics',
    projectId: 'proj-eloise',
    title: 'The Plaza Mini Olympics',
    body: DOC5_BODY,
    subtype: 'story_premise',
    subtypeSource: 'auto',
    status: 'in_review',
    createdBy: 'Jordan Kim',
    reviewer: 'Riley Okafor',
    submittedSnapshot: { body: DOC5_BODY, review: DOC5_REVIEW, submittedAt: '2026-06-21T15:20:00.000Z' },
    createdAt: '2026-06-21T10:00:00.000Z',
    updatedAt: '2026-06-22T17:45:00.000Z',
  },
  {
    id: 'doc-nanny-day-off',
    projectId: 'proj-eloise',
    title: "Nanny's Day Off",
    body: DOC6_BODY,
    subtype: 'story_premise',
    subtypeSource: 'auto',
    status: 'draft',
    createdBy: 'Maya Chen',
    createdAt: '2026-06-23T09:15:00.000Z',
    updatedAt: '2026-06-23T11:40:00.000Z',
  },
  {
    id: 'doc-plaza-underground',
    projectId: 'proj-eloise',
    title: 'The Below-Lobby World of the Plaza',
    body: DOC7_BODY,
    subtype: 'world_building',
    subtypeSource: 'auto',
    status: 'submitted',
    createdBy: 'Alex Torres',
    submittedSnapshot: { body: DOC7_BODY, review: DOC7_REVIEW, submittedAt: '2026-06-23T14:05:00.000Z' },
    createdAt: '2026-06-23T13:00:00.000Z',
    updatedAt: '2026-06-23T14:05:00.000Z',
  },
  {
    id: 'doc-season1-brief',
    projectId: 'proj-eloise',
    title: 'Eloise Season 1 — YouTube Creative Brief',
    body: DOC8_BODY,
    subtype: 'creative_brief',
    subtypeSource: 'user',
    status: 'approved',
    routing: 'digital_test',
    createdBy: 'Devon Brooks',
    reviewer: 'Riley Okafor',
    submittedSnapshot: { body: DOC8_BODY, review: DOC8_REVIEW, submittedAt: '2026-06-24T10:30:00.000Z' },
    createdAt: '2026-06-24T09:00:00.000Z',
    updatedAt: '2026-06-24T12:15:00.000Z',
  },
]
