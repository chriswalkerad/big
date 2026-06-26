# Creative Review Workspace

A creative-development review tool for a film/streaming studio. Authors draft short creative concepts (story premises, character concepts, world-building, scripts, briefs); an AI reviewer scores each draft against a configurable set of **signals**; and reviewers read the result, route feedback, and approve. Built as the Big Shot Pictures take-home, grounded in their first franchise — *Eloise at The Plaza* (kids 6-12, digital-first on YouTube) — with a second seeded project (*Speed — The Anime*, teens 13-24) to show the signal set generalizing across audiences.

The core idea: **a structured, explainable review loop.** Instead of a freeform chat, the AI returns a scorecard — a score per signal, a rationale, and inline issues anchored to the exact phrases that triggered them — and the human stays in control of the verdict, the rewrite, and the routing decision.

It runs **zero-config** on a deterministic mock reviewer, so anyone can clone, `npm install && npm run dev`, and exercise the whole flow with **no API key and no database**.

### The 9 interview requirements → where each lives

| # | Requirement | Status | Where it lives |
| --- | --- | --- | --- |
| 1 | React / Next.js web app | **Met** | Next.js 16 App Router + React 19 (`package.json`, `src/app/`) |
| 2 | Create or load a creative submission | **Met** | New-draft flow `src/components/new-document-redirect.tsx` (`/p/[projectId]/d/new`); library `src/app/p/[projectId]/page.tsx`; seeds `src/lib/seed/eloise.ts`, `src/lib/seed/speed.ts`, `src/lib/seed-data.ts` |
| 3 | Review UI for structured analysis | **Met** | `src/components/results-panel.tsx`, `signal-row.tsx`, `signal-bar.tsx`, `score-explanation.tsx` |
| 4 | At least one AI-assisted workflow | **Met** (3 of them) | Run review (`/api/review` → Azure OpenAI / Mock), Apply-AI-rewrite (`/api/apply`), streaming voice dictation (`/api/speech-token` + `src/lib/use-dictation.ts` → Azure Speech) |
| 5 | At least one post-analysis action flow | **Met** | Apply rewrite; submit → pick reviewer (`reviewer-choice.tsx`) → status (`reviewer-status-control.tsx`) → approve + route (`destination-picker.tsx`); reducers in `src/lib/doc-page.ts` |
| 6 | Thoughtful loading / empty / error states | **Met** | `src/components/loading-state.tsx`, `empty-state.tsx`, `error-state.tsx` (typed `AppError` → message + retry) |
| 7 | Some persistence | **Met** | `StorageRepository` over `localStorage` + one-time migration (`src/lib/storage.ts`, `src/lib/migrate.ts`) |
| 8 | Clean component structure | **Met** | `src/types` (single source), `src/lib` (pure logic), `src/lib/providers` (interface + impls), `src/components` (shared, no dupes) |
| 9 | Clear README | **Met** | This file |

