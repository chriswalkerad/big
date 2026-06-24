# QA Agent Spec: Creative Review Workspace

## YOUR JOB
You are a QA tester. The app has been built and reviewed. Your job is to operate the running application like a real user who has never seen the code, and report everything that does not work, looks wrong, or feels broken. You do not fix anything. You do not read the code unless something is broken and you need to diagnose it. You work from the running app.

Before starting: read `REVIEW_REPORT.md` if it exists. Known issues from the review agent do not need to be re-reported, but you should verify whether they were fixed.

The app runs at `http://localhost:3000`. Start it with `npm run dev` if it is not already running.

Work through every test case below in order. For each one, write PASS, FAIL (with what you saw), or SKIP (with why). When done, write your findings to `QA_REPORT.md` in the repo root.

---

## Setup
- [ ] `npm install` completes with no errors.
- [ ] `npm run dev` starts with no errors and no environment variables set.
- [ ] `http://localhost:3000` loads in a browser within 5 seconds.

---

## Library (the document list)

- [ ] The app redirects from `/` to the project library.
- [ ] The breadcrumb reads "Account > Eloise at The Plaza".
- [ ] Exactly four documents appear in the list on first load.
- [ ] Each row shows: title, subtype chip, status chip, created-by name.
- [ ] Status chips are present and correct: Doc 1 = Approved, Doc 2 = Submitted, Doc 3 = Changes Requested, Doc 4 = Draft.
- [ ] Clicking "Account" in the breadcrumb opens a popup explaining what this would do (not a broken link or 404).
- [ ] The "New" button is visible.
- [ ] The search bar is visible.

**Search:**
- [ ] Type "midnight" → only "Eloise and the Midnight Room-Service Caper" appears.
- [ ] Type "body count" → only "Eloise and the Haunted Service Elevator" appears.
- [ ] Clear the search → all four documents return.
- [ ] Type a word that matches no title or body → the empty state appears (not a blank list with no message).

**Status filter:**
- [ ] Filter by "draft" → only "Rooftop idea" appears.
- [ ] Filter by "changes_requested" → only "Eloise and the Haunted Service Elevator" appears.
- [ ] Clear filter → all four return.

---

## Document page — read mode (seeded approved doc)

- [ ] Click "Eloise and the Midnight Room-Service Caper" → opens at `/p/proj-eloise/d/doc-midnight-caper`.
- [ ] The document is in read mode (body is not editable).
- [ ] The title shows correctly.
- [ ] The subtype chip shows "Story Premise".
- [ ] The project context chip shows something like "Eloise at The Plaza · Kids 6-12".
- [ ] The status shows "Approved".
- [ ] No Submit button is visible (it is already approved).
- [ ] The results drawer is visible or accessible (this doc has a submitted snapshot with a review).
- [ ] The drawer header shows "Looks ready" and "0 of 6 need attention".
- [ ] All six signal rows appear in the drawer with scores and fill bars.
- [ ] No red or amber squiggles appear in the document body (all signals passed).
- [ ] A "copy link" affordance exists. Clicking it copies `/p/proj-eloise/d/doc-midnight-caper/review` or similar to the clipboard.
- [ ] Opening that link in a new tab renders the review state correctly.

---

## Document page — risky doc (changes requested)

- [ ] Click "Eloise and the Haunted Service Elevator".
- [ ] The document is in read mode (changes requested, not draft).
- [ ] The results drawer shows "Not ready".
- [ ] Brand Safety row shows a low score (below 7) and a red fill bar.
- [ ] Two red squiggles appear in the body: one under "they're never seen again" and one under "a rising body count as the hotel empties out".
- [ ] Hovering a squiggle shows a tooltip message.
- [ ] Clicking a squiggle focuses the Brand Safety row in the drawer (the row is highlighted or scrolled to).
- [ ] Clicking the Brand Safety flagged phrase in the drawer scrolls to and emphasizes the matching squiggle in the body.
- [ ] Clicking "Franchise Fit" (or a link within that row) opens the franchise detail (audience, tone, world context for Eloise).

---

## Document page — vague doc (submitted)

- [ ] Click "A New Friend at the Plaza".
- [ ] Amber squiggles appear on the vague phrases.
- [ ] The drawer shows "Needs work" with a flag count of 3.
- [ ] Clarity row has a low score and an amber fill bar.
- [ ] Completeness and Character rows also have low scores.

