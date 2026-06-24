# QA Report — Creative Review Workspace

EPIC 17 / BIG-21 — live QA of the Creative Review Workspace, driven through Chromium
with Playwright against a running instance, per `specs/bsp-qa-agent-spec.md`.

## Summary

**80 checks passed, 0 failed, 0 skipped** against a clean build of `origin/main`
(`21f56d0`). Zero browser console errors across every flow. Every behavior in the QA
spec works: `/` redirect, search + status filter, all four seeded docs (approved / risky
/ vague / draft), Submit (button **and** Cmd/Ctrl+Enter), the results drawer with verdict
and six signal bars, inline squiggles with bidirectional phrase↔squiggle focus,
edit-after-submit drift → Resubmit / Unsubmit, the reviewer `/review` route with status
change → Approve → destination routing, signal-admin CRUD, light/dark persistence, drawer
dismiss (Escape + close), 768px responsiveness, and focus-visible styling.

There is **one finding**, and it is environmental, not a source defect: the running dev
server the task pointed me at (`http://localhost:3000`) had drifted off `origin/main` onto
a later, broken commit and was returning **HTTP 500 on every route**. It is classified
**Critical (blocks demo)** for the running instance but is **not present in `origin/main`**
(the branch under test, and the only code this agent may commit), so there is no source
change to apply on `feat/qa`. Details and evidence below.

## Environment

| | |
|---|---|
| Branch under test | `feat/qa`, branched from `origin/main` @ `21f56d0` |
| Worktree | isolated git worktree of `chriswalkerad/big` |
| Provider | deterministic MockProvider (no `GEMINI_API_KEY` set) — zero-config |
| Driver | Playwright 1.61.1 + bundled Chromium 1228 (isolated browser context per flow) |
| Static checks on `origin/main` | `tsc --noEmit` clean · `eslint` clean · `vitest` 234/234 · `next build` OK |
| Live target used for QA | **`http://localhost:3100`** — a production `next start` of `origin/main` (see finding QA-001 for why port 3000 could not be used) |
| Screenshots | `/private/tmp/.../scratchpad/qa-run/shots/` (outside the repo) |

### Why a second server (port 3100)

The task stated the app was already running on `:3000` from `main`. On first contact the
app was healthy and 17 checks passed. Between runs the running instance recompiled into a
**broken state** (500 on every route — see QA-001). That checkout
(`/Users/chris/dev/bigshot/creative-review-workspace`) is on commit `5aa3f6d`, which is
**ahead of `origin/main`** and imports a package that is not installed. Because I must QA
`origin/main` (not an unrelated downstream commit), and I must not run `next dev` or
restart anyone's server, I built `origin/main` in my worktree (`next build`, succeeded) and
served it with `next start -p 3100`. All live results below are from that clean instance.
This is a faithful production rendering of the code on the branch.

## Per-flow results

| Flow | Checks | Result |
|---|---|---|
| `/` → library redirect, breadcrumb, 4 seeded docs, row shape, status chips, New/Search | LIB-01…08 | PASS (8/8) |
| Search (title + body, clear, no-match empty state) | SRCH-01…04 | PASS (4/4) |
| Status filter (draft, changes_requested, clear) | FILT-01…03 | PASS (3/3) |
| Approved doc + `/review` read mode (read-only, "Looks ready", 0/6, 6 bars, no squiggles, copy link) | APP-01…12 | PASS (12/12) |
| Risky doc (Not ready, Brand Safety 2/10 red bar, 2 red squiggles, tooltip, squiggle→row, phrase→squiggle, franchise detail) | RISK-01…07 | PASS (7/7) |
| Vague doc (Needs work, 3 flags, 2 amber squiggles, Clarity/Completeness/Character low) | VAGUE-01…04 | PASS (4/4) |
| Draft stub (edit mode, stub text, no drawer, Submit visible, World Building) | DRAFT-01…05 | PASS (5/5) |
| Submit flow (loading state, drawer slide-up, verdict+count, 6 bars, status→Submitted, subtype) | SUB-01…06 | PASS (6/6) |
| Cmd/Ctrl+Enter submit | SUB-07 | PASS |
| Version drift → Resubmit / Unsubmit | DRIFT-01…05 | PASS (5/5) |
| New document (created on mount, placeholder, editable, appears in library) | NEW-01…04 | PASS (4/4) |
| Signal admin CRUD (list 6, edit prefilled, persist, create, delete-confirm, removed) | SIG-01…06 | PASS (6/6) |
| Reviewer route (status menu, In Review, Approve→picker→routing) | REV-01…04 | PASS (4/4) |
| Theming (toggle, switch, back, persist across reload, squiggles visible in dark) | THEME-01…05 | PASS (5/5) |
| Drawer dismiss (close button, Escape) | DISM-00…02 | PASS (3/3) |
| Responsiveness at 768px (no horizontal overflow, library + doc page) | RESP-01…02 | PASS (2/2) |
| Keyboard / focus-visible ring | KEY-01 | PASS |
| **Total** | **80** | **PASS 80 / FAIL 0 / SKIP 0** |