> One honest note on scope (not a requirement gap): the studio brief explicitly de-scoped **submission version history, auth/multi-user, a database, rich-text, and a board view** — see [section 7](#7-what-i-intentionally-did-not-build).

---

## 1. Product overview

The Creative Review Workspace is where a small creative team drafts and triages early-stage concepts for a franchise. It serves three roles:

- **Authors** write a concept in a full-page editor (typing or by voice), can ask the AI to **rewrite** it against a suggested prompt, then **Submit** it for review. An AI pass scores the draft against the project's signals (clarity, brand safety, hook strength, and so on), suggests a title and subtype, and surfaces inline issues anchored to the exact phrases that triggered them.
- **Reviewers** open a shared link to the *submitted snapshot*, read the verdict and per-signal breakdown, move the document through a status workflow (In Review → Changes Requested → Approved), and on approval **route** it to a downstream destination (Digital Test, Animation, Marketing, Development, Production).
- **A studio admin** can edit the signal set itself — add, rename, re-prompt, re-threshold, or remove signals — which immediately changes what every future review evaluates.

Two projects are seeded so the demo isn't empty and shows the signals generalizing: *Eloise at The Plaza* (kids 6-12) and *Speed — The Anime* (teens 13-24). Each ships pre-built documents engineered to produce a *range* of scorecards — a happy path, a soft-gated "needs work", a brand-safety risk, and a thin draft stub.

---

## 2. Architecture overview

A Next.js App Router project with a **deliberately thin server**. **The only reason a server exists is to keep AI provider keys off the client.** Everything else — data, state, the editor — lives in the browser.

### Layers

- **Shared types** (`src/types/index.ts`) — the single source of truth, imported by both server and client. Core shapes: `Document` (a live `body` plus an optional `submittedSnapshot`), `SignalDef`, `SignalResult`, `ReviewResult`, `ReviewVerdict`, `Person`, and the `AppError` model. Statuses, subtypes, verdict labels and routing destinations are string-literal unions — no stray magic strings.
- **Client data layer** (`src/lib/storage.ts`) — a typed `StorageRepository` over `localStorage` with namespaced keys (`bsp:project:<id>`, `bsp:doc:<id>`, `bsp:signal:<id>`, `bsp:meta:*`). It seeds two projects, six signals, and their documents on first run (`src/lib/seed-data.ts` → `src/lib/seed/{eloise,speed}.ts`). Components never touch `localStorage` directly; on any failure (quota, SSR, disabled storage) it **degrades to an in-memory store for the session** and maps the cause to a typed `STORAGE_QUOTA` / `STORAGE_UNAVAILABLE` error rather than crashing.
- **One-time migration** (`src/lib/migrate.ts`) — gated on a `bsp:meta:migrated` marker, it brings persisted user data forward: rescales legacy `0-10` signal scores to the current `0-100` scale, resolves bare-string reviewers into roster `Person` objects, and strips a leftover prompt placeholder. Never crashes; degrades on error.
- **AI provider abstraction** (`src/lib/providers/`) — a `ReviewProvider` interface (`interface.ts`) with `review()` and `applyEdit()`, and two implementations behind it: a first-class deterministic `MockProvider` (`mock.ts`) and a real `AzureProvider` (`azure.ts`, Azure OpenAI via its OpenAI-compatible Azure AI Foundry endpoint). Selection is **server-side** (`select.ts`): if the Azure keys are present, use Azure; otherwise use the mock.
- **The endpoints** — three thin Node API routes, each with a separately unit-tested `handler.ts`:
  - `POST /api/review` — validates the body with zod, short-circuits empty text (`EMPTY_DOC`), runs the selected provider, **re-validates the provider's output** against the `ReviewResult` schema (`src/lib/schemas.ts`, clamping scores to 0-100), and returns a typed `{ ok, data } | { ok, error }` union. Never throws; stores nothing.
  - `POST /api/apply` — same shape, for the AI rewrite; guards against an empty rewrite.
  - `GET/POST /api/speech-token` — GET is a cheap "is dictation configured?" probe; POST mints a **short-lived** Azure Speech token from the server-side key (sent `no-store`). The subscription key never leaves the server.
- **Pure document logic** (`src/lib/doc-page.ts`, `doc-body.ts`, `doc-transitions.ts`) — framework-free reducers and helpers: verdict formatting, signal-bar color vs. threshold, version-drift detection, the status state machine, submit/resubmit/unsubmit/approve transitions, and HTML↔plain-text bridging for the editor. No React/DOM, so it is fully unit-testable and shared by the page, the panel, and the tests.

### The editor

The body is a **Tiptap / ProseMirror** editor (`src/components/editor/DocumentCanvas.tsx`) — one component, two modes (`edit` | `read`). Composed extensions only — no StarterKit, no rich-text formatting; just `Document`, `Paragraph`, `Text`, `UndoRedo`, and `Placeholder`.

Inline review feedback is drawn by a custom **`SignalHighlight`** decoration layer (`src/components/editor/SignalHighlight.ts`), on two deliberate decisions:

- **Decorations, not marks** — highlights are a transient overlay tied to the latest review run. They paint over the current view, never enter the document schema, never serialize into `body`, and vanish on the next edit.
- **Quote-match, not character offsets** — the model returns the verbatim phrase it flagged; we locate it at render time by string match within a single text node (`from = nodePos + text.indexOf(quote)`). Character offsets drift on every edit and miscount code points; quotes don't. A quote that isn't found is skipped silently rather than mis-anchored.

### Design system

Super-minimal, Linear/Notion restraint (`src/styles/tokens.css`, `bsp-design-tokens-spec.md`): a neutral grayscale ramp where the **only** color in the product is functional — the highlight squiggle (red `risk` / amber `minor`) and the bar fill (pass/near/fail). Light + dark, persisted via `next-themes`, all values are CSS-variable tokens — no hard-coded hex in components.

---

## 3. Setup instructions

**Zero-config — no env vars, no database:**

```bash
npm install
npm run dev
```

This runs on the deterministic `MockProvider`. Open <http://localhost:3000>; it redirects into the seeded *Eloise at The Plaza* project with documents already loaded, and the *Speed* project is available from the project switcher.

### Enabling a real provider (optional)

The mock is fully functional, including the seeded brand-safety squiggles. To use a real model instead, copy the example file and set keys **server-side only** (never in client code):

```bash
cp .env.example .env.local
# then edit .env.local
```

Provider selection is automatic and server-side:

- Set `AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_API_KEY` (deployment defaults to `gpt-5.5`) to use the real **Azure OpenAI** provider via its OpenAI-compatible Azure AI Foundry endpoint.
- With those unset, it stays on the deterministic **Mock** provider.

To enable **voice dictation**, set `AZURE_SPEECH_ENDPOINT` + `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` (a separate Speech resource). With those absent, the mic affordance simply doesn't appear. See [Environment variables](#environment-variables) for the full list; all are optional.

### Scripts & verify

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) on the mock |
| `npm run build` | Production build (passes with no env vars) |
| `npm run lint` | ESLint |
| `npm test` | Run the Vitest suite once (**461 tests across 47 files**) |
| `npm run typecheck` | `tsc --noEmit` (strict) |

