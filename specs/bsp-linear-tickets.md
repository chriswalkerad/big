# Linear Ticket Creation: Creative Review Workspace

## YOUR JOB
Connect to the Linear workspace and create all tickets below for the Creative Review Workspace project. Use the team you find in the workspace. Create parent epics first, then nest all sub-tasks under them using `parentId`. Assign all tickets to me. Set state to "Todo". Do not skip any ticket. When done, confirm how many were created.

---

## Labels to create first (if they don't exist)
- `backend` #6366F1
- `frontend` #F59E0B
- `editor` #10B981
- `design` #EC4899
- `ai` #8B5CF6
- `qa` #EF4444
- `chore` #6B7280

---

## EPIC 1: Project Scaffold and Setup
**Labels:** chore
**Priority:** Urgent

Sub-tasks:
1. Initialise Next.js 14 App Router project with TypeScript strict
2. Install and configure Tailwind CSS v4
3. Install and configure shadcn/ui
4. Set up Vitest and Testing Library
5. Configure ESLint with strict rules and Prettier
6. Set up `tsconfig.json` with `strict: true` and path aliases
7. Create folder structure (`src/app`, `src/components`, `src/lib`, `src/types`, `src/styles`)
8. Create `.env.example` with `GEMINI_API_KEY=` and `GEMINI_MODEL_ID=gemini-3.5-flash`
9. Create initial `README.md` with project name and setup instructions placeholder
10. Verify `npm run dev`, `npm run build`, `npm run lint`, `npm test` all pass on empty project

---

## EPIC 2: Design Tokens and Theming
**Labels:** design
**Priority:** High

Sub-tasks:
1. Create `src/styles/tokens.css` with full CSS variable ramp (bg, surface, panel, border, text-primary, text-secondary, text-tertiary, accent)
2. Add light mode token values (white/gray/near-black scale)
3. Add dark mode token values (near-black/gray/near-white scale)
4. Add functional color tokens: risk red, minor amber, pass green (light + dark variants)
5. Extend `tailwind.config.ts` to reference CSS variable tokens
6. Install and configure `next-themes`
7. Create `ThemeProvider` component wrapping the app
8. Create reusable `ThemeToggle` component (light/dark switch, persists to localStorage)
9. Add `ThemeToggle` to app shell
10. Verify no hard-coded hex values exist anywhere in component files
11. Verify light and dark mode render correctly with no flash on load

---

## EPIC 3: Shared Types and Error Model
**Labels:** backend
**Priority:** Urgent

Sub-tasks:
1. Create `src/types/index.ts` with all shared types: `TextSubtype`, `SubmissionStatus`, `RoutingDestination`, `SignalMode`, `Severity`
2. Add `Project`, `SignalDef`, `SignalIssue`, `SignalResult`, `ReviewVerdict`, `ReviewResult` interfaces
3. Add `Document` interface with `body` (live) and `submittedSnapshot` (snapshot, not live pointer)
4. Create `src/lib/errors.ts` with `AppErrorCode`, `AppError` interface, and `toAppError` mapper
5. Write unit tests for `toAppError` covering every error code
6. Verify `tsc --noEmit` passes with zero errors

---

## EPIC 4: Seed Data
**Labels:** backend
**Priority:** High

Sub-tasks:
1. Create `src/lib/seed-data.ts` exporting `seedProject` (Eloise at The Plaza)
2. Add `seedSignals` array with all six signals: Clarity, Completeness, Brand Safety, Hook Strength, Character Distinctiveness, Franchise Fit — exact IDs and prompts as specced
3. Add Doc 1: "Eloise and the Midnight Room-Service Caper" — strong/approved, with `submittedSnapshot`
4. Add Doc 2: "A New Friend at the Plaza" — vague/submitted, with `submittedSnapshot` and two amber Clarity issues
5. Add Doc 3: "Eloise and the Haunted Service Elevator" — risky/changes-requested, with two red Brand Safety issues in `submittedSnapshot`
6. Add Doc 4: "Rooftop idea" — thin stub/draft, no `submittedSnapshot`
7. Verify all inline issue `quote` values are exact substrings of their document body
8. Verify all six signal IDs match exactly: `clarity`, `completeness`, `brand_safety`, `hook_strength`, `character`, `franchise_fit`

