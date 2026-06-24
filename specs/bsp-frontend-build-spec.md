# Frontend Build Spec: Creative Review Workspace

## YOUR JOB
You are building the complete UI for a Next.js creative-review web app. The backend, Tiptap editor component, design tokens, and seed data have already been built by other agents. Read this entire document, then build everything described. Do not ask clarifying questions. Do not add features beyond what is described. Import shared types and `StorageRepository` from the backend build; import `DocumentCanvas` from the Tiptap build; use only token values from the design tokens build. **Follow the Git Conventions doc (`bsp-git-conventions.md`) for every commit — commit frequently, use Conventional Commits format, and work on a feature branch.** When you are done, every screen in this spec is functional, all tests pass, `npm run build` succeeds, and `npm run lint` is clean.

**Deliverables checklist (verify before finishing):**
- [ ] `/` → redirects to seeded project library
- [ ] `/p/[projectId]` → filterable list with search and status filter
- [ ] `/p/[projectId]/d/new` → blank full-page editor, creates doc on mount
- [ ] `/p/[projectId]/d/[docId]` → document page, edit mode
- [ ] `/p/[projectId]/d/[docId]/review` → document page, read mode (share link)
- [ ] `/settings/signals` → full signal CRUD admin
- [ ] Results drawer (bottom sheet, dismissable, fixed height)
- [ ] All shared components (no duplicates): `DocumentCanvas`, `SignalBar`, `SignalRow`, `StatusChip`, `SubtypeChip`, `ContextChip`, `ResultsDrawer`, `Breadcrumb`, signal form, `EmptyState`, `LoadingState`, `ErrorState`
- [ ] Light/dark theme toggle persisted
- [ ] Cmd/Ctrl+Enter keyboard shortcut for Submit
- [ ] Tests for all logic (see Tests section)
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

Build the UI on top of the backend spec (shared types, `POST /api/review`, `StorageRepository`) and the Tiptap editor component. Next.js App Router + TypeScript strict + Tailwind + shadcn. Super minimal aesthetic per the Design Tokens spec. Scope tightly; do not add features.

## Depends on (import, do not redefine)
- Shared types + `StorageRepository` from the backend spec.
- The Tiptap `DocumentCanvas` component + `SignalHighlight` extension (built separately per the Tiptap editor prompt). Props: `mode: "edit" | "read"`, `onHighlightClick(signalId: string)`, `setSignalHighlights(issues)`. Packages needed: `@tiptap/react`, `@tiptap/core`, `@tiptap/extension-document`, `@tiptap/extension-paragraph`, `@tiptap/extension-text`, `@tiptap/extensions` (UndoRedo + Placeholder), `@tiptap/pm` (ProseMirror primitives — always import from here, never from `prosemirror-*` directly).
- The Design Tokens spec for every visual value.

## Information architecture & routes
- The app opens inside a seeded project.
- Breadcrumb: **Account > Project > Document**. "Account" is a stub (click → popup: "this would let you switch projects / manage the account").
- Routes:
  - `/` → redirect to the seeded project's library.
  - `/p/[projectId]` → document library (list).
  - `/p/[projectId]/d/new` → blank full-page editor; creates and saves an empty doc to `StorageRepository` on mount, then redirects to its `/d/[docId]` route.
  - `/p/[projectId]/d/[docId]` → document page (edit mode for the author).
  - `/p/[projectId]/d/[docId]/review` → review (read) mode; renders the submitted snapshot. **The share link points here.**
  - `/settings/signals` → signal admin (full CRUD). Reached from a Settings entry, not the breadcrumb.

## Screens

### 1. Document library — `/p/[projectId]`
- A filterable **list** (rows), not a board.
- Minimal header: breadcrumb, project name, a **search input** (full-text over title **and** body), a status filter, a **New** button.
- Row: title, subtype chip, status chip, created-by, reviewer (if any), updated time. Click → document page.
- Seeded on first run, so the default view isn't empty. Empty state only when a filter/search matches nothing.

### 2. Document page — `/p/[projectId]/d/[docId]`
One component, two modes (`edit` | `read`).

Minimal top bar (one row): breadcrumb, a **read-only project-context chip** ("Eloise · kids 6-12"), the status control, and the primary action (Submit in edit mode).

Fields:
- **Title** (editable; AI-suggested on submit if empty).
- **Subtype chip**: AI-detected on submit; user can change it via dropdown, which flips `subtypeSource` to `user` and **stops the AI from overriding it** on future submits.
- **Body**: the `DocumentCanvas`. Asset links live inline.