### Deploy

Deploys to Vercel as-is (`vercel --prod`). No environment variables are required to run on the mock; add the `AZURE_OPENAI_*` keys (and optionally the `AZURE_SPEECH_*` keys) in the Vercel project settings to enable the real providers.

---

## 4. Key user flows

### Author: draft → (rewrite) → submit → iterate

1. **Edit.** The author writes in the full-page editor, by keyboard or by **voice** (the mic streams live dictation; interim words ghost in and commit on pause). Title is editable; subtype is AI-detected on submit (or user-chosen).
2. **Run review** (non-committal). The author can run an AI review of the current body without submitting — it opens the results panel and paints inline squiggles, but creates no snapshot and changes no status.
3. **Apply an AI rewrite** (optional). When a review carries a `suggestedPrompt`, **Apply** hands the body to `POST /api/apply` for a rewrite, shows a "Rewriting…" non-editable state, then offers **Accept** / **Discard** — the author always confirms the change.
4. **Submit** (button or **Cmd/Ctrl + Enter**). The author must pick a **reviewer** (`reviewer-choice.tsx`), then it calls `POST /api/review`, stores `submittedSnapshot = { body, review, submittedAt }`, auto-advances a `draft` to `submitted`, applies prefill (title/subtype/themes, respecting locked-in user choices), and commits the squiggles.
5. **Results panel** (`results-panel.tsx`): an overall **verdict** ("Looks ready" / "Needs work" / "Not ready") with a flag count ("2 of 6 need attention"), then the **six signal bars** — each with a score, a proportional fill bar colored against *that signal's own threshold*, and a rationale. The two inline signals (Clarity, Brand Safety) list their flagged phrases and draw **inline squiggles** in the body. A **"How is this calculated?"** link opens `score-explanation.tsx`, which explains every signal, its threshold, the bar colors, and the verdict rule.
6. **Bidirectional focus.** Clicking a flagged phrase in the panel scrolls to and emphasizes its squiggle in the canvas; clicking a squiggle focuses the matching panel row (Clarity and Brand Safety only). The **Franchise Fit** row links to a franchise detail panel (audience, tone, world) so a low score is explainable.
7. **Version drift.** "Submitted" is a snapshot, not a live pointer. The author can keep editing after submitting — the snapshot is untouched. When `body !== submittedSnapshot.body`, an "edited since submit" indicator appears with **Resubmit** (re-runs review and *replaces* the snapshot — no history) and **Unsubmit** (manual only — clears the snapshot, returns to `draft`). Editing never auto-unsubmits.

### Reviewer: read snapshot → status → approve + route

The share link points at `/p/[projectId]/d/[docId]/review`. Read mode renders the **submitted snapshot** (its body + its review), not the author's live working copy. The reviewer reads the panel and squiggles, then changes status via `reviewer-status-control.tsx`: **In Review**, **Changes Requested**, or **Approved**. **Approve** opens a destination picker (`destination-picker.tsx`; default **Digital Test**; also Animation, Marketing, Development, Production) and records `routing`. The library doubles as a lightweight reviewer inbox (`review-inbox.tsx`) over the review queue.

