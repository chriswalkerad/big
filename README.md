# Creative Review Workspace

A creative-development review tool for a studio. Authors draft short creative concepts (story premises, character concepts, scripts, briefs), an AI reviewer scores each draft against a configurable set of **signals**, and reviewers read the result, route feedback, and approve. Built as the Big Shot Pictures take-home, grounded in their first franchise — *Eloise at The Plaza* (kids 6-12, digital-first on YouTube).

It runs **zero-config** on a deterministic mock reviewer, so anyone can clone, `npm install && npm run dev`, and exercise the whole flow with no API key or database.

---

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **TypeScript** (strict, no `any`)
- **Tailwind CSS v4** (CSS-first `@theme`, design-token variables only — no hard-coded hex)
- **Tiptap 3 / ProseMirror** for the document editor
- **zod 4** for validating everything that crosses a trust boundary
- **`@google/genai`** for the optional real Gemini provider
- **next-themes** for persisted light/dark theming
- **Vitest** + Testing Library for unit/component tests
- Client-side persistence via **localStorage** (no database)

---

## Product overview

The Creative Review Workspace is the place a small creative team drafts and triages early-stage concepts for a franchise. It serves two roles:

- **Authors** write a concept in a full-page editor, then **Submit** it for review. An AI pass scores the draft against the project's signals (clarity, brand safety, hook strength, and so on), suggests a title and subtype, and surfaces inline issues anchored to the exact phrases that triggered them.
- **Reviewers** open a shared link to the submitted version, read the verdict and per-signal breakdown, move the document through a status workflow (In Review → Changes Requested → Approved), and on approval route it to a downstream destination (Digital Test, Animation, Marketing, Development, Production).

A studio admin can edit the signal set itself — add, rename, re-prompt, re-threshold, or remove signals — which immediately changes what every future review evaluates.

---

## Architecture overview

The app is a Next.js App Router project with a deliberately thin server. **The only reason a server exists is to keep the Gemini API key off the client.** Everything else — data, state, the editor — lives in the browser.

### Layers

- **Shared types** (`src/types/index.ts`) — the single source of truth imported by both server and client. Core shapes: `Document` (with a live `body` plus an optional `submittedSnapshot`), `SignalDef`, `SignalResult`, `ReviewResult`, `ReviewVerdict`, and the `AppError` model.
- **Client data layer** (`src/lib/storage.ts`) — a typed `StorageRepository` over `localStorage` with namespaced keys (`bsp:project:<id>`, `bsp:doc:<id>`, `bsp:signal:<id>`, `bsp:meta:*`). It seeds one project, six signals, and four documents on first run (`src/lib/seed-data.ts`). Components never touch `localStorage` directly; storage failures map to typed `STORAGE_UNAVAILABLE` / `STORAGE_QUOTA` errors and the app continues in-memory for the session.
- **AI provider abstraction** (`src/lib/providers/`) — a `ReviewProvider` interface (`interface.ts`) with two implementations: a first-class deterministic `MockProvider` (`mock.ts`) and the real `GeminiProvider` (`gemini.ts`). Provider selection is **server-side** (`select.ts`): if `GEMINI_API_KEY` is present, use Gemini; otherwise use the mock.
- **The endpoint** — `POST /api/review` (`src/app/api/review/route.ts`, logic in `handler.ts`). It validates the request body with zod, short-circuits empty text (`EMPTY_DOC`), runs the selected provider, **re-validates the provider's output** against the `ReviewResult` schema (`src/lib/schemas.ts`), and always returns a typed `{ ok: true, data }` / `{ ok: false, error }` discriminated union. It never throws raw and stores nothing.
- **Pure document logic** (`src/lib/doc-page.ts`) — framework-free reducers and helpers for verdict formatting, signal-bar color vs. threshold, version-drift detection, the status state machine, and submit/resubmit/unsubmit transitions. Kept free of React/DOM so it is unit-testable and shared by the page, the drawer, and the tests.

