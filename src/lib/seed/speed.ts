// Seed records for the second franchise, Speed — The Anime (teens 13-24, global).
// Mirrors src/lib/seed-data.ts: one *_BODY constant and one *_REVIEW: ReviewResult
// per submitted doc, then the Document[]. Inline issue `quote` values are EXACT
// substrings of each body so canvas highlighting anchors.
// See specs/bsp-seed-data-spec.md — do not paraphrase the bodies.

import type { Document, Project, ReviewResult } from '@/types'

export const speedProject: Project = {
  id: 'proj-speed-anime',
  name: 'Speed — The Anime',
  audience: "Teens 13-24 and anime fans globally; IShowSpeed's 52M+ YouTube subscriber base",
  franchiseContext:
    'An anime-style series starring an animated version of IShowSpeed (Darren Jason Watkins Jr., 21, Ohio). Written by Matt Owens (One Piece live-action co-showrunner for Netflix Seasons 1-2). Harmony Korine attached as producer. IShowSpeed has 52M+ YouTube subscribers, won Streamer of the Year 2024 and 2025. Known for viral IRL streams, sports, gaming, music, and global travel. The series sits at the intersection of creator economy, anime genre, and global youth culture. Plot details under wraps; animated Speed character is confirmed. Big Shot is taking the package to buyers — no platform confirmed yet. Tone: high-energy, globally resonant, anime aesthetics, creator-authentic.',
  tags: ['anime', 'creator-economy', 'teens', 'global', 'YouTube-first', 'IShowSpeed', 'action'],
}

const DOC1_BODY =
  "Speed is a 19-year-old from a small city in Ohio who wakes up one morning to discover he has been pulled into an anime world he has watched obsessively since childhood — except it is not a world from any show he knows. The rules are familiar: there are power levels, rival factions, and ancient prophecies, but they all seem to be organized around sports rather than warfare. Speed's ability to go completely unhinged under pressure turns out to be a rare and legendary power called Chaos Drive, which no fighter in this world has ever survived long enough to master. He has 24 hours to learn the rules, or he gets permanently written out of the story. An anime-style pilot episode, 22 minutes, targeting teens 13-24 and Speed's global fanbase."

const DOC1_REVIEW: ReviewResult = {
  detectedSubtype: 'character_concept',
  suggestedTitle: 'Speed — Origin Episode Concept',
  themes: ['fish-out-of-water', 'underdog', 'creator culture'],
  signals: [
    { signalId: 'clarity', score: 9, rationale: 'Reads cleanly on a first pass; the premise, stakes, and format are immediately clear.', issues: [] },
    { signalId: 'completeness', score: 9, rationale: 'Premise, audience (teens 13-24), format (22-minute anime pilot), and lead are all present.', issues: [] },
    { signalId: 'brand_safety', score: 8, rationale: 'High-energy and competitive, but well within safe bounds for the teen audience.', issues: [] },
    { signalId: 'hook_strength', score: 10, rationale: 'Pulled into the anime he grew up watching, with a 24-hour clock — an instant, scroll-stopping hook.', issues: [] },
    { signalId: 'character', score: 10, rationale: 'Speed is unmistakably himself: Chaos Drive turns his signature unhinged energy into an ownable superpower.', issues: [] },
    { signalId: 'franchise_fit', score: 9, rationale: 'Creator-authentic, anime-native, and globally resonant — squarely in the Speed world.', issues: [] },
  ],
  verdict: { label: 'looks_ready', flagCount: 0 },
}

const DOC2_BODY =
  "The world Speed enters is organized into four factions, each controlling a different sport-as-combat discipline: the Velocity Guild (sprinting and parkour), the Iron Eleven (football, global rules, not American), the Stream Court (basketball, but the court floats), and the Ancient Pitch (a sport no one has played in 300 years, whose rules only Speed seems to instinctively know). Each faction has a power hierarchy and a signature move set. The world has a sky that changes color based on who is currently winning the global standings. Citizens watch faction battles the way Speed's audience watches his streams — in real time, with a live chat that appears as floating kanji in the sky. This document is a world bible excerpt, not a script."