### Admin: signal CRUD

`/settings/signals` is full CRUD over the signal definitions — name, prompt, threshold, mode — written through `StorageRepository`. This set is the single source every future review uses, so deleting a signal removes it from the next review.

---

## 5. AI / model approach

### Structured output, not chat

Every AI review returns a **scorecard**, not prose. The provider contract (`src/lib/providers/interface.ts`) is two methods — `review(input) → ReviewResult` and `applyEdit(input) → string` — and the `ReviewResult` shape (signals, scores, rationales, inline issues, verdict, suggested title/subtype/prompt) is the same regardless of which provider produced it.

### The six seeded signals

| ID | Name | Mode | Threshold |
| --- | --- | --- | --- |
| `clarity` | Clarity | inline | 7 |
| `completeness` | Completeness | doc | 7 |
| `brand_safety` | Brand Safety | inline | 7 |
| `hook_strength` | Hook Strength | doc | 6 |
| `character` | Character Distinctiveness | doc | 6 |
| `franchise_fit` | Franchise Fit | doc | 6 |

> Thresholds are authored on the `0-10` scale in the seed and signal admin (matching how a person reasons about them); scores are stored and compared on a `0-100` scale internally. The migration rescales any legacy `0-10` scores forward.

**Inline vs. doc-level.** Only inline-mode signals (Clarity, Brand Safety) carry per-phrase `issues` and render squiggles — Clarity amber (`minor`), Brand Safety red (`risk`). Doc-level signals score the whole document and explain themselves in their rationale; Hook Strength may quote a line but draws no squiggle.

**Bar fill color vs. threshold** (`barTone` in `doc-page.ts`): fill width is proportional to the score; color is relative to that signal's *own* threshold — green at/above, amber just below, red well below.

**Verdict rule** (computed on submit only, never live): `looks_ready` = no signal below its threshold; `not_ready` = any Brand Safety below threshold **or** 4+ signals flagged; `needs_work` = everything else. `flagCount` is the number of signals below threshold.

### Provider selection & trust boundaries

`select.ts` chooses the provider server-side from which keys are present: the real **Azure OpenAI** provider when the `AZURE_OPENAI_*` keys are set, otherwise the deterministic **Mock**. The real provider uses **structured-output mode** (OpenAI `json_schema` strict mode against the Azure AI Foundry endpoint), carrying a system instruction with the project context and one labeled criterion per signal. The model/deployment id is env-configurable (`AZURE_OPENAI_DEPLOYMENT`).

Structured output is best-effort, not a guarantee, so the endpoints **re-validate the model's JSON against the `ReviewResult` zod schema** (`src/lib/schemas.ts`) before the app trusts it; a shape mismatch becomes a typed `AI_BAD_JSON` error, not a crash. Failures map to typed `AppError`s (`AI_TIMEOUT`, `AI_RATE_LIMIT`, `AI_UNAVAILABLE`, `NETWORK_OFFLINE`, `AI_BAD_JSON`). Keys are read only inside the server routes — **never imported or referenced in client code.**

### Why a deterministic mock exists

The `MockProvider` is **first-class, not a stub**. Reviewers run the app with no key, so the mock must produce a believable, *stable* review for any pasted text. It seeds a small PRNG (FNV-1a hash → mulberry32) from the input, so the same text always yields the same result, and scores each signal with real heuristics (length/format cues for Completeness, first-sentence punch for Hook Strength, a risky-word scan for Brand Safety, named-character detection for Character, on/off-brand keywords for Franchise Fit). Crucially, every inline `quote` it emits is an **actual substring** of the input, so canvas highlighting works on the mock — and its risky-word list reproduces the seeded *Haunted Service Elevator* document's stored `not_ready` snapshot and red squiggles. `applyEdit()` is deterministic too (trims hedging filler, prepends a clarifying line), so the rewrite flow demos with no key.

### Voice dictation (the third AI workflow)

`use-dictation.ts` lazily imports the Azure Speech SDK (SSR-safe, off the initial bundle), mints a short-lived token from `/api/speech-token`, and runs continuous recognition: `onInterim` ghosts the in-progress hypothesis in the editor (kept out of undo history) and `onFinal` commits each finalized utterance. It handles token refresh, auth-cancel auto-restart, and mic-permission denial, surfacing a typed `AppError`. The subscription key stays server-side; the client only ever sees a short-lived token + region.