### The editor

The body is a **Tiptap / ProseMirror** editor (`src/components/editor/DocumentCanvas.tsx`) in one component with two modes (`edit` | `read`). Composed extensions only — no StarterKit, no rich-text formatting; just `Document`, `Paragraph`, `Text`, `UndoRedo`, and `Placeholder`.

Inline review feedback is drawn by a custom **`SignalHighlight`** decoration layer (`src/components/editor/SignalHighlight.ts`), built on two deliberate decisions:

- **Decorations, not marks** — highlights are a transient overlay tied to the latest review run. They paint over the current view, never enter the document schema, never serialize into `body`, and vanish on the next edit.
- **Quote-match, not character offsets** — the model returns the verbatim phrase it flagged; we locate it at render time by string match within a single text node (`from = nodePos + text.indexOf(quote)`). Character offsets drift on every edit and count code points wrong; quotes don't. Multi-match takes the first occurrence; a quote that isn't found is skipped silently.

---

## Setup instructions

**Zero-config — no env vars, no database:**

```bash
npm install
npm run dev
```

This runs on the deterministic `MockProvider`. Open <http://localhost:3000>; it redirects into the seeded *Eloise at The Plaza* project with four documents already loaded.

### Using the real Gemini provider (optional)

The mock is fully functional, including the seeded brand-safety squiggles. To use the real model instead, set a key **server-side only** (never in client code):

```bash
cp .env.example .env.local
# then edit .env.local:
GEMINI_API_KEY=your_key_here
GEMINI_MODEL_ID=gemini-3.5-flash   # optional; this is the default
```

`.env.example` ships with both keys (both optional). With a key present, `/api/review` automatically selects `GeminiProvider`; with no key it stays on the mock.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) on the mock |
| `npm run build` | Production build (passes with no env vars) |
| `npm run lint` | ESLint |
| `npm test` | Run the Vitest suite once |
| `npm run typecheck` | `tsc --noEmit` (strict) |

### Deploy

Deploys to Vercel as-is (`vercel --prod`). No environment variables are required to run on the mock; add `GEMINI_API_KEY` in the Vercel project settings to enable the real provider.

---

## Key user flows

### Author: draft → submit → iterate

1. **Edit.** The author writes in the full-page editor. Title is editable; subtype is AI-detected on submit (or user-chosen).
2. **Submit** (button or **Cmd/Ctrl + Enter**). This calls `POST /api/review` with the text, project, and current signal set. On success it stores `submittedSnapshot = { body, review, submittedAt }`, auto-advances a `draft` to `submitted`, applies prefill (title/subtype/themes, respecting any locked-in user choices), and opens the **results drawer**.
3. **Results drawer** (bottom sheet, dismissable, fixed height): an overall **verdict** ("Looks ready" / "Needs work" / "Not ready") with a flag count ("2 of 6 need attention"), then the **six signal bars** — each with score `x/10`, a proportional fill bar colored against that signal's own threshold, and a rationale. The two inline signals (Clarity, Brand Safety) list their flagged phrases and draw **inline squiggles** in the body.
4. **Bidirectional focus.** Clicking a flagged phrase in the drawer scrolls to and emphasizes its squiggle in the canvas; clicking a squiggle focuses the matching drawer row. (Clarity and Brand Safety only.) The **Franchise Fit** row links to a franchise detail panel (audience, tone, world) so a low score is explainable.
5. **Version drift.** "Submitted" is a snapshot, not a live pointer. The author can keep editing after submitting — the snapshot is untouched. When `body !== submittedSnapshot.body`, an "edited since submit" indicator appears with **Resubmit** (re-runs review and *replaces* the snapshot — no history) and **Unsubmit** (manual only — clears the snapshot, returns to `draft`). Editing never auto-unsubmits.

### Reviewer: read snapshot → route → approve