---

## Document page — draft stub (edit mode)

- [ ] Click "Rooftop idea".
- [ ] The document is in edit mode (body is editable).
- [ ] The editor shows the stub text "Eloise does something on the rooftop. TBD."
- [ ] No results drawer is visible (this doc has not been submitted).
- [ ] The Submit button is visible.
- [ ] The subtype chip shows "World Building".

**Submit flow:**
- [ ] Add some text to the body (type a few sentences).
- [ ] Click Submit (or press Cmd/Ctrl+Enter).
- [ ] A loading state appears while the review runs (spinner or skeleton in the drawer area).
- [ ] The results drawer slides up from the bottom after the review completes.
- [ ] The drawer shows a verdict label and a flag count.
- [ ] All six signal rows appear with scores and fill bars.
- [ ] The status chip updates to "Submitted".
- [ ] The subtype chip updates to the AI-detected type (or stays if already set by user).

**Prefill:**
- [ ] After submitting, if the title was empty, it is now filled with an AI suggestion.
- [ ] Themes or tags are visible somewhere on the page.

**Version drift:**
- [ ] After submitting, edit the body text.
- [ ] An "edited since submit" indicator appears.
- [ ] A "Resubmit" action is visible.
- [ ] An "Unsubmit" action is visible.
- [ ] Clicking "Resubmit" re-runs the review and the drawer updates with new results. The status stays Submitted.
- [ ] Clicking "Unsubmit" clears the review, removes the drawer, and sets status back to Draft.

---

## New document

- [ ] Click the "New" button in the library.
- [ ] A blank full-page editor opens.
- [ ] The editor shows the placeholder text "Start your brief…" (or similar).
- [ ] The document appears in the library when navigating back.

---

## Signal admin

- [ ] Navigate to Settings > Signals (or equivalent).
- [ ] All six seeded signals are listed: Clarity, Completeness, Brand Safety, Hook Strength, Character Distinctiveness, Franchise Fit.
- [ ] Clicking a signal opens an edit form with name, prompt, threshold, and mode fields pre-filled.
- [ ] Editing a signal and saving persists the change (refresh and verify).
- [ ] Creating a new signal with a name, prompt, threshold, and mode saves and appears in the list.
- [ ] Deleting a signal shows a confirmation prompt before deleting.
- [ ] After deleting and navigating back to a doc, the deleted signal does not appear in the next review.

---

## Theming

- [ ] A light/dark toggle is visible in the app shell.
- [ ] Toggling to dark mode: the background goes dark, text goes light, no white flash.
- [ ] Toggling back to light: the background goes light.
- [ ] Refreshing the page preserves the selected theme.
- [ ] In dark mode, squiggle colors are still visible (lighter red/amber on dark backgrounds).
- [ ] No hard-coded white or black backgrounds flash during theme transitions.

---

## Error states

- [ ] With no `GEMINI_API_KEY` set, clicking Submit on a new doc runs the mock and succeeds (not an error).
- [ ] If the mock provider is temporarily broken (comment out its return), submitting shows an error state in the drawer with a human-readable message and a retry option.
- [ ] The error message is specific (not "Something went wrong") — it should name the problem (e.g. "Couldn't read the model's response").

---

## Performance and polish

- [ ] Navigating between the library and a document is fast (no full-page reload flash).
- [ ] The drawer slides up with a smooth animation (not an instant jump).
- [ ] Status chips and subtype chips have consistent styling throughout.
- [ ] On a narrow browser window (~768px), the layout does not break or overflow horizontally.

---

## Final checks

- [ ] `npm run build` passes with no errors.
- [ ] `npm run lint` passes with no errors.
- [ ] `npm test` — all tests pass.
- [ ] `README.md` exists and contains: setup instructions, product overview, AI/model approach, what was not built.

---

## Output
Write your findings to `QA_REPORT.md` in the repo root. Format:

```
# QA Report

## Summary
X passed, Y failed, Z skipped.

## Failed tests
### [QA-001] Short title
Steps: What you did.
Expected: What should have happened.
Actual: What happened instead.
Severity: Critical (blocks demo) / Major (visible bug) / Minor (polish issue)

## Passed tests
(list, no detail needed)

## Skipped tests
(list with reason)
```

Do not fix anything. Do not commit code changes. Write the report only.
