# Review Report

EPIC 16 / BIG-20 — code review (and fix) of the Creative Review Workspace.
Base commit reviewed: `0bedc70` (Merge PR #10, "feat: polish & interaction craft").
Verification on the untouched base: `tsc --noEmit` clean, `npm run lint` clean, `npm test` 234/234 pass (34 files), `npm run build` OK.

## Summary
1 item needs attention. 40 passed.

The single finding is a spec-vs-spec tension (the `themes` portion of submit-prefill cannot be persisted without extending the canonical `Document` type), not a defect in the implementation. It is recorded under Deferred with its reason. No hard-coded colors, no `any`, no raw throws, no duplicate components, and no `prosemirror-*` imports were found. The codebase is materially complete and spec-compliant.

## Issues

### [ISSUE-001] Review `themes` are not applied/persisted on submit
File: `src/lib/doc-page.ts:162-173` (`applyPrefill`), `src/lib/doc-page.ts:232-243` (`applySubmit`), `src/types/index.ts:87-102` (`Document`).
Problem: The frontend spec describes the submit prefill as "subtype/title/**themes**" (`specs/bsp-frontend-build-spec.md:61`). Subtype and title prefill are implemented correctly and respect `user` sources, but `review.themes` is never written to the `Document` nor surfaced in the UI. The themes are still produced by the provider, validated by the `ReviewResult` zod schema, and stored inside `submittedSnapshot.review.themes`; they are simply never promoted to a document-level field.
Spec reference: `specs/bsp-frontend-build-spec.md:61` (prefill list) vs `specs/bsp-backend-build-spec.md:64-74` (the canonical `Document` type, which has **no** `themes` field) and review-checklist item #4 ("Does the `Document` type have both `body` and `submittedSnapshot`" — i.e. the Document shape is fixed). See Deferred for the resolution rationale.

## Passed checks

### 1. Spec compliance
- All routes exist: `/` (redirect to seeded project — `src/app/page.tsx:11`), `/p/[projectId]` (`src/app/p/[projectId]/page.tsx`), `/p/[projectId]/d/new` (`src/app/p/[projectId]/d/new/page.tsx` → `new-document-redirect.tsx`), `/p/[projectId]/d/[docId]` (edit mode), `/p/[projectId]/d/[docId]/review` (read mode, share link), `/settings/signals` (CRUD). Build output confirms all 6 route trees compile.
- `POST /api/review` exists (`src/app/api/review/route.ts`), validates `{ text, project, signals }` with zod (`reviewRequestSchema`), returns the discriminated `{ ok: true, data } | { ok: false, error }` shape via the testable `handleReview` core.
- `StorageRepository` has `get`/`list`/`save`/`remove` for all three entity types — project, document, signal (`src/lib/storage.ts:85-126`).
- `Document` has both `body` (live working copy) and `submittedSnapshot` (`src/types/index.ts:90,99`).
- Submitting sets `submittedSnapshot` and editing the body never touches it: `applySubmit` sets it (`doc-page.ts:241`); `handleBodyChange` only calls `setBody` (`document-page.tsx:292-294`); verified by `doc-transitions.test.ts:96-109`.
- Resubmit replaces `submittedSnapshot` with no history (`applySubmit` overwrites — `doc-page.ts:241`; `doc-transitions.test.ts:80-93`). Unsubmit clears it and returns to `draft`, manual only (`applyUnsubmit` — `doc-page.ts:249-251`; only caller is the Unsubmit button — `document-page.tsx:419`).
- Subtype flips to `subtypeSource: 'user'` on manual change (`applyManualSubtype` — `doc-page.ts:264-266`) and a re-submit respects it (`applyPrefill` keeps user subtype — `doc-page.ts:167-171`; `doc-transitions.test.ts:68-78`).
- All six signals seeded with exact IDs `clarity`, `completeness`, `brand_safety`, `hook_strength`, `character`, `franchise_fit` (`src/lib/seed-data.ts:19-68`).
- All four seed documents present with the exact body text from the seed spec; snapshots populated for docs 1-3, doc 4 is a draft with no snapshot (`src/lib/seed-data.ts:142-197`).
- `MockProvider` is first-class and used when `GEMINI_API_KEY` is absent (`src/lib/providers/select.ts:22-27`).
- MockProvider inline `quote`s are real substrings of the input — derived via `exactSubstring` which slices from the original text (`src/lib/providers/mock.ts:84-89,238,296`); asserted by `mock.test.ts` (`doc.body.includes(issue.quote)`).
- Results drawer slides up from the bottom and is dismissable: `translate-y-[110%]` → `translate-y-0` transition, close button + Escape handler, fixed height `h-[min(60vh,32rem)]` (`src/components/results-drawer.tsx:84-94,72-79,176-183`).
- Overall verdict is computed on submit only, never live: the drawer reads `snapshot.review.verdict` (`document-page.tsx:182`, `results-drawer.tsx`); the page never recomputes a verdict in render.
- Franchise Fit row links to the franchise detail: `signal-row.tsx` renders a "View franchise" button → `onFranchiseClick` → `FranchiseDetail` showing audience/tone/world/tags (`document-page.tsx:445-448`, `franchise-detail.tsx:63-64`).
- Light/dark toggle persists: `next-themes` `attribute="class"` with default persistence (`theme-provider.tsx`, `theme-toggle.tsx`).
- Cmd/Ctrl+Enter triggers Submit: keydown handler `(e.metaKey || e.ctrlKey) && e.key === 'Enter'` → `runReview()` (`document-page.tsx:297-307`).
- Reviewer read-mode actions: status change (In Review / Changes Requested / Approved) and Approve → destination picker (default Digital Test, plus Animation/Marketing/Development/Production) setting `routing` (`reviewer-status-control.tsx`, `destination-picker.tsx`, `doc-page.ts:113-138`).
- Bidirectional focus (Clarity + Brand Safety only): squiggle→row and phrase→squiggle, gated to inline-mode signals (`document-page.tsx:197-223`, `signal-row.tsx`, filtered via `inlineSignalIdSet`).

### 2. TypeScript
- `tsc --noEmit` is clean (no errors).
- `strict: true` is set (`tsconfig.json:6`).
- No `any` type anywhere in `src/` — the only `\bany\b` grep hits are the English word inside prompt strings/comments (`seed-data.ts:26,66`, `gemini.ts:88`).
- No `@ts-ignore`. One `@ts-expect-error` exists, and it is a legitimate test-only suppression with a comment (`src/lib/storage.test.ts:151` — intentionally removing `window` to exercise the SSR fallback).

### 3. Lint
- `npm run lint` (eslint) is clean — no errors or warnings. The few `eslint-disable` comments are justified React 19 rule suppressions for mount-effect external-store loads (`document-page.tsx:99`, `new-document-redirect.tsx:39`) and `useSyncExternalStore`/exhaustive-deps (`use-library-data.ts:41`, `document-page.tsx:191`), each with an explanatory comment; no cascade, no stale closures.

### 4. Tests
- `npm test` — 234/234 pass across 34 files.
- Coverage present and meaningful for every required area: Gemini schema/zod validation (`handler.test.ts`, `route.test.ts`, `mock.test.ts`), MockProvider determinism + real-substring quotes (`mock.test.ts`), status state machine valid-transitions-only (`doc-page.test.ts:111-151`), version drift (`doc-page.test.ts:91-109`, `doc-transitions.test.ts`), subtype source flag (`doc-transitions.test.ts:68-78`), StorageRepository get/save/list/remove + seed + quota (`storage.test.ts`), `ErrorState` rendering each `AppErrorCode` (`error-state.test.tsx` `it.each` over all 9 codes), signal-bar fill-color logic (`signal-bar.test.tsx`), `toAppError` mapping per failure type (`errors.test.ts`).
- No weak/tautological tests found — assertions check values, not just that a function was called. (Cosmetic note: `doc-transitions.test.ts` exercises logic that lives in `doc-page.ts`; the filename is a misnomer but the tests are real and pass.)

### 5. Duplicate components
- No duplicates. Each of `EmptyState`, `LoadingState`, `ErrorState`, `StatusChip`, `SignalBar`, `SubtypeChip`, `ContextChip`, `ResultsDrawer`, `Breadcrumb`, `SignalRow`, `DocumentCanvas`, and the signal form is defined in exactly one file.
- `Breadcrumb` (presentational) and `AppBreadcrumb` (composition wrapper that prepends the Account stub) are intentionally distinct, not a duplicate.
- `DocumentCanvas` is a single component used for both edit and read mode via a `mode` prop (`DocumentCanvas.tsx:81,98-100`; rendered once in `document-page.tsx` with `mode={mode}`). No separate read-mode implementation exists.

### 6. Zero-config run
- `.env.example` exists with `GEMINI_API_KEY=` and `GEMINI_MODEL_ID=gemini-3.5-flash`.
- `npm run build` passes with no environment variables set (verified — exit 0, all routes generated). The app runs on the deterministic MockProvider when no key is present (`select.ts`). (`npm run dev` is not run here per instructions, but the build + mock selection prove the zero-config path.)

### 7. Hard-coded values
- No hard-coded hex/`rgb`/`hsl` color literals in any `.ts`/`.tsx` component or page file. The only hex values live in `src/styles/tokens.css` (the token definitions); `globals.css` and `editor/editor.css` reference `var(--…)` tokens only. Functional colors `risk`/`minor`/`pass` are defined for light and dark with the exact spec values.
- Signal IDs, status, subtype, severity, and routing values are sourced from the shared types / shared constants (`@/types`, `@/lib/doc-page`, seed data), not redefined locally.

### 8. Brief compliance
- README: handled separately in the `feat/readme` PR (per EPIC instructions — not created or edited here).
- Deploy: backend spec documents the Vercel deploy path (`vercel --prod`, no env required for mock; add `GEMINI_API_KEY` in project settings for the real provider).
- Gemini key is server-side only: `GEMINI_API_KEY` is referenced only by `select.ts`/`gemini.ts` (the provider chain reached exclusively from the `nodejs`-runtime API route `handler.ts` → `route.ts`). No `'use client'` file imports the provider-selection or Gemini modules.

## Deferred

### [ISSUE-001] Review `themes` prefill — not fixed (out of scope to fix safely)
Reason: The `ReviewResult.themes` value cannot be promoted to the document without adding a `themes` field to the `Document` type. That type is the canonical, spec-pinned shape (`specs/bsp-backend-build-spec.md:64-74`) and review-checklist item #4 explicitly verifies the Document shape (`body` + `submittedSnapshot`); extending it would change the shared single-source-of-truth type beyond what any finding requires, with a localStorage migration consideration for existing seeded docs. Themes are already produced, zod-validated, and persisted inside `submittedSnapshot.review.themes`, and the drawer/spec do not require them to render. Recommend treating "surface themes" as a "with more time" enhancement rather than a fix.

## Fixes applied
None. The review surfaced one finding (ISSUE-001), which is deferred for the reason above; it is not a defect in the implementation. No code changes were required — `tsc`, `lint`, `test` (234), and `build` are all green on the reviewed base.