---

## EPIC 5: StorageRepository
**Labels:** backend
**Priority:** Urgent

Sub-tasks:
1. Create `src/lib/storage.ts` with `StorageRepository` class
2. Implement namespaced localStorage keys (`bsp:project:`, `bsp:doc:`, `bsp:signal:`, `bsp:meta:`)
3. Implement `get(id)`, `list()`, `save(entity)`, `remove(id)` for Project
4. Implement `get(id)`, `list()`, `save(entity)`, `remove(id)` for Document
5. Implement `get(id)`, `list()`, `save(entity)`, `remove(id)` for Signal
6. Implement first-run seed: if localStorage is empty, load from seed-data.ts
7. Implement graceful fallback: catch `STORAGE_UNAVAILABLE` and `STORAGE_QUOTA` errors, continue in-memory
8. Write unit tests: get/save/list/remove for all entity types
9. Write unit test: empty localStorage triggers seed on first run
10. Write unit test: quota exceeded returns `STORAGE_QUOTA` error, app continues

---

## EPIC 6: AI Provider Layer and Review Endpoint
**Labels:** backend, ai
**Priority:** Urgent

Sub-tasks:
1. Create `src/lib/providers/interface.ts` with `ReviewProvider` interface
2. Create `src/lib/providers/mock.ts` — deterministic MockProvider using PRNG seeded from text hash
3. MockProvider: implement per-signal heuristics (Completeness, Brand Safety, Clarity, Hook, Character, Franchise Fit)
4. MockProvider: ensure all inline issue `quote` values are actual substrings of the input text
5. MockProvider: implement keyword-based subtype detection
6. MockProvider: suggest title from first line, extract themes by keyword
7. MockProvider: compute verdict from thresholds
8. Create `src/lib/providers/gemini.ts` — GeminiProvider using `@google/genai`
9. GeminiProvider: build structured prompt with project context, signals, and JSON schema
10. GeminiProvider: use Gemini structured output / JSON Schema mode
11. GeminiProvider: map all failure modes to typed `AppError` codes (timeout, 429, bad JSON, offline)
12. Create `src/app/api/review/route.ts` — POST endpoint
13. Endpoint: validate request body with zod schema
14. Endpoint: return `EMPTY_DOC` error for whitespace-only text
15. Endpoint: select GeminiProvider if `GEMINI_API_KEY` present, else MockProvider
16. Endpoint: validate provider output against `ReviewResult` zod schema, return `AI_BAD_JSON` on failure
17. Write unit tests: zod schema validation (valid, invalid, malformed)
18. Write unit test: provider selection (key present vs absent)
19. Write unit tests: MockProvider is deterministic (same input → same output)
20. Write unit test: MockProvider inline quotes are real substrings of input
21. Write unit test: endpoint returns `EMPTY_DOC` for whitespace input
22. Write unit test: endpoint returns `AI_BAD_JSON` when provider returns bad shape

---

## EPIC 7: Tiptap Editor
**Labels:** editor
**Priority:** High