const DOC2_REVIEW: ReviewResult = {
  detectedSubtype: 'world_building',
  suggestedTitle: 'The Anime World — Rules and Factions',
  themes: ['world-building', 'sports-as-combat', 'spectatorship'],
  signals: [
    {
      signalId: 'clarity',
      score: 7,
      rationale: 'The factions and rules read clearly, with one vague mechanic flagged below.',
      issues: [
        {
          quote: 'a sport no one has played in 300 years, whose rules only Speed seems to instinctively know',
          message: 'How Speed knows the rules needs clarification — instinct is vague',
          severity: 'minor',
        },
      ],
    },
    { signalId: 'completeness', score: 6, rationale: 'World bible lacks a clear format recommendation for how this would be introduced on screen.', issues: [] },
    { signalId: 'brand_safety', score: 9, rationale: 'Nothing unsafe or off-brand for the teen audience.', issues: [] },
    { signalId: 'hook_strength', score: 7, rationale: 'Floating courts and a sky that tracks the standings give the world a strong, visual pull.', issues: [] },
    { signalId: 'character', score: 5, rationale: "No character development in this world-building doc — that's expected, but note it.", issues: [] },
    { signalId: 'franchise_fit', score: 8, rationale: 'Sport-as-combat factions and live-chat kanji fit the creator-meets-anime tone well.', issues: [] },
  ],
  verdict: { label: 'needs_work', flagCount: 2 },
}

const DOC3_BODY =
  "In the Shadow Stream arc, Speed comes up against a faction that streams violence rather than sport. Their leader has built a following of millions by broadcasting real fights to the death, monetized through a dark-web streaming platform that operates outside the world's laws. Speed must go undercover in their network, pretending to be a willing participant in brutal cage matches. Several competitors are seriously injured on screen. The arc ends with Speed destroying the platform's servers, but not before a graphic sequence showing the full extent of what the Shadow Stream was broadcasting to its subscribers. Target audience: 17+ if this arc goes in."

const DOC3_REVIEW: ReviewResult = {
  detectedSubtype: 'script_excerpt',
  suggestedTitle: 'Speed vs The Shadow Stream — Arc Concept',
  themes: ['dark arc', 'undercover', 'streaming violence'],
  signals: [
    { signalId: 'clarity', score: 8, rationale: 'The arc and its beats are easy to follow.', issues: [] },
    { signalId: 'completeness', score: 8, rationale: 'Premise, lead, stakes, and intended rating are all stated.', issues: [] },
    {
      signalId: 'brand_safety',
      score: 1,
      rationale: 'Fatal, graphic violence and a 17+ framing are unsafe and off-brand for the target audience.',
      issues: [
        { quote: 'fights to the death', message: 'Fatal violence is off-limits for the target demographic', severity: 'risk' },
        {
          quote: 'Several competitors are seriously injured on screen',
          message: 'On-screen injury at this level is not appropriate for the 13-24 primary audience',
          severity: 'risk',
        },
        {
          quote: 'a graphic sequence showing the full extent of what the Shadow Stream was broadcasting',
          message: 'Graphic content contradicts the family-adjacent brand Big Shot is building with Sony',
          severity: 'risk',
        },
      ],
    },
    { signalId: 'hook_strength', score: 7, rationale: 'An undercover infiltration of a dark streaming network is a strong hook — but in the wrong register.', issues: [] },
    { signalId: 'character', score: 7, rationale: 'Speed still reads as himself: reckless, brave, and willing to go all in.', issues: [] },
    { signalId: 'franchise_fit', score: 3, rationale: 'Dark-web violence and a 17+ rating would prevent the Sony theatrical path and the YouTube launch strategy entirely. Needs a full tone revision.', issues: [] },
  ],
  verdict: { label: 'not_ready', flagCount: 2 },
}

const DOC4_BODY = 'INT. SPEED\'S BEDROOM - MORNING. Speed wakes up. Something is different. TBD from here.'

const DOC5_BODY =
  "The IShowSpeed anime launch on YouTube should be treated as a live event, not a content drop. Speed announces the series in a live stream to his 52M subscribers, revealing his animated character design in real time, with audience reactions driving the clip that gets clipped and re-shared. The first episode drops 72 hours after the announcement, not weeks later, to capture the attention spike. YouTube Premiere format with live chat. Speed hosts a simultaneous IRL stream from a different device reacting to the premiere alongside his audience. Pre-launch: a teaser trailer in anime style, no dialogue, just Speed's voice-over saying 'What if I was in an anime?' Three weeks before launch. This brief covers the digital launch window only. Theatrical and streaming strategy is a separate document."

