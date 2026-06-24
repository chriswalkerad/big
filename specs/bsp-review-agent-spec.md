# Review Agent Spec: Creative Review Workspace

## YOUR JOB
You are a code reviewer, not a builder. The app has been built by other agents. Your job is to read the codebase and produce a written report of every problem you find. You do not fix anything. You do not add features. You do not refactor. You read, check, and report.

Work through every checklist item below in order. For each item, write either PASS or a specific description of what is wrong and where (file + line if possible). When you are done, output the full report as a markdown file at `REVIEW_REPORT.md` in the repo root.

---

## Checklist

### 1. Spec compliance (check against these four specs)
- Does every route described in the frontend spec exist? (`/`, `/p/[projectId]`, `/p/[projectId]/d/new`, `/p/[projectId]/d/[docId]`, `/p/[projectId]/d/[docId]/review`, `/settings/signals`)
- Does `POST /api/review` exist, accept the correct request body, and return the correct response shape?
- Does `StorageRepository` have `get`, `list`, `save`, and `remove` for all three entity types (project, document, signal)?
- Does the `Document` type have both `body` (live) and `submittedSnapshot` (the review version)?
- Does submitting a doc set `submittedSnapshot` and NOT clear it when the author edits afterward?
- Does "Resubmit" replace `submittedSnapshot`? Does "Unsubmit" clear it and return to draft?
- Does the subtype flip to `subtypeSource: 'user'` when changed manually, and does a re-submit respect that and not override it?
- Are all six signals seeded with their exact IDs: `clarity`, `completeness`, `brand_safety`, `hook_strength`, `character`, `franchise_fit`?
- Are all four seed documents present with the exact body text from the seed data spec?
- Is there a MockProvider that is used when `GEMINI_API_KEY` is absent?
- Does the MockProvider return inline `quote` values that are actual substrings of the input text?
- Does the results drawer slide up from the bottom and is it dismissable?
- Is the overall verdict computed on submit only (not live)?
- Does the Franchise Fit row in the drawer link to the franchise detail?
- Is there a light/dark toggle that persists across sessions?
- Does Cmd/Ctrl+Enter trigger Submit?

### 2. TypeScript
- Run `tsc --noEmit`. Are there any errors? List them.
- Is `strict: true` set in `tsconfig.json`?
- Search for `any` in the codebase. List every occurrence that is not a legitimate exception with a comment explaining why.
- Search for `@ts-ignore` and `@ts-expect-error`. List every occurrence.

### 3. Lint
- Run `npm run lint`. Are there any errors or warnings? List them.

### 4. Tests
- Run `npm test`. Do all tests pass?
- Are there tests for: the Gemini response parser / zod schema validation; the MockProvider returning deterministic output; the MockProvider's inline quotes being real substrings; the status state machine (valid transitions only); the version drift logic (body vs snapshot); the subtype source flag; the StorageRepository (get/save/list/remove + seed + quota error); the `ErrorState` component rendering each `AppErrorCode`; the signal bar fill color logic?
- For each test that exists: does it actually assert something meaningful, or does it just check that a function was called? Flag any test that would pass even if the implementation were wrong.

### 5. Duplicate components
- Search for any component that is defined more than once (same name, same purpose). List every duplicate.
- Specifically check: is there more than one implementation of `EmptyState`, `LoadingState`, `ErrorState`, `StatusChip`, `SignalBar`?
- Is `DocumentCanvas` used as the single component in both edit and read mode, or are there two separate implementations?

### 6. Zero-config run
- Does the app have a `.env.example`?
- Does the app start with `npm run dev` and no environment variables set?
- Does `npm run build` pass with no environment variables set?

### 7. Hard-coded values
- Search for hard-coded hex colors (e.g. `#18181B`, `#DC2626`) in component files. Every color should reference a CSS variable token. List any violations.
- Search for hard-coded strings that should be constants (signal IDs, status values, subtype values). Are they imported from the shared types or redefined locally?

### 8. Brief compliance (final check)
- Is there a `README.md` with: product overview, architecture overview, setup instructions, key user flows, AI/model approach, key tradeoffs, what was not built, what would be improved with more time, where AI tools helped, what was manually verified?
- Does the app have a deployed URL, or are there clear deploy instructions?
- Is the Gemini key kept server-side only (never in client-side code)?

---

## Output
Write your findings to `REVIEW_REPORT.md` in the repo root. Format:

```
# Review Report

## Summary
X items need attention. Y passed.

## Issues (each as a separate item)
### [ISSUE-001] Short title
File: src/...
Problem: Description of what is wrong.
Spec reference: Which spec or brief requirement this violates.

## Passed checks
- List of everything that passed cleanly.
```

Do not fix anything. Do not commit any code changes. Write the report only.