Sub-tasks:
1. Install Tiptap packages: `@tiptap/react`, `@tiptap/core`, `@tiptap/extension-document`, `@tiptap/extension-paragraph`, `@tiptap/extension-text`, `@tiptap/extensions` (UndoRedo + Placeholder), `@tiptap/pm`
2. Create `src/components/editor/SignalHighlight.ts` extension file with comment header explaining decorations-not-marks and quote-match-not-offsets decisions
3. SignalHighlight: implement `DecorationSet` plugin with `setSignalHighlights` command
4. SignalHighlight: locate quotes by string match in text nodes (single-node only, no cross-node)
5. SignalHighlight: clear decorations on `tr.docChanged`, rebuild on `setSignalHighlights`
6. SignalHighlight: multi-match takes first occurrence; not-found skips silently
7. SignalHighlight: add CSS class `signal-highlight`, `data-signal-id`, `data-severity` attributes
8. SignalHighlight: add `title` attribute with message for hover tooltip
9. Create `src/components/editor/DocumentCanvas.tsx` with `mode: "edit" | "read"` prop
10. DocumentCanvas: compose extensions (Document, Paragraph, Text, UndoRedo, Placeholder, SignalHighlight) — no StarterKit
11. DocumentCanvas: set `immediatelyRender: false` for Next.js SSR
12. DocumentCanvas: `editable` driven by `mode` prop
13. DocumentCanvas: wire `onHighlightClick` via `handleDOMEvents` reading `data-signal-id`
14. DocumentCanvas: expose `setSignalHighlights` via ref or callback prop
15. DocumentCanvas: add placeholder text "Start your brief…"
16. Stub sample issues array for isolated highlight rendering test
17. Write unit tests: decoration cleared on doc edit; rebuilt on setSignalHighlights
18. Write unit test: multi-match takes first occurrence
19. Write unit test: unknown quote skips silently, no crash

---

## EPIC 8: App Shell and Navigation
**Labels:** frontend
**Priority:** High

Sub-tasks:
1. Create root layout with `ThemeProvider` and app shell
2. Create `Breadcrumb` component (Account > Project > Document, each segment configurable)
3. Wire Account breadcrumb segment to a stub popup ("this would let you switch projects / manage the account")
4. Add Settings nav entry linking to `/settings/signals`
5. Add `ThemeToggle` to app shell header
6. Create `/` route that redirects to `/p/proj-eloise`
7. Verify breadcrumb renders correctly on library, doc page, and settings screens

---

## EPIC 9: Document Library
**Labels:** frontend
**Priority:** High

Sub-tasks:
1. Create `/p/[projectId]/page.tsx` — document library screen
2. Fetch documents from `StorageRepository` on mount
3. Render filterable list of document rows
4. Document row: title, `SubtypeChip`, `StatusChip`, created-by, reviewer (if any), updated time
5. Create reusable `StatusChip` component (all five statuses, correct colors via tokens)
6. Create reusable `SubtypeChip` component (all five subtypes)
7. Create reusable `ContextChip` component (project name · audience)
8. Add search input: full-text filter over title and body
9. Add status filter dropdown: filter list by status
10. Wire "New" button to `/p/[projectId]/d/new`
11. Create `EmptyState` component (parameterised: title, description, optional action)
12. Show `EmptyState` when search/filter matches nothing
13. Write unit tests: search filters correctly on title match, body match, no match
14. Write unit tests: status filter shows correct subset

---

## EPIC 10: Document Page Scaffold
**Labels:** frontend
**Priority:** High

Sub-tasks:
1. Create `/p/[projectId]/d/new/page.tsx` — creates empty doc in StorageRepository on mount, redirects to `/p/[projectId]/d/[docId]`
2. Create `/p/[projectId]/d/[docId]/page.tsx` — document page (edit mode)
3. Create `/p/[projectId]/d/[docId]/review/page.tsx` — document page (read mode, renders `submittedSnapshot`)
4. Create single `DocumentPage` component with `mode: "edit" | "read"` prop (one component, not two)
5. Minimal top bar: breadcrumb, `ContextChip`, status control, primary action (Submit in edit, copy-link in review)
6. Title field (editable in edit, read-only in read)
7. Subtype dropdown: all five options; flips `subtypeSource` to `user` on manual change
8. Body: render `DocumentCanvas` in the correct mode
9. Load document from `StorageRepository` by ID; show `ErrorState` with `DOC_NOT_FOUND` if missing
10. Create `LoadingState` component (parameterised skeleton)
11. Create `ErrorState` component — reads `AppError.code` and shows human-readable message + retry where `retryable: true`
12. Write unit test: `subtypeSource` flips to `user` on manual subtype change
13. Write unit test: re-submit does not override `user` subtype source

---

## EPIC 11: Submit Flow and Results Drawer
**Labels:** frontend, ai
**Priority:** Urgent