---

## 6. Key tradeoffs I made

- **localStorage, not a database.** The brief asked for "some persistence," not a backend. localStorage keeps the app zero-config and instantly demoable, at the cost of being single-device and single-user. The `StorageRepository` boundary means a real backend could be swapped in without touching components — and an in-memory fallback keeps the session alive if storage is unavailable.
- **Server exists only to hide keys.** No server-side state, no auth, no sessions, no DB. The three routes are thin and stateless; the data model is client-owned. Small surface, easy to reason about.
- **Mock and real provider behind one interface, mock first-class.** Building a deterministic heuristic reviewer (and a deterministic rewriter) is real work, but it makes the app demoable by anyone with no key and gives the tests a stable oracle. The trade is that mock scores are heuristic, not genuinely intelligent. The real Azure OpenAI provider is interchangeable behind the `ReviewProvider` interface, so swapping or adding a provider touches nothing else.
- **Submitted is a snapshot, not a pointer; Resubmit replaces (no history).** Authors routinely work ahead of the version under review, so edits must not disturb what the reviewer sees. I chose replace-on-resubmit over a version stack — simpler, and it matches the product owner's framing — accepting that prior submitted versions are discarded.
- **Quote-match highlighting over stored offsets.** Robust to edits and to LLM imprecision, at the cost of silently skipping a quote that isn't a verbatim single-node substring. Silent-skip beats a crash or a mis-anchored highlight.
- **Scores authored 0-10, compared 0-100.** Humans set thresholds on a 0-10 mental scale; the engine works in 0-100 for finer bar granularity. A one-time migration reconciles legacy data. The extra mapping is the cost of keeping both ergonomic.
- **No rich text.** Plain paragraphs only. Formatting would complicate quote-matching and snapshotting for no value to early-stage concept review.

---

## 7. What I intentionally did not build

Explicitly out of scope per the build specs (`bsp-frontend-build-spec.md` "Out of scope"):

- **Submission version history / stacking / diffing** — Resubmit replaces; the prior submitted version is discarded. No submission timeline.
- **Auth, multi-user, real-time collaboration, cross-device sync, a database.**
- **Rich-text formatting** (bold/italic/headings/marks) in the editor.
- **A board / kanban library** — the document list is a filterable list of rows, not a board, and there's no broader project-management UI.
- **Per-project signal sets.** Signals (the configurable review criteria) are a single **global** set edited in Settings and applied to every project; `SignalDef` has no `projectId` and storage keys them `bsp:signal:<id>` globally. Ideally each project would own its own signal set, but that was a conscious scope decision — keeping one shared set keeps the review pipeline and Settings simple. Per-project signals would mean scoping signals by `projectId` across storage, the review pipeline, and the Settings UI.
- **No delete.** Projects and documents/briefs can be created and edited but not deleted — there is no remove action for either. A conscious scope decision (it also sidesteps destructive-action confirmation UX); a real build would add archive/delete with guards.
- **Live prompting against the franchise** from the signal view — the Franchise Fit row links to a static franchise detail; it does not re-prompt the model live.
- **Live-updating counts.** The rail's inbox badge reads the review queue once on mount (mirroring the original project switcher), so it refreshes on navigation rather than ticking the instant a doc is submitted. A demo simplification; a real build would subscribe to storage changes.
- **Batch file transcription** — an earlier `/api/transcribe` batch route was removed in favor of streaming dictation only; voice is real-time via `/api/speech-token`.

---

## 8. What I would improve with more time

- A real backend + database behind the `StorageRepository` interface, enabling true multi-user review and cross-device access.
- Authentication and per-role permissions (author vs. reviewer vs. admin).
- A **submission history / diff** view — keep prior snapshots and let reviewers compare versions instead of replacing.
- **Streaming the review** so the panel fills in signal-by-signal instead of waiting for the full response.
- Live franchise prompting, so Franchise Fit reasons against the actual world doc rather than heuristics.
- Richer editor affordances (asset embeds, comments/threads on phrases) and a board view as an alternate library layout.

---

## 9. Where AI coding tools helped

This project was built largely **by AI coding agents (Claude Code)** orchestrating parallel sub-agents, with a **human orchestrator** owning product/UX decisions, resolving merge conflicts, and verifying. The git history (~200 commits, ~30 merged feature branches) is itself a deliverable — small, well-scoped Conventional Commits per workstream, per `bsp-git-conventions.md`.

