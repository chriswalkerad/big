# Backend Build Spec: Creative Review Workspace

## YOUR JOB
You are building the backend and data layer for a Next.js creative-review web app. Read this entire document, then build everything described. Do not ask clarifying questions. Do not add features beyond what is described. **Follow the Git Conventions doc (`bsp-git-conventions.md`) for every commit — commit frequently, use Conventional Commits format, and work on a feature branch.** When you are done, every item in this spec exists in the codebase, all tests pass, `npm run build` succeeds, and `npm run lint` is clean.

**Deliverables checklist (verify before finishing):**
- [ ] `src/types/index.ts` — all shared types
- [ ] `src/lib/errors.ts` — `AppError`, `toAppError`
- [ ] `src/lib/storage.ts` — `StorageRepository`
- [ ] `src/lib/seed.ts` — seed JSON, loaded by `StorageRepository` on first run
- [ ] `src/lib/providers/interface.ts` — `ReviewProvider` interface
- [ ] `src/lib/providers/gemini.ts` — `GeminiProvider`
- [ ] `src/lib/providers/mock.ts` — `MockProvider` (first-class, deterministic)
- [ ] `src/app/api/review/route.ts` — `POST /api/review`
- [ ] `.env.example` — `GEMINI_API_KEY=` and `GEMINI_MODEL_ID=gemini-3.5-flash`
- [ ] Tests for all of the above (see Tests section)
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

Build the server endpoint, AI provider layer, shared types, error model, and client-side data layer for the Creative Review Workspace. This is the **data/API layer only**, not the UI. Scope tightly to this; do not add features.

## Principles
- Keep it simple. The only reason a server exists is to keep the Gemini key off the client. Everything else is client-side.
- Runs with zero config: no key, no database. `npm install && npm run dev` works on the mock.
- TypeScript strict (no `any`). Validate all external data with zod. Endpoints return typed errors, never throw raw.

## Stack
- Next.js (App Router) + TypeScript.
- zod for schema validation.
- `@google/genai` for the real provider.
- No database. No auth.

## Runs where
- **Server** (Next API route): `/api/review` only. Holds `GEMINI_API_KEY`.
- **Browser**: the data repository (localStorage). Never touches the key.

## Shared types (single source of truth — server and client both import these)
```ts
type TextSubtype = 'story_premise' | 'character_concept' | 'world_building' | 'script_excerpt' | 'creative_brief'
type SubmissionStatus = 'draft' | 'submitted' | 'in_review' | 'changes_requested' | 'approved'
type RoutingDestination = 'digital_test' | 'animation' | 'marketing' | 'development' | 'production'
type SignalMode = 'inline' | 'doc'
type Severity = 'risk' | 'minor'

interface Project { id: string; name: string; audience: string; franchiseContext: string; tags: string[] }
interface SignalDef { id: string; name: string; prompt: string; threshold: number; mode: SignalMode }
interface SignalIssue { quote: string; message: string; severity: Severity }
interface SignalResult { signalId: string; score: number; rationale: string; issues: SignalIssue[] }
interface ReviewVerdict { label: 'looks_ready' | 'needs_work' | 'not_ready'; flagCount: number }
// Signal bar rule (mirrors design tokens): fill bar proportional to score/10; fill color = green if score >= threshold, amber if 1-2 below, red if 3+ below.
// Verdict rule: looks_ready = no signals below threshold; not_ready = any Brand Safety below threshold OR 4+ flags; needs_work = everything else.

interface ReviewResult {
  detectedSubtype: TextSubtype
  suggestedTitle: string
  themes: string[]
  signals: SignalResult[]
  verdict: ReviewVerdict
}

interface Document {
  id: string; projectId: string; title: string
  body: string                 // the author's LIVE working copy
  subtype: TextSubtype; subtypeSource: 'auto' | 'user'
  status: SubmissionStatus; routing?: RoutingDestination
  createdBy: string; reviewer?: string
  // The version in review. A snapshot, NOT a live pointer. Editing `body` never
  // touches this. Resubmit REPLACES it (no history). Unsubmit clears it (manual only).
  submittedSnapshot?: { body: string; review: ReviewResult; submittedAt: string }
  createdAt: string; updatedAt: string
}
```

## Error model
```ts
type AppErrorCode =
  | 'AI_TIMEOUT' | 'AI_BAD_JSON' | 'AI_RATE_LIMIT' | 'NETWORK_OFFLINE'
  | 'STORAGE_UNAVAILABLE' | 'STORAGE_QUOTA'
  | 'DOC_NOT_FOUND' | 'EMPTY_DOC' | 'UNKNOWN'

interface AppError { code: AppErrorCode; message: string; retryable: boolean; cause?: unknown }
```
- Provide a `toAppError(e: unknown): AppError` mapper.
- `message` is human-readable so the UI can show the actual reason. Log `code` + `message`.