Sub-tasks:
1. Wire Submit button to `POST /api/review` with document text, project context, and signals
2. On submit success: set `submittedSnapshot = { body, review, submittedAt }`, set status to `submitted` if currently `draft`
3. Apply prefill from review result: subtype (if `subtypeSource === "auto"`), title (if empty), themes
4. Clear existing highlights on submit start
5. On submit success: call `setSignalHighlights` with inline signal issues
6. Create `ResultsDrawer` component — slides up from bottom, fixed height, dismissable
7. Drawer header: verdict label ("Looks ready" / "Needs work" / "Not ready") + flag count
8. Create `SignalRow` component: signal name, score as `x/10`, proportional fill bar, rationale
9. Create `SignalBar` component: fill bar proportional to score/10, fill color by threshold (green/amber/red)
10. Drawer body: render six `SignalRow` components
11. Clarity and Brand Safety rows: list flagged phrases below rationale
12. Hook Strength row: doc-level only, quote in rationale, no squiggle
13. Franchise Fit row: "franchise" text is clickable → opens franchise detail panel/modal
14. Franchise detail: shows project name, audience, franchise context, tags (read-only)
15. Bidirectional focus: clicking a flagged phrase in drawer scrolls to + emphasises matching squiggle
16. Bidirectional focus: clicking a squiggle focuses the matching drawer row
17. `LoadingState` in drawer while review is running
18. `ErrorState` in drawer on review failure, with retry button
19. Drawer slide-up animation (CSS transition)
20. Keyboard shortcut: Cmd/Ctrl+Enter triggers Submit
21. Soft gate: "Needs work" / "Not ready" verdict is visually prominent in drawer; never a hard block
22. Write unit test: verdict label and flag count render correctly from `ReviewResult`
23. Write unit test: `SignalBar` fill color maps correctly for each threshold scenario
24. Write unit test: submit sets `submittedSnapshot` and status → submitted
25. Write unit test: `ErrorState` renders correct message for each `AppErrorCode`

---

## EPIC 12: Version Drift (Resubmit / Unsubmit)
**Labels:** frontend
**Priority:** High

Sub-tasks:
1. Detect version drift: compare live `body` to `submittedSnapshot.body` after any edit
2. Show "edited since submit" indicator when drift is detected
3. Show "Resubmit" action when drift is detected
4. Show "Unsubmit" action when drift is detected
5. Editing body clears current highlights (already handled by SignalHighlight extension, verify it wires correctly)
6. Resubmit: re-run review on current body, replace `submittedSnapshot`, keep status as submitted
7. Unsubmit: clear `submittedSnapshot`, set status → draft, clear highlights, hide drawer
8. Unsubmit is manual only — never triggered automatically by editing
9. Reviewer (read mode) always sees `submittedSnapshot` body, never the live draft
10. Write unit test: drift detected when body !== snapshot body
11. Write unit test: Resubmit replaces snapshot (old snapshot gone)
12. Write unit test: Unsubmit clears snapshot and returns to draft
13. Write unit test: editing does not auto-unsubmit

---

## EPIC 13: Signal Admin
**Labels:** frontend, backend
**Priority:** Medium

Sub-tasks:
1. Create `/settings/signals/page.tsx` — signal admin screen
2. Fetch signals from `StorageRepository` on mount
3. Render list of signals: name, mode chip, threshold, edit/delete actions
4. Create signal form component (shared for create and edit): name, prompt (textarea), threshold (number input 0-10), mode (inline/doc select)
5. "New Signal" button opens the signal form in create mode
6. Clicking a signal opens the signal form in edit mode, pre-filled
7. Save writes to `StorageRepository`
8. Delete shows confirmation before removing from `StorageRepository`
9. Deleted signals do not appear in the next review pass
10. Verify the six seeded signals are present on first load
11. Write unit test: create saves to StorageRepository
12. Write unit test: edit updates existing signal
13. Write unit test: delete removes signal and it no longer appears in review input

---

## EPIC 14: Reviewer Actions and Status Transitions
**Labels:** frontend
**Priority:** High