The share link points at `/p/[projectId]/d/[docId]/review`. Read mode renders the **submitted snapshot** (its body + its review), not the author's live working copy. The reviewer reads the drawer and squiggles, then changes status: **In Review**, **Changes Requested**, or **Approved**. **Approve** opens a destination picker (default **Digital Test**; also Animation, Marketing, Development, Production) and records `routing`.

### Admin: signal CRUD

`/settings/signals` is full CRUD over the signal definitions — name, prompt, threshold, mode — written through `StorageRepository`. This set is the single source every future review uses, so deleting a signal removes it from the next review.

---

## AI / model approach

### The six seeded signals

| ID | Name | Mode | Threshold |
| --- | --- | --- | --- |
| `clarity` | Clarity | inline | 7 |
| `completeness` | Completeness | doc | 7 |
| `brand_safety` | Brand Safety | inline | 7 |
| `hook_strength` | Hook Strength | doc | 6 |
| `character` | Character Distinctiveness | doc | 6 |
| `franchise_fit` | Franchise Fit | doc | 6 |

**Inline vs. doc-level.** Only inline-mode signals (Clarity, Brand Safety) carry per-phrase `issues` and render squiggles — Clarity as amber (`minor`), Brand Safety as red (`risk`). Doc-level signals score the whole document and explain themselves in their rationale; Hook Strength may quote a line but draws no squiggle.

**Bar fill color vs. threshold.** Each bar's fill is proportional to `score/10`; its color is relative to that signal's *own* threshold — green at or above threshold, amber 1-2 below, red 3+ below.

**Verdict rule** (computed on submit only, never live):
- `looks_ready` — no signal below its threshold.
- `not_ready` — any Brand Safety signal below threshold, **or** 4+ signals flagged.
- `needs_work` — everything else.

`flagCount` is the number of signals scoring below their threshold.

### Why a deterministic mock exists

The `MockProvider` is **first-class, not a stub**. Reviewers run the app with no key, so the mock must produce a believable, *stable* review for any pasted text. It seeds a small PRNG from a hash of the input, so the same text always yields the same result, and it scores each signal with real heuristics (length/format cues for Completeness, first-sentence punch for Hook Strength, a risky-word scan for Brand Safety, etc.). Crucially, every inline `quote` it emits is an **actual substring** of the input, so canvas highlighting works on the mock — and its risky-word list includes the exact phrases ("body count", "never seen again") that reproduce the seeded *Haunted Service Elevator* document's stored `not_ready` snapshot and red squiggles.

### The real provider and trust boundaries

`GeminiProvider` uses Gemini's structured-output mode (`responseMimeType: application/json` + a `responseSchema` mirroring `ReviewResult`), a system instruction carrying the project context and output rules, and one labeled criterion per signal. Model id is env-configurable (`GEMINI_MODEL_ID`, default `gemini-3.5-flash`). Structured output is best-effort, not a guarantee, so **the endpoint re-validates the model's JSON against the `ReviewResult` zod schema** before the app trusts it; a shape mismatch becomes a typed `AI_BAD_JSON` error rather than a crash. Failures map to typed `AppError`s (`AI_TIMEOUT`, `AI_RATE_LIMIT`, `NETWORK_OFFLINE`, `AI_BAD_JSON`). The key is read only inside the server route — **never imported or referenced in client code.**

---

## Key tradeoffs

