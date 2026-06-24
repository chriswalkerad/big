# Seed Data Spec: Creative Review Workspace

## YOUR JOB
You are creating the seed data file for a Next.js creative-review app. Read this entire document, then produce a single TypeScript file that exports the seed records described below. The `StorageRepository` (built by the backend agent) calls this file on first run when localStorage is empty. Do not invent additional records. Do not change the signal IDs; they are referenced by name throughout the codebase. **Follow the Git Conventions doc (`bsp-git-conventions.md`) for every commit.**

**Deliverables checklist (verify before finishing):**
- [ ] `src/lib/seed-data.ts` — exports `seedProject`, `seedSignals`, `seedDocuments`
- [ ] All four documents have exact body text as written below (no paraphrasing — inline quote matching depends on exact substrings)
- [ ] Docs 1, 2, 3 have `submittedSnapshot` populated per their designed review
- [ ] Doc 4 has no `submittedSnapshot` (draft)
- [ ] All six signal IDs match exactly: `clarity`, `completeness`, `brand_safety`, `hook_strength`, `character`, `franchise_fit`
- [ ] `npm run build` passes

---

Concrete seed records. Loaded by `StorageRepository` on first run. Grounded in the real company: Big Shot Pictures' first franchise is **Eloise at The Plaza**, aimed at kids 6-12, developed digital-first on YouTube before expanding to film, series, games, and products. Tone is playful, mischievous, warm, upscale-Manhattan, and family-safe.

The four documents are real Eloise-world pitches, each written to produce a specific scorecard so the demo shows range (a happy path, a soft-gate, a risk, and a thin stub). Inline `quote` values are **exact substrings** of each body so highlights anchor.

---

## Project (one, seeded)
```
id: "proj-eloise"
name: "Eloise at The Plaza"
audience: "Kids 6-12 and their families"
franchiseContext: "Eloise is a precocious, mischievous six-year-old who lives at New York's Plaza Hotel with her Nanny, her dog Weenie, and her turtle Skipperdee. Big Shot is reimagining the franchise digital-first: YouTube shorts and series to build audience and fan love before expanding to theatrical, streaming, games, and consumer products. Voice is playful, witty, warm, and upscale-Manhattan whimsical. Everything must be family-safe for ages 6-12."
tags: ["family", "comedy", "character-driven", "YouTube-first", "ages 6-12"]
```

## Signals (six, seeded; all global)
```
[
 { id: "clarity",        name: "Clarity",                  mode: "inline", threshold: 7,
   prompt: "Judge whether the concept reads clearly on a first pass. Flag any vague, confusing, or contradictory phrase, returning the exact phrase and what's unclear. Score 0-10." },
 { id: "completeness",   name: "Completeness",             mode: "doc",    threshold: 7,
   prompt: "Check whether the concept includes a clear premise, target audience, format (short/series/film), and a main character. Call out what's missing. Score 0-10, where 10 means nothing important is missing." },
 { id: "brand_safety",   name: "Brand Safety",             mode: "inline", threshold: 7,
   prompt: "Reviewing a concept for a kids' brand (ages 6-12). Flag anything unsafe or off-brand for a family audience or kids' platform: violence, scary imagery, mature themes, mean-spirited messaging, or anything advertisers avoid. Return the exact phrase and a one-line reason for each. Score 0-10 for family-safety." },
 { id: "hook_strength",  name: "Hook Strength",            mode: "doc",    threshold: 6,
   prompt: "Judge whether this grabs attention immediately, like a thumbnail and the first seconds of a YouTube video. Does the premise promise something a kid would stop scrolling for? Quote the opening line or the weakest line in the rationale. Score 0-10." },
 { id: "character",      name: "Character Distinctiveness",mode: "doc",    threshold: 6,
   prompt: "Judge whether the lead is specific, memorable, and ownable rather than a generic archetype, with a distinct voice, want, or quirk that could carry a franchise. Score 0-10." },
 { id: "franchise_fit",  name: "Franchise Fit",            mode: "doc",    threshold: 6,
   prompt: "Judge how well the concept fits the project's world, tone, and audience. For Eloise: playful, precocious, upscale-Manhattan voice, family tone for 6-12. Note any mismatch. Score 0-10." }
]
```
Severity for inline issues: Brand Safety issues = `risk` (red squiggle); Clarity issues = `minor` (amber squiggle). Hook Strength is `doc` mode and quotes a line in its rationale only; it does not produce squiggles.

## Cast (for created-by / reviewer, to simulate a team)
Authors: Maya Chen, Devon Brooks, Priya Nair, Sam Rivera. Reviewer: Theo Park.

---

## Documents (four)