Sub-tasks:
1. Status control on doc page: dropdown or segmented control showing current status
2. In edit mode: status auto-sets to `submitted` on first submit; author can also change manually
3. In read mode (reviewer): status options are In Review, Changes Requested, Approved
4. Approving opens a destination picker (Digital test default; also Animation, Marketing, Development, Production)
5. Destination picker sets `routing` on the document and saves to `StorageRepository`
6. "Copy link" button copies the `/review` URL to clipboard
7. Status chip on library row updates immediately after status change
8. Write unit test: status state machine — only valid transitions are allowed
9. Write unit test: auto-submitted fires on first submit from draft
10. Write unit test: routing destination is saved when approving

---

## EPIC 15: Polish and Interaction Craft (Option A)
**Labels:** frontend, design
**Priority:** Medium

Sub-tasks:
1. Squiggle underline styling: wavy CSS underline on `.signal-highlight`, red for risk, amber for minor
2. Hover tooltip on squiggle (native `title` attribute, verify it works cross-browser)
3. Drawer slide-up transition: smooth CSS animation, not instant
4. Status chip transitions: smooth color change when status updates
5. Subtype chip: subtle animation when AI auto-fills it after submit
6. Prefill animation: title and subtype fields animate in when AI suggests them
7. Signal score fill bar: animate fill width on drawer open
8. Focus ring: consistent, visible focus state on all interactive elements
9. Hover states: all clickable elements have a clear hover state using token colors
10. Library row hover: subtle background highlight
11. Responsive check: layout does not break or overflow at 768px viewport width
12. Empty state illustrations or typography treatment (meaningful, not a blank div)
13. Loading skeleton in the drawer while review runs (not just a spinner)

---

## EPIC 16: Review Agent Pass
**Labels:** qa
**Priority:** High

Sub-tasks:
1. Run review agent per `bsp-review-agent-spec.md`
2. Verify `tsc --noEmit` passes with zero errors
3. Verify `npm run lint` passes clean
4. Verify no duplicate components exist
5. Verify no hard-coded hex values in components
6. Verify all spec routes exist
7. Verify MockProvider inline quotes are real substrings
8. Verify tests assert meaningful things (not vacuous passes)
9. Produce `REVIEW_REPORT.md`
10. Fix all issues from `REVIEW_REPORT.md`

---

## EPIC 17: QA Agent Pass
**Labels:** qa
**Priority:** High

Sub-tasks:
1. Run QA agent per `bsp-qa-agent-spec.md` against the running app
2. Verify fresh clone boots with zero config
3. Verify all four seeded docs appear with correct statuses
4. Verify search (title match, body match, no match)
5. Verify status filter
6. Verify submit flow end-to-end on a new doc
7. Verify squiggle highlights appear and are clickable
8. Verify bidirectional focus (squiggle ↔ drawer row)
9. Verify Franchise Fit links to franchise detail
10. Verify version drift, Resubmit, and Unsubmit
11. Verify signal admin CRUD
12. Verify light/dark theme toggle and persistence
13. Verify error states (mock broken provider)
14. Verify `npm run build` passes
15. Produce `QA_REPORT.md`
16. Fix all Critical and Major issues from `QA_REPORT.md`

---

## EPIC 18: Deployment and Submission
**Labels:** chore
**Priority:** Urgent

Sub-tasks:
1. Deploy to Vercel (`vercel --prod`)
2. Add `GEMINI_API_KEY` and `GEMINI_MODEL_ID` to Vercel environment variables
3. Verify deployed app loads and the mock works without a key
4. Verify Gemini real provider works on the deployed URL
5. Create GitHub repo
6. Push all branches and merge all PRs to main
7. Invite collaborators: dkrish, AlexJBSP, ogrodev
8. Complete `README.md`: product overview, architecture, setup, key flows, AI approach, tradeoffs, did not build, improvements, where AI helped, what was manually verified
9. Record walkthrough video (5-10 min): what was built, core workflow, AI flow, interactions, tradeoffs, improvements, AI tools used, what was verified, deployed demo
10. Email GitHub link to Big Shot team
