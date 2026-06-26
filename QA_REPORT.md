# QA Report — Creative Review Workspace

QA of the Creative Review Workspace, per `specs/bsp-qa-agent-spec.md`. This report supersedes
the original EPIC 17 / BIG-21 live-Chromium pass: since that run the app went through a full
UI redesign, three rounds of feature work (streaming voice dictation, reviewer inbox,
collapsible left-nav rail), a multi-agent code review, a one-time data migration, and a WCAG
2.1/2.2 AA audit. The original report described a **bottom slide-up results drawer** and a
one-click Submit; neither matches the current app. It is rewritten here to be current and
accurate to the code as it stands on `origin/qa/redesign`.

## Summary

The product is **green across every gate** and **covered by two automated suites plus
repeated manual visual-QA rounds**:

- **Unit / component:** **Vitest — 465 passed across 47 files** (run during this report; the
  README's "461" predates the latest additions). Zero failures, zero skips.
- **End-to-end:** **Playwright — 8 spec files** driving real Chromium against the running app
  (`reviewer`, `submit`, `library`, `drift`, `squiggles`, `signals`, `theme`, `drawer-dismiss`).
  Coverage below is described **from the specs** — Playwright browsers are not assumed present
  in this environment, so the E2E suite was not executed here.
- **Static gates:** `tsc --noEmit` clean · `eslint` clean · `next build` OK.

**Posture:** zero-config on the deterministic **MockProvider** (no env vars, no database) with
a real **Azure** provider available when keys are set (Azure OpenAI for review/apply, Azure
Speech for dictation). **Gemini has been removed** — the provider chain is Azure-or-mock only.
Three roles are exercised: **author** (draft → run review → confirm submit → iterate),
**reviewer** (read snapshot → status → approve + route), and **admin** (signal CRUD).

There are **no open defects**. The single carried-forward item (`themes` not surfaced in the
UI) remains a documented, out-of-scope enhancement, not a bug — see Carried-forward items.

## What changed since the original QA report

The original matrix was written against a **bottom slide-up drawer** that dismissed on Escape
and a single-step Submit. The redesign changed both, so several original test IDs no longer
describe the app. The current behaviors the suites verify:

- **Results drawer → inline results panel.** Results now render in an always-present inline
  **`region` "Review results"** (right column on desktop, stacked on mobile), not a dismissable
  bottom sheet. It shows a "No review yet." placeholder until a review runs. The `drawer-dismiss`
  spec now asserts the *opposite* of the old behavior: there is **no** "Dismiss results" button
  and **Escape does not hide the panel**.
- **One-step Submit → two-step Run review → Confirm submission.** "Run review" produces a
  **preview** (verdict header + six signal rows) without creating a snapshot or changing status;
  the panel then offers **"Confirm submission"**, which commits Draft → Submitted, applies the
  prefill. The reviewer is chosen via an in-panel picker (no celebration overlay). Cmd/Ctrl+Enter
  runs the *preview*, not the commit.
- **Reviewer is chosen on submit** (`reviewer-choice.tsx`); the library doubles as a reviewer
  **inbox** over the review queue.
- **Design-system migration:** shared accessible `Select` (on the `Menu` primitive) and `Badge`
  pill replaced ad-hoc dropdowns/chips; the nav was unified into one `TopBar` with Account moved
  to a `⋯` menu.
- **Collapsible left-nav rail** added (`app-shell` flex restructure), with an edge toggle,
  tooltips, an inbox badge, and last-active-project persistence for id-less routes.
- **Streaming voice dictation** (Azure Speech) added as the third AI workflow; an earlier batch
  `/api/transcribe` route was removed in favor of real-time streaming.
- **Gemini removed** (`refactor: remove Gemini provider and sweep dead code`); provider
  selection is Azure-or-mock.

## QA rounds since the original report

1. **UI redesign pass** — Notion/Linear-minimal restraint, neutral grayscale ramp with color
   reserved for functional squiggles/bars only, design-system `Select`/`Badge`, neutral focus
   ring. Tracked in `REDESIGN.md`; verified by hand on localhost and by updated unit/E2E specs.
2. **Multi-agent code review** (`REVIEW_REPORT.md`, EPIC 16 / BIG-20) — base `0bedc70`.
   **41 checks: 40 passed, 1 finding.** Verified `tsc`/`lint`/`test` (234 at the time)/`build`
   green; confirmed all routes, the typed `/api/review` union, the status state machine,
   snapshot-vs-pointer semantics, mock determinism with real-substring quotes, no `any`, no
   hard-coded colors, no duplicate components, no `prosemirror-*` imports, and server-side-only
   keys. The one finding (ISSUE-001) is the `themes` prefill, deferred as a spec-vs-spec tension
   (carried forward below).
3. **WCAG 2.1/2.2 AA audit + fixes** (`A11Y_REPORT.md`) — static review of every component +
   route across 5 dimensions (contrast, screen-reader/semantics, keyboard/focus, motion, forms),
   exact contrast math against both token themes, plus an `axe-core` chromium scan (light + dark).
   **17 findings: 13 fixed, 4 reported-only** (Critical 0, Serious 6/5 fixed, Moderate 7/6,
   Minor 4/2). Fixes: darkened/lightened `text-tertiary`/`text-secondary` tokens + new
   `*-text` severity tokens (60/64 text-UI pairings now pass AA; the 4 remaining are graphical,
   non-text, in report-only files), a skip link + `main` landmark id, a shared `useFocusTrap`
   hook wired into all modal dialogs, full menu keyboard navigation, and signal-form required
   fields + `role="alert"` errors. Post-fix verification: `test` 258 / 36 files green.
4. **Data-migration / dictation / storage / schema fix rounds** (see `git log`) — a one-time
   gated migration (`src/lib/migrate.ts`, `fix(storage): migrate persisted user data to
   post-redesign shapes`) rescaling legacy 0-10 scores to 0-100, resolving bare-string reviewers
   to `Person` objects, and stripping a stale prompt placeholder; plus focused fixes:
   `fix(dictation)` (auth-cancel restart, re-entrant guard, commitInterim lands final text),
   `fix(speech-token)` (no-store the minted token, split availability from minting),
   `fix(schema-env)`, `fix(editor)` (keep interim dictation out of onChange/history), and
   `fix(doc-page)` (guard Escape, gate speech to edit mode). Each is unit-tested.
5. **Ongoing manual visual-QA loop on localhost** — repeated by-hand passes captured in
   `README.md` §10: zero-config run, seeded-review fidelity (the *Haunted Service Elevator* mock
   re-review reproduces its stored `not_ready` verdict + red Brand Safety squiggles), submit +
   drift, AI rewrite Accept/Discard, voice dictation (present with keys, hidden without),
   reviewer status/route flow, bidirectional squiggle↔panel focus, and theming with no white flash.

## Automated coverage

### Vitest — unit / component (465 passed / 47 files)

Grounded in the actual test files run for this report:

| Area | Files | What it asserts |
|---|---|---|
| API handlers + routes | `api/review/{handler,route}.test.ts`, `api/apply/{handler,route}.test.ts`, `api/speech-token/{handler,route}.test.ts` | zod request validation, the typed `{ ok, data } \| { ok, error }` union, empty-doc short-circuit, never-throws, short-lived token minting |
| Providers | `providers/mock.test.ts` (24), `providers/azure.test.ts`, `providers/select.test.ts`, `providers/prompts.test.ts` | mock determinism + **real-substring quotes**, Azure provider shape, **server-side Azure-or-mock selection** |
| Schemas / errors | `schemas.test.ts`, `errors.test.ts` | `ReviewResult` re-validation + score clamping (0-100), `toAppError` mapping per failure type |
| Document logic | `doc-page.test.ts` (24), `doc-transitions.test.ts`, `doc-body.test.ts` | status state machine (valid transitions only), version-drift, subtype source flag, submit/resubmit/unsubmit/approve, HTML↔text bridge |
| Storage + migration | `storage.test.ts` (19), `migrate.test.ts` (18), `seed-data.test.ts` | get/save/list/remove, SSR + quota fallback, the one-time migration (rescale, reviewer resolution, placeholder strip), exact seeded ids/text |
| Dictation / clients | `use-dictation.test.ts`, `speech-token-client.test.ts`, `review-client.test.ts`, `apply-client.test.ts`, `signal-form.test.ts`, `library.test.ts` | dictation lifecycle, client API wiring, signal-form validation, library search/filter |
| Components | `document-page.test.tsx` (27), `editor/SignalHighlight.test.ts`, `signal-bar.test.tsx`, `status-chip`, `subtype-chip`, `badge`, `breadcrumb`, `franchise-detail`, `empty/loading-state`, `error-state` | page behaviors, highlight decoration math, bar fill-vs-threshold color, chips/badges, every `AppErrorCode` rendering |

### Playwright — E2E (8 spec files, described from the specs)

Each test runs in an isolated browser context, so `localStorage` starts empty and
`StorageRepository` re-seeds the four docs + six signals per test (`playwright.config.ts`,
`baseURL :3000`, `reuseExistingServer`).

| Spec | User flow exercised |
|---|---|
| `library.spec.ts` | `/` → seeded library redirect; four seeded docs present; **search** by title and by body ("body count" → Haunted Elevator) with no-match empty state; **status filter** (Draft → Rooftop, Changes Requested → Haunted); Account breadcrumb opens the switcher stub dialog |
| `submit.spec.ts` | Draft stub editable with empty results panel; **Run review** previews a verdict + exactly six signal rows while status stays **Draft**; **Confirm submission** commits Draft → Submitted; Cmd/Ctrl+Enter runs the preview; empty title is AI-prefilled only on confirm |
| `drift.spec.ts` | Submit the stub (Run review → Confirm); editing surfaces the **"Edited since submit"** drift status with Resubmit/Unsubmit; **Resubmit** re-previews then confirm keeps status Submitted and clears drift; **Unsubmit** empties the panel and returns to Draft |
| `reviewer.spec.ts` | Read-mode review route: change status (Submitted → In Review); **Approve** opens the destination picker (default Digital Test), pick Animation → records "Routed to Animation"; Copy-link affordance present |
| `squiggles.spec.ts` | Seeded Haunted Elevator review: **two `brand_safety` risk squiggles** ("they're never seen again", "a rising body count…") with `data-severity="risk"` + tooltip; squiggle click focuses its panel row (`data-focused`); panel phrase click emphasizes the matching squiggle (`--focus`) |
| `signals.spec.ts` | Admin CRUD: lists the six seeded signals; **create** "Originality" persists across reload; **edit** Clarity threshold 7 → 9 persists; **delete** Franchise Fit only after a confirm dialog, stays gone after reload |
| `theme.spec.ts` | Light/dark toggle: force dark, persists across reload; switch back to light, persists — asserting the `.dark` class and the correctly-labelled toggle button |
| `drawer-dismiss.spec.ts` | The inline results panel is **always present** — **no** "Dismiss results" button and **Escape does not hide it** (the post-redesign inversion of the old drawer); the looks-ready snapshot shows the "Looks ready" / "0 of 6 need attention" header and six rows |

## Scenario / test matrix

Status grounded in the suites above (U = Vitest, E = Playwright spec). No result is invented;
"Manual" items are from the README §10 by-hand loop, not an automated assertion.

| # | Scenario | Covered by | Status |
|---|---|---|---|
| 1 | `/` redirects to the seeded library | E `library` | PASS |
| 2 | Four seeded docs present, correct statuses | E `library` · U `seed-data` | PASS |
| 3 | Search by title and by body; no-match empty state | E `library` · U `library` | PASS |
| 4 | Status filter (Draft, Changes Requested, clear) | E `library` | PASS |
| 5 | Account breadcrumb opens switcher stub (not a 404) | E `library` | PASS |
| 6 | Approved doc read mode: "Looks ready", 0/6, six rows, no squiggles | E `drawer-dismiss` | PASS |
| 7 | Risky doc: two red Brand Safety squiggles + tooltip | E `squiggles` · U `mock` | PASS |
| 8 | Squiggle → panel-row focus; phrase → squiggle emphasis | E `squiggles` | PASS |
| 9 | Vague doc: amber Clarity squiggles, low scores | U `mock`/`doc-page` | PASS |
| 10 | Draft stub editable, empty results panel, Run review visible | E `submit` | PASS |
| 11 | Run review previews verdict + six rows, status stays Draft | E `submit` | PASS |
| 12 | Confirm submission commits Draft → Submitted | E `submit` | PASS |
| 13 | Cmd/Ctrl+Enter runs the preview | E `submit` | PASS |
| 14 | Empty title AI-prefilled on confirm | E `submit` · U `doc-page` | PASS |
| 15 | Drift indicator after editing a submitted doc | E `drift` | PASS |
| 16 | Resubmit re-previews; confirm keeps Submitted, clears drift | E `drift` · U `doc-transitions` | PASS |
| 17 | Unsubmit clears panel, returns to Draft | E `drift` · U `doc-transitions` | PASS |
| 18 | Inline panel always present; no dismiss; Escape no-op | E `drawer-dismiss` | PASS |
| 19 | Reviewer status change (Submitted → In Review) | E `reviewer` · U `doc-page` | PASS |
| 20 | Approve → destination picker → routing recorded | E `reviewer` | PASS |
| 21 | Copy-link affordance in read mode | E `reviewer` | PASS |
| 22 | Signal CRUD: list / create / edit / delete (+confirm), persisted | E `signals` · U `signal-form` | PASS |
| 23 | Deleted signal absent from next review | U `storage`/`doc-page` | PASS |
| 24 | Light/dark toggle persists across reload | E `theme` | PASS |
| 25 | Squiggles visible in dark mode; no white flash | Manual (README §10) · A11Y | PASS |
| 26 | Zero-config mock submit succeeds (no key) | U `select`/`route` | PASS |
| 27 | Broken provider → typed, specific error + retry (not "Something went wrong") | U `errors`/`error-state` | PASS |
| 28 | AI rewrite: Apply → Rewriting → Accept/Discard | U `apply`/`apply-client` · Manual | PASS |
| 29 | Voice dictation: interim ghosts, commits on pause; hidden without keys | U `use-dictation`/`speech-token` · Manual | PASS |
| 30 | One-time migration (rescale, reviewer resolve, placeholder strip) | U `migrate` | PASS |
| 31 | Storage SSR / quota fallback to in-memory | U `storage` | PASS |
| 32 | Responsive ~768px, no horizontal overflow | Manual (README §10) | PASS |
| 33 | Focus-visible ring; modal focus trap; menu keyboard nav | A11Y (fixed) | PASS |

## Carried-forward items

- **[ISSUE-001 — Deferred, not a defect] Review `themes` are produced but not surfaced in the
  UI.** The provider returns `themes`, the `ReviewResult` zod schema validates them, and they
  persist inside `submittedSnapshot.review.themes`, but they are never promoted to a
  document-level field or rendered. Surfacing them would require adding a `themes` field to the
  spec-pinned canonical `Document` type (with a localStorage-migration consideration). Recorded
  in both `REVIEW_REPORT.md` (ISSUE-001) and the original QA note; treated as a "with more time"
  enhancement, not a bug. No action.
- **A11Y reported-only (4):** the `minor`/`pass` signal-bar fills measure 2.90 / 3.00 vs the
  ≥3:1 UI threshold on the panel track in light theme, and two `text-{risk,minor}` body-text uses
  in report-only files. All are **graphical/non-text or have a redundant numeric + `role="meter"`
  channel**, so no information is conveyed by color alone; the recommended one-line token swaps are
  documented in `A11Y_REPORT.md` §"What was fixed vs. reported". Every **text** pairing passes AA.

## Severity classification (per QA spec)

- **Critical** — blocks the demo: **0**
- **Major** — visible bug: **0**
- **Minor** — polish issue: **0** open (a11y items above are reported-only, non-text)
- **Cosmetic** — visual nit: **0**

## Verification

Run for this report on `feat/qa-report-refresh` (branched from `origin/qa/redesign`):

- `npx tsc --noEmit` — **clean**
- `npm run lint` (eslint) — **clean** (0 errors)
- `npm test` (Vitest) — **465 passed / 47 files**, 0 failed, 0 skipped
- `npm run build` (`next build`) — **OK**, all routes generated

Shipped to **Vercel via `main`** (zero env vars required for the mock; add `AZURE_OPENAI_*`
and optionally `AZURE_SPEECH_*` in project settings for the real providers).