const DOC5_REVIEW: ReviewResult = {
  detectedSubtype: 'creative_brief',
  suggestedTitle: 'Speed Anime — YouTube Launch Strategy Brief',
  themes: ['launch strategy', 'live event', 'creator economy'],
  signals: [
    { signalId: 'clarity', score: 8, rationale: 'The launch sequence and tactics read clearly on a first pass.', issues: [] },
    { signalId: 'completeness', score: 8, rationale: 'Announcement, format, timing, and pre-launch teaser are all specified for the digital window.', issues: [] },
    { signalId: 'brand_safety', score: 10, rationale: 'Fully safe and on-brand for a YouTube launch.', issues: [] },
    { signalId: 'hook_strength', score: 9, rationale: 'A live reveal to 52M subscribers, treated as an event, is a powerful, scroll-stopping hook.', issues: [] },
    { signalId: 'character', score: 7, rationale: "Leans on Speed's real persona and voice, which carries the brief.", issues: [] },
    { signalId: 'franchise_fit', score: 9, rationale: 'Creator-native, live-first, and globally resonant — exactly the Speed launch playbook.', issues: [] },
  ],
  verdict: { label: 'looks_ready', flagCount: 0 },
}

export const speedDocuments: Document[] = [
  {
    id: 'doc-speed-origin',
    projectId: 'proj-speed-anime',
    title: 'Speed — Origin Episode Concept',
    body: DOC1_BODY,
    subtype: 'character_concept',
    subtypeSource: 'auto',
    status: 'approved',
    routing: 'development',
    createdBy: 'Casey Morgan',
    reviewer: 'Theo Park',
    submittedSnapshot: { body: DOC1_BODY, review: DOC1_REVIEW, submittedAt: '2026-06-12T10:30:00.000Z' },
    createdAt: '2026-06-11T09:00:00.000Z',
    updatedAt: '2026-06-14T15:20:00.000Z',
  },
  {
    id: 'doc-speed-world',
    projectId: 'proj-speed-anime',
    title: 'The Anime World — Rules and Factions',
    body: DOC2_BODY,
    subtype: 'world_building',
    subtypeSource: 'auto',
    status: 'in_review',
    createdBy: 'Sam Rivera',
    reviewer: 'Riley Okafor',
    submittedSnapshot: { body: DOC2_BODY, review: DOC2_REVIEW, submittedAt: '2026-06-17T13:45:00.000Z' },
    createdAt: '2026-06-16T11:15:00.000Z',
    updatedAt: '2026-06-18T09:50:00.000Z',
  },
  {
    id: 'doc-speed-dark',
    projectId: 'proj-speed-anime',
    title: 'Speed vs The Shadow Stream — Arc Concept',
    body: DOC3_BODY,
    subtype: 'script_excerpt',
    subtypeSource: 'auto',
    status: 'changes_requested',
    createdBy: 'Jordan Kim',
    reviewer: 'Theo Park',
    submittedSnapshot: { body: DOC3_BODY, review: DOC3_REVIEW, submittedAt: '2026-06-19T14:00:00.000Z' },
    createdAt: '2026-06-19T08:30:00.000Z',
    updatedAt: '2026-06-20T16:10:00.000Z',
  },
  {
    id: 'doc-speed-pilot-stub',
    projectId: 'proj-speed-anime',
    title: 'Pilot script — opening sequence',
    body: DOC4_BODY,
    subtype: 'script_excerpt',
    subtypeSource: 'auto',
    status: 'draft',
    createdBy: 'Alex Torres',
    createdAt: '2026-06-21T10:00:00.000Z',
    updatedAt: '2026-06-21T10:00:00.000Z',
  },
  {
    id: 'doc-speed-launch',
    projectId: 'proj-speed-anime',
    title: 'Speed Anime — YouTube Launch Strategy Brief',
    body: DOC5_BODY,
    subtype: 'creative_brief',
    subtypeSource: 'user',
    status: 'submitted',
    createdBy: 'Dana Walsh',
    submittedSnapshot: { body: DOC5_BODY, review: DOC5_REVIEW, submittedAt: '2026-06-22T12:30:00.000Z' },
    createdAt: '2026-06-22T11:45:00.000Z',
    updatedAt: '2026-06-22T12:30:00.000Z',
  },
]