### Doc 1 — STRONG (happy path) → Approved, routed to Digital test
```
id: "doc-midnight-caper"
projectId: "proj-eloise"
title: "Eloise and the Midnight Room-Service Caper"
subtype: "story_premise"; subtypeSource: "auto"
status: "approved"; routing: "digital_test"
createdBy: "Maya Chen"; reviewer: "Theo Park"
body:
"When the Plaza's kitchen closes for the night, Eloise appoints herself head chef and runs a secret midnight room-service operation for the hotel's sleepless guests: a homesick ballerina, a stage-frightened magician, and one very large, very hungry dog. Every delivery turns into a tiny adventure, and Eloise discovers that the best thing on the menu is a little company. A 6-minute animated short for kids 6-12, built as the pilot for a YouTube series, ending on a runner that teases the next caper."
```
Designed review (submittedSnapshot.review, body == snapshot body):
- clarity 9, completeness 9, brand_safety 10, hook_strength 9, character 8, franchise_fit 9
- issues: none
- verdict: { label: "looks_ready", flagCount: 0 }

### Doc 2 — PROMISING BUT VAGUE (soft-gate) → Submitted
```
id: "doc-new-friend"
projectId: "proj-eloise"
title: "A New Friend at the Plaza"
subtype: "character_concept"; subtypeSource: "auto"
status: "submitted"; reviewer: undefined
createdBy: "Devon Brooks"
body:
"There's a new kid who moves into the Plaza and becomes Eloise's friend, or maybe her rival. They're really cool and have a whole vibe. Kids will love them. We're not totally sure on the details yet, but the energy is there. Could be a recurring character or a one-off, we'll see."
```
Designed review:
- clarity 4, completeness 4, character 3, hook_strength 6, brand_safety 9, franchise_fit 6
- issues:
  - { signalId: "clarity", severity: "minor", quote: "They're really cool and have a whole vibe", message: "Describes a feeling, not the character" }
  - { signalId: "clarity", severity: "minor", quote: "We're not totally sure on the details yet, but the energy is there", message: "No concrete details to evaluate" }
- rationale notes: completeness "No audience, format, or concrete character traits."; character "Described by vibe, with no specific trait, want, or quirk."
- verdict: { label: "needs_work", flagCount: 3 }
  // Three signals below threshold: Clarity (4 < 7), Completeness (4 < 7), Character (3 < 6).

### Doc 3 — RISKY (brand-safety flag) → Changes Requested
```
id: "doc-haunted-elevator"
projectId: "proj-eloise"
title: "Eloise and the Haunted Service Elevator"
subtype: "story_premise"; subtypeSource: "auto"
status: "changes_requested"; reviewer: "Theo Park"
createdBy: "Priya Nair"
body:
"Eloise discovers that the Plaza's old service elevator is haunted by a vengeful bellhop who was trapped in the shaft decades ago. At night, he drags guests down into the dark, and they're never seen again. Eloise has to outwit him before he comes for Nanny. The tone is genuinely frightening, with real jump scares and a rising body count as the hotel empties out."
```
Designed review:
- brand_safety 2, franchise_fit 4, hook_strength 7, clarity 7, completeness 7, character 6
- issues:
  - { signalId: "brand_safety", severity: "risk", quote: "they're never seen again", message: "Implied harm to people; too dark for ages 6-12" }
  - { signalId: "brand_safety", severity: "risk", quote: "a rising body count as the hotel empties out", message: "A body count is off-limits for a kids' brand" }
- rationale notes: franchise_fit "A horror tone with a body count clashes with the playful, family-safe Eloise world."
- verdict: { label: "not_ready", flagCount: 2 }

### Doc 4 — THIN STUB (empty/weak state) → Draft, no review yet
```
id: "doc-rooftop-stub"
projectId: "proj-eloise"
title: "Rooftop idea"
subtype: "world_building"; subtypeSource: "auto"
status: "draft"; reviewer: undefined
createdBy: "Sam Rivera"
body: "Eloise does something on the rooftop. TBD."
submittedSnapshot: undefined
```
(Draft, so no snapshot and no review. Demonstrates the early/empty path in the library and the editor.)

---

## Verdict rule (assumed by the seeds)
The verdict rule is defined once in `bsp-backend-build-spec.md` (the shared-types block) — that is the single source of truth. Restated here only to document what the seeded snapshots assume:
- `looks_ready`: no signals below threshold.
- `needs_work`: one or more below threshold, none of them a Brand Safety risk.
- `not_ready`: any Brand Safety signal below threshold, OR 4+ flags.
`flagCount` = number of signals scoring below their threshold.

## Demo arc this enables
Doc 1 shows the greenlit, routed end-state. Doc 2 is the soft-gate moment (amber Clarity squiggles, low Completeness and Character). Doc 3 shows judgment (red Brand-Safety squiggles, not_ready). Doc 4 drives the empty/early states. A live Submit demo is best done on Doc 4 or a freshly created doc.