## The endpoint: `POST /api/review`
- Request body (validate with zod): `{ text: string; project: Project; signals: SignalDef[] }`.
- If `text` is empty or whitespace-only → return `{ ok: false, error: { code: 'EMPTY_DOC', retryable: false, message: 'Add some text before reviewing.' } }`.
- Select provider: `GEMINI_API_KEY` present → GeminiProvider, else MockProvider.
- Call `provider.review(input)`.
- Validate the provider's output against the `ReviewResult` zod schema. On failure → `AI_BAD_JSON` (put the validation detail in `cause`).
- Return `{ ok: true, data: ReviewResult }` or `{ ok: false, error: AppError }`.
- **Stores nothing.**

## Provider interface
```ts
interface ReviewProvider {
  review(input: { text: string; project: Project; signals: SignalDef[] }): Promise<ReviewResult>
}
```

### GeminiProvider
- Model: `gemini-3.5-flash` (current generation as of June 2026; Gemini 2.0 Flash and Flash-Lite were shut down June 1, 2026). Make the model id env-configurable (`GEMINI_MODEL_ID`, default `gemini-3.5-flash`) so it can be swapped without a code change.
- Use Gemini's structured output / JSON Schema mode for reliable `ReviewResult` output.
- Build one prompt: a system wrapper (project context + the concept text + the JSON schema + the rule "quote verbatim, exact substrings only") followed by each signal as a labeled criterion (id, name, prompt, mode). Ask for JSON only, matching `ReviewResult`.
- Parse and return. Map failures: timeout → `AI_TIMEOUT`, HTTP 429 → `AI_RATE_LIMIT`, parse/shape problems → `AI_BAD_JSON`, fetch/offline → `NETWORK_OFFLINE`.

### MockProvider (first-class — this is what reviewers run locally)
- **Deterministic:** seed a small PRNG from a hash of `text`, so the same input always yields the same result.
- **Works for any input,** not just seeded docs (reviewers will paste their own concepts). Heuristics per signal:
  - Completeness: presence of audience/format cues + overall length.
  - Brand Safety: scan a small risky-word list; lower the score and add an issue if hit. The list MUST include the terms that trigger the seeded Brand Safety flags (e.g. "body count", "never seen again" — see Doc 3 in `bsp-seed-data-spec.md`), so a live re-review of the seeded docs reproduces their stored `not_ready` snapshots and renders the expected red squiggles.
  - Clarity: flag an overly long or vague sentence; surface one as an issue.
  - Hook Strength: score the first sentence's punch (length, concreteness).
  - Character Distinctiveness / Franchise Fit: keyword presence + length heuristics.
- **Must anchor real highlights:** for inline issues, set `quote` to an ACTUAL substring of `text` (e.g., the longest sentence for Clarity, a matched risky phrase for Brand Safety), so canvas highlighting works on the mock.
- Detect subtype with a simple keyword classifier, suggest a title from the first line, extract a few themes by keyword, and compute the verdict from the thresholds.

## Client-side data layer (browser)
- A `StorageRepository` wrapping localStorage. Namespaced keys: `bsp:project:<id>`, `bsp:doc:<id>`, `bsp:signal:<id>`, `bsp:meta:*`.
- Methods per entity: `get(id)`, `list()`, `save(entity)`, `remove(id)`. Typed.
- **Seed on first run:** if empty, load seed JSON (one project = Eloise; the six signals; four documents spanning subtypes and statuses with varied created-by names).
- Catch storage failures → `STORAGE_UNAVAILABLE` / `STORAGE_QUOTA`; the app continues in-memory for the session.
- Components NEVER touch localStorage directly; they go through this repository. The signal admin's create/edit/delete writes here.

## Env
- `.env.example` with `GEMINI_API_KEY=` and `GEMINI_MODEL_ID=gemini-3.5-flash` (both optional). Absent key → mock. Document this clearly.
- **Persistence note for README:** localStorage satisfies the brief's "some persistence" requirement. No database setup needed. Seeded data loads on first run.
- **Deploy:** Vercel. `vercel --prod` from the repo root. No environment variables required to run on the mock; add `GEMINI_API_KEY` in Vercel project settings to enable the real provider.

## Tests (top 20% covering ~80%)
- zod schemas: valid, invalid, and malformed `ReviewResult` and request body.
- Provider selection (key present vs absent).
- MockProvider: deterministic (same input → same output), and every inline issue's `quote` is a real substring of the input.
- `toAppError` mapping for each failure type.
- StorageRepository: get/save/list/remove, the empty path (seeds), and the quota-exceeded path.
- Endpoint: happy path (mock), `EMPTY_DOC`, and `AI_BAD_JSON` (feed deliberately bad provider output).
- Plus ESLint + strict `tsc` as the always-on layer.

## Out of scope (do not build)
- Database, auth, accounts, cross-device sync, rate-limit infrastructure, streaming responses, multi-user. The browser holds all data in localStorage; the server only proxies the AI call.