Console errors captured during the entire run: **none**.

## Findings

### [QA-001] Running dev server on `:3000` returns HTTP 500 on every route — Critical (blocks demo)

**Severity:** Critical (blocks the demo if this is the instance shown) — but **scoped to a
checkout that is NOT `origin/main`**; no defect exists on the branch under test.

**Where:** the developer's working checkout at
`/Users/chris/dev/bigshot/creative-review-workspace`, currently on commit `5aa3f6d`
("build(deps): add framer-motion as a project dependency"), which is **one commit ahead of
`origin/main` (`21f56d0`)**.

**Steps to reproduce:**
1. `curl http://localhost:3000/` (or any route).
2. Observe HTTP 500.

**Expected:** every route renders (the app is zero-config on the MockProvider).

**Actual:** every route returns 500. The browser console / server output shows a Next.js
build error:

```
Module not found: Can't resolve 'motion/react'
  ./src/components/status-chip.tsx:3  import { motion, useReducedMotion } from "motion/react";
  ./src/components/results-drawer.tsx:4  import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
```

**Root cause:** commit `5aa3f6d` added `"framer-motion": "^12.41.0"` to `package.json`
(but the components import from the **`motion/react`** entrypoint, a different package), and
**neither `motion` nor `framer-motion` is installed** in `node_modules`
(`ls node_modules/motion` → not found). The dev server compiled this broken module graph
into its `.next` cache and is stuck serving the failure.

**Why this is NOT fixed on `feat/qa`:** the branch under test (`origin/main`, `21f56d0`)
contains **no `motion/react` import anywhere** (`grep -rn "motion/react\|framer-motion" src`
→ nothing; the only `motion` hits are legitimate `prefers-reduced-motion` CSS) and **no
`framer-motion` dependency** in `package.json`. On `origin/main` the same components
(`status-chip.tsx`, `results-drawer.tsx`) import only `@/types`, `@/lib/utils`, React, and
`lucide-react`. A clean build of `origin/main` is green and all 80 live checks pass. There
is therefore no source line to change on this branch — applying a "fix" here would be
fixing a problem that does not exist in this code. The defect lives entirely in the
unmerged downstream commit `5aa3f6d` and its environment.

**Recommended action (for whoever owns commit `5aa3f6d`, not this branch):** either install
the dependency the imports actually need (`npm i motion`) and align `package.json` (it lists
`framer-motion`, the code imports `motion/react`), or revert the `motion/react` imports.
Then clear `.next` and restart the dev server. Until then the `:3000` instance is down.

## Deferred (Minor / Cosmetic)

**None.** No Minor or Cosmetic UI/UX issues were observed across the 80 live checks. The
app's behavior matched the spec on every flow, including edge cases (no-match empty state,
verdict prominence, drift indicator, off-screen drawer dismissal, dark-mode squiggle
contrast, 768px layout).

## Notes on a known prior item

`REVIEW_REPORT.md` recorded one deferred item (ISSUE-001: review `themes` are produced and
persisted inside `submittedSnapshot.review.themes` but not promoted to a document-level
field or surfaced in the drawer). This is a documented out-of-scope enhancement, not a
defect; it was not re-tested as a failure. The QA-spec "Themes or tags are visible
somewhere on the page" item is satisfied at the data level (themes are in the snapshot) but
there is no dedicated themes chip in the UI — consistent with the prior review's deferral.
No new action.

## Severity classification key (per QA spec)

- **Critical** — blocks the demo.
- **Major** — visible bug.
- **Minor** — polish issue.
- **Cosmetic** — visual nit.

Counts: Critical 1 (environmental, on a non-`origin/main` checkout; no source change on
`feat/qa`), Major 0, Minor 0, Cosmetic 0.