- **localStorage, not a database.** The brief asked for "some persistence," not a backend. localStorage keeps the app zero-config and instantly demoable, at the cost of being single-device and single-user. The `StorageRepository` boundary means a real backend could be swapped in without touching components.
- **Server exists only to hide the key.** No server-side state, no auth, no sessions. This keeps the surface tiny and the data model client-owned.
- **Submitted is a snapshot, not a pointer; Resubmit replaces (no history).** Authors routinely work ahead of the version under review, so edits must not disturb what the reviewer sees. We chose replace-on-resubmit over a version stack — simpler and matches the product owner's framing — accepting that prior submitted versions are discarded.
- **Quote-match highlighting over stored offsets.** Robust to edits and to LLM imprecision, at the cost of skipping a quote that isn't a verbatim single-node substring. We judged silent-skip far better than a crash or a mis-anchored highlight.
- **Mock as a first-class provider.** Building a deterministic heuristic reviewer is real work, but it makes the app demoable by anyone with no key and gives tests a stable oracle. The trade is that mock scores are heuristic, not genuinely intelligent.
- **No rich text.** The editor is plain paragraphs only. Formatting would complicate quote-matching and snapshotting for no value to early-stage concept review.

---

## What was not built

Explicitly out of scope per the frontend spec:

- **Submission version history / stacking** — Resubmit replaces; the prior submitted version is discarded. No diffing or submission timeline.
- **Auth, multi-user, real-time collaboration, cross-device sync, a database.**
- **Rich-text formatting** (bold/italic/headings/marks) in the editor.
- **A board / kanban library** — the document list is a filterable list of rows, not a board, and there's no broader project-management UI.
- **Live prompting against the franchise** from the signal view — the Franchise Fit row links to a static franchise detail; it does not re-prompt the model live.

---

## What would be improved with more time

- A real backend + database behind the `StorageRepository` interface, enabling true multi-user review and cross-device access.
- Authentication and per-role permissions (author vs. reviewer vs. admin).
- A **submission history / diff** view — keep prior snapshots and let reviewers compare versions instead of replacing.
- Streaming the review so the drawer fills in signal-by-signal instead of waiting for the full response.
- Live franchise prompting, so Franchise Fit reasons against the actual world doc rather than heuristics.
- Richer editor affordances (asset embeds, comments/threads on phrases) and a board view as an alternate library layout.

---

## Where AI tools helped

This project was built largely **by AI agents (Claude Code)**, working from a set of written specs in `specs/`. The workflow:

- **Parallel feature branches per workstream** — the backend/data layer, the Tiptap editor, design tokens, seed data, the frontend screens, and polish were each driven by a focused spec and landed as separate PRs (visible in the git history), following the Conventional-Commits discipline in `bsp-git-conventions.md`.
- **Specialized review and QA agents** — a code-review agent checked each workstream against its spec (types, lint, tests, duplicate components, hard-coded values), and a separate QA agent operated the running app like a real user against a scripted test matrix (see `bsp-review-agent-spec.md` and `bsp-qa-agent-spec.md`).
- **Playwright-driven QA** — the QA pass exercised real flows end-to-end (submit, drift, resubmit/unsubmit, reviewer status changes, theming) against the running dev server, rather than only running unit tests.

The commit history itself is treated as a deliverable: small, well-scoped commits per spec, demonstrating the collaborative engineering practice the agents were instructed to follow.

---

## What was manually verified

- **Zero-config run:** `npm install && npm run dev` with no environment variables starts cleanly and the app loads with the four seeded documents.
- **Build, lint, types, tests:** `npm run build`, `npm run lint`, `npm test`, and `npm run typecheck` all pass.
- **Seeded review fidelity:** a live mock re-review of the seeded *Haunted Service Elevator* doc reproduces its stored `not_ready` verdict and the two expected red Brand Safety squiggles ("they're never seen again", "a rising body count as the hotel empties out").
- **Submit flow + drift:** submitting a draft opens the drawer with verdict and six bars, sets status to Submitted, and applies prefill; editing afterward shows the drift indicator with working Resubmit (replaces snapshot) and Unsubmit (clears it, returns to Draft).
- **Reviewer flow:** read-mode renders the submitted snapshot, status moves through In Review / Changes Requested / Approved, and Approve opens the destination picker and records routing.
- **Bidirectional focus & theming:** squiggle↔drawer focus works both directions; the light/dark toggle persists across reloads with no white flash and visible squiggle colors in dark mode.