- **Parallel feature branches per workstream.** The backend/data layer, the Tiptap editor, design tokens, seed data, and the frontend screens were each driven by a focused spec (`bsp-*-spec.md`) and landed as separate branches (`feat/voice-backend`, `feat/ds-select`, `feat/ux-docpage`, `feat/rail-library`, …), then merged into an integration branch.
- **Specialized review & QA agents.** A multi-agent code review checked each workstream against its spec — types, lint, tests, duplicate components, hard-coded values (`bsp-review-agent-spec.md`, output in `REVIEW_REPORT.md`) — and a separate QA agent operated the running app like a real user against a scripted matrix (`bsp-qa-agent-spec.md`, `QA_REPORT.md`), plus an accessibility pass (`A11Y_REPORT.md`).
- **Iterative fix branches.** The commit log shows the agents catching and fixing their own integration bugs in focused follow-ups (`fix(dictation)`, `fix(speech-token)`, `fix(storage)`, `fix(editor)`) rather than one big drop — closer to real engineering practice.

The human orchestrator made the product/UX calls (snapshot-vs-pointer, in-panel reviewer choice, the left rail), drove the AI-vs-human task split, and resolved the cross-branch integration.

---

## 10. What I manually verified

Beyond the automated suite, these were checked by hand:

- **Zero-config run:** `npm install && npm run dev` with no environment variables starts cleanly and loads the seeded projects.
- **Build / lint / types / tests:** `npm run build`, `npm run lint`, `npm test` (461 tests / 47 files), and `npm run typecheck` all pass.
- **Seeded review fidelity:** a live mock re-review of the seeded *Haunted Service Elevator* doc reproduces its stored `not_ready` verdict and the expected red Brand Safety squiggles.
- **Submit + drift:** submitting opens the panel with verdict and six bars, requires a reviewer, sets status, and applies prefill; editing afterward shows the drift indicator with working Resubmit (replaces snapshot) and Unsubmit (returns to Draft).
- **AI rewrite:** Apply hands the body to `/api/apply`, shows the rewriting state, and gates the change behind Accept / Discard.
- **Voice dictation:** with Speech keys set, interim words ghost in and commit on pause; with keys absent the mic affordance is hidden and the rest of the app is unaffected.
- **Reviewer flow:** read-mode renders the submitted snapshot, status moves through In Review / Changes Requested / Approved, and Approve opens the destination picker and records routing.
- **Bidirectional focus & theming:** squiggle↔panel focus works both directions; the light/dark toggle persists across reloads with no white flash and visible squiggle colors in dark mode.

---

## Environment variables

All optional — absent keys fall back to the mock (review/apply) or hide the feature (dictation). See `.env.example`. **Never commit real values.**

| Variable | Purpose | Default |
| --- | --- | --- |
| `AZURE_OPENAI_ENDPOINT` | Azure AI Foundry OpenAI-compatible endpoint (enables Azure review/apply) | — |
| `AZURE_OPENAI_API_KEY` | Azure AI Foundry key | — |
| `AZURE_OPENAI_DEPLOYMENT` | Azure chat deployment name | `gpt-5.5` |
| `AZURE_SPEECH_ENDPOINT` | Azure Speech resource endpoint (voice dictation) | — |
| `AZURE_SPEECH_KEY` | Azure Speech subscription key (server-side only) | — |
| `AZURE_SPEECH_REGION` | Azure Speech region — required for streaming dictation | — |

---

## Project layout

```
src/
  app/
    api/{review,apply,speech-token}/   route.ts + handler.ts (each unit-tested)
    p/[projectId]/                     library, document page (edit), /review (read), /d/new
    settings/signals/                  signal CRUD admin
  components/                          shared UI: editor, results panel, signal rows,
                                       reviewer controls, state components (no duplicates)
  lib/
    providers/                         ReviewProvider interface + mock / azure + select
    seed/                              eloise.ts, speed.ts
    storage.ts, migrate.ts             persistence + migration
    doc-page.ts, doc-body.ts, ...      pure, framework-free logic
    *-client.ts, use-dictation.ts      client-side API wiring
  types/index.ts                       single source of truth
  styles/tokens.css                    design tokens (light + dark)
specs/                                 the build specs the agents worked from
```