**Edit mode (author):**
- Primary action: **Submit**. On Submit: `POST /api/review` (text + project + signals); on success: set `submittedSnapshot = { body, review, submittedAt }`, set status to `submitted` if currently `draft`, apply prefill (subtype/title/themes, respecting `user` sources), open the results drawer with the verdict + bars, and render inline squiggles.
- Soft gate: a "needs work" / "not ready" verdict is made obvious in the drawer; never a hard block.
- After submit the author may keep editing the **live working body**. Editing clears current highlights (per the canvas spec). **The submitted snapshot is not touched.**
- **Version drift:** when `body !== submittedSnapshot.body`, show an "edited since submit" indicator plus **Resubmit** and **Unsubmit** actions.
  - **Resubmit:** re-runs review on the current body and **replaces** `submittedSnapshot` (the old snapshot is discarded — no history). Status stays/returns to submitted.
  - **Unsubmit:** manual only. Clears `submittedSnapshot`, status → `draft`. **Never automatic.**

> Reasoning (per product owner): "Submitted" is a snapshot, not a live pointer. After submitting, an author often works ahead on the next part while the submitted version is still good enough to review. So edits never auto-unsubmit; the reviewer keeps seeing the snapshot until the author chooses to Resubmit (replace) or Unsubmit.

**Read mode (reviewer, via share link):**
- Renders the **`submittedSnapshot`** (its body + its review), not the author's live working copy.
- Canvas with highlights + the results drawer (verdict + bars), body read-only.
- Reviewer actions (on the doc page, not the library): change status (In Review / Changes Requested / Approved). **Approving** opens a destination picker (default **Digital test**; also Animation, Marketing, Development, Production) and sets `routing`.
- A "copy link" affordance (the link is just this route).

### 3. Results drawer (bottom sheet)
- Slides up from the bottom on Submit. **Dismissable, fixed height.**
- Header: overall verdict — a label ("Looks ready" / "Needs work" / "Not ready") + a flag count ("2 of 6 need attention"). **Computed on submit only, never live.**
- Body: the six signals. Each row: signal name, score as `x/10`, a proportional fill bar (green/amber/red relative to the signal's own threshold), and the rationale. For **Clarity** and **Brand Safety** (the two inline signals) the row also lists their flagged phrases. Hook Strength is doc-level and may quote a line in its rationale, but does not render a squiggle in the canvas.
- **Bidirectional focus:** clicking a flagged phrase in the drawer scrolls to + emphasizes the squiggle in the canvas; clicking a squiggle focuses the matching drawer row. Applies to Clarity and Brand Safety only.
- **Franchise Fit** row: the "franchise" reference is clickable → opens the franchise detail (audience, tone, world), so a low score is explainable. (Live prompting against the franchise = not built.)

### 4. Signal admin — `/settings/signals` (full CRUD)
- List of signals (the six seeded + any created): name, mode (inline/doc), threshold.
- Create/Edit: one reused form — name, prompt, threshold, mode.
- Delete with confirm.
- Writes through `StorageRepository`. This set is the single source the review uses.

## Shared components (reuse — no duplicates)
`DocumentCanvas` (edit/read), `SignalBar` (single proportional fill bar, per the design tokens spec), `SignalRow`, `StatusChip`, `SubtypeChip`, `ContextChip`, `ResultsDrawer`, `Breadcrumb`, the signal form (create+edit), and `EmptyState` / `LoadingState` / `ErrorState` (parameterized; `ErrorState` reads the `AppError` code → shows the reason + retry where `retryable`).

## States (every screen)
- **Loading:** Submit in progress → drawer loading state; subtle pending indicator on the doc.
- **Empty:** filtered-empty library; empty editor placeholder ("Start your brief…").
- **Error:** `ErrorState` renders the typed `AppError` (e.g. `AI_RATE_LIMIT` → "rate limited, retry"; `AI_BAD_JSON` → "couldn't read the response, retry"; `STORAGE_QUOTA` → "storage full"). Retry where `retryable`.

## Theming & polish (Option A, the showpiece)
- Light/dark toggle (persisted), tokens only, no hard-coded colors.
- Drawer slide-up transition; squiggle hover tooltips; bidirectional highlight↔drawer focus; status/subtype transitions. Keyboard: **Cmd/Ctrl+Enter = Submit** (more shortcuts later).

## Tests (top 20% / ~80% coverage)
- Library search + status filter logic.
- Status state machine: valid transitions, auto-`submitted` on submit.
- Version drift: `body` vs snapshot detection; Resubmit replaces snapshot; Unsubmit clears it.
- Subtype source: manual change flips to `user`; AI does not override on resubmit.
- Drawer renders verdict + bars from a `ReviewResult`; bar color maps to each signal's threshold.
- `ErrorState` renders each `AppError` code.
- Plus ESLint + strict `tsc`.

## Out of scope (do not build)
- **Submission version history / stacking.** We chose replace; the prior submitted version is discarded on Resubmit. (Stacking, diffing submitted versions, or a submission timeline = a "with more time" item.)
- Live prompting against the franchise from the signal view.
- Auth, multi-user, real-time collaboration, cross-device sync, a database, rich-text formatting, a board/kanban library, project-management UI.
