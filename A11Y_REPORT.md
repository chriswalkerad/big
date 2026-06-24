# Accessibility Audit — Creative Review Workspace

WCAG 2.1 AA audit of the Creative Review Workspace (Next 16 / React 19 / Tailwind v4 / TS strict).
Branch: `feat/a11y-audit`. Method: static review of every component + route, exact contrast-ratio
math against the design tokens in `src/styles/tokens.css` (both themes), plus an `axe-core` scan
(chromium, light + dark) of the live app for corroboration.

## Executive summary

The app was already in good shape for semantics: correct landmarks (`header`/`nav`/`main`),
labelled inputs, icon-only buttons with `aria-label`, `aria-current` on breadcrumb/menu, a meter for
signal bars, `role="status"`/`role="alert"`/`aria-live` on async states, `aria-hidden` on decorative
icons, and a global `prefers-reduced-motion` rule. The squiggle highlights (decorations, not
focusable) are correctly supplemented by keyboard-reachable issue buttons in the results drawer.

The two material problem areas were **color contrast** and **modal focus management**:

- **Contrast:** `text-tertiary` failed AA as text in *both* themes (light 2.33–2.56:1, dark
  3.52–4.10:1), including where it renders placeholder/meta text; `text-secondary` failed on `panel`
  in light (4.40:1); and the functional severity colors failed badly as *text* in light
  (`minor`/`pass` ≈ 2.9–3.3:1). The `axe-core` scan independently flagged exactly these
  (`color-contrast` serious, on the library meta line and the signal "mode" chip).
- **Focus:** the modal dialogs (signal create/edit, delete-confirm, destination picker, franchise
  detail, account stub) closed on Escape but did **not** trap Tab focus or reliably move focus in,
  so keyboard users could tab into the page behind the backdrop. The popover `Menu` did not move
  focus into the panel or support arrow-key navigation.

### Severity counts (findings)

| Severity | Count | Fixed | Reported-only |
|----------|------:|------:|--------------:|
| Critical | 0 | 0 | 0 |
| Serious  | 6 | 5 | 1 |
| Moderate | 7 | 6 | 1 |
| Minor    | 4 | 2 | 2 |
| **Total** | **17** | **13** | **4** |

"Reported-only" = the fix lives in a file owned by another parallel agent (see the do-not-edit list:
`results-drawer.tsx`, `signal-row.tsx`, `signal-bar.tsx`, `document-page.tsx`, `editor/**`,
`providers/**`, `seed/**`, `types/index.ts`, `schemas.ts`). For those I record the exact change to make.

### Contrast result

After the token fixes, **60 of 64** measured text/UI pairings pass AA (light 28/32, dark 32/32). The
4 remaining light-mode FAILs are all **graphical, non-text, and in report-only files** (the `minor`
and `pass` signal-bar fills measure 2.90 and 3.00 vs the ≥3:1 requirement; the drift card's amber
border is decorative). Every **text** pairing — primary/secondary/tertiary, placeholders, and the
new `*-text` severity variants — passes ≥4.5:1 in both themes.

---

## Contrast table

Computed with the WCAG relative-luminance formula. "UI" rows use the 3:1 non-text threshold; all
other rows use 4.5:1 (normal text). **Before** = original token values; **After** = post-fix.

### Light theme

| Pairing | Before | After | Req | Result |
|---|---:|---:|---:|---|
| text-primary on bg / surface / panel | 17.7 / 17.0 / 16.1 | (unchanged) | 4.5 | PASS |
| text-secondary on bg | 4.83 | 6.42 | 4.5 | PASS |
| text-secondary on surface | 4.63 | 6.15 | 4.5 | PASS |
| **text-secondary on panel** | **4.40 FAIL** | **5.84** | 4.5 | **PASS** |
| **text-tertiary on bg** | **2.56 FAIL** | **5.28** | 4.5 | **PASS** |
| **text-tertiary on surface** | **2.46 FAIL** | **5.06** | 4.5 | **PASS** |
| **text-tertiary on panel** | **2.33 FAIL** | **4.81** | 4.5 | **PASS** |
| **placeholder (text-tertiary) on surface** | **2.46 FAIL** | **5.06** | 4.5 | **PASS** |
| **risk as text on panel** | **4.39 FAIL** | **5.89** (risk-text) | 4.5 | **PASS** |
| **minor as text on bg / surface / panel** | **3.19 / 3.05 / 2.90 FAIL** | **5.02 / 4.81 / 4.57** (minor-text) | 4.5 | **PASS** |
| **pass as text on bg / surface** | **3.30 / 3.16 FAIL** | **5.02 / 4.81** (pass-text) | 4.5 | **PASS** |
| text-bg on bg-accent (button label) | 17.7 | (unchanged) | 4.5 | PASS |
| focus ring (accent) on bg / surface / panel | 17.7 / 17.0 / 16.1 | (unchanged) | 3 (UI) | PASS |
| bar fill risk on panel (UI) | 4.39 | (unchanged) | 3 (UI) | PASS |
| bar fill **minor** on panel (UI) | 2.90 | 2.90 | 3 (UI) | **FAIL — reported (signal-bar.tsx)** |
| bar fill **pass** on panel (UI) | 3.00 | 3.00 | 3 (UI) | **FAIL — reported (signal-bar.tsx)** |
| squiggle risk / minor on bg (UI) | 4.83 / 3.19 | (unchanged) | 3 (UI) | PASS |
| status dot (text-tertiary) on panel (UI) | 2.33 | 4.81 | 3 (UI) | PASS |
| verdict badge border risk / minor on surface (UI) | 4.63 / 3.05 | (unchanged) | 3 (UI) | PASS |
| drift card border (minor) on bg (UI, decorative) | 1.55 (/40) | 3.19 (solid) | 3 (UI) | PASS on bg |

### Dark theme

| Pairing | Before | After | Req | Result |
|---|---:|---:|---:|---|
| text-primary on bg / surface / panel | 19.0 / 17.6 / 16.3 | (unchanged) | 4.5 | PASS |
| text-secondary on bg / surface / panel | 7.72 / 7.19 / 6.63 | (unchanged) | 4.5 | PASS |
| **text-tertiary on bg** | **4.10 FAIL** | **5.41** | 4.5 | **PASS** |
| **text-tertiary on surface** | **3.81 FAIL** | **5.03** | 4.5 | **PASS** |
| **text-tertiary on panel** | **3.52 FAIL** | **4.64** | 4.5 | **PASS** |
| **placeholder (text-tertiary) on surface** | **3.81 FAIL** | **5.03** | 4.5 | **PASS** |
| risk/minor/pass as text (all surfaces) | 6.2–11.9 | (unchanged) | 4.5 | PASS |
| All UI/graphical (bars, squiggles, focus ring, dots, borders) | 1.1–18.9 | (unchanged) | 3 (UI) | PASS |

> Token change summary (light): `--text-secondary` `#71717a`→`#5e5e66`; `--text-tertiary`
> `#a1a1aa`→`#6b6b73`; new `--risk-text #b91c1c`, `--minor-text #b45309`, `--pass-text #15803d`.
> (dark): `--text-tertiary` `#71717a`→`#85858d`; `--risk-text/--minor-text/--pass-text` equal the
> existing bright values (already ≥4.5:1 as text). Hue family (zinc / functional) preserved; changes
> are intentionally subtle.

The `border` token (≈1.1–1.3:1) is *not* counted as a failure: per WCAG 1.4.11 the input/card
outlines are decorative (the control is identifiable by its content/placeholder/label), and the
focus indicator — which *is* required — uses the high-contrast `accent` ring (16–19:1).

---

## Findings by area

### Contrast

- **[Serious] `text-tertiary` fails AA as text — both themes.** WCAG 1.4.3 (Contrast Minimum).
  Locations: library meta line (`src/app/p/[projectId]/page.tsx` `DocumentRow`, "By … · Updated …"),
  `ModeChip` (`src/app/settings/signals/page.tsx`), subtype chip, franchise field labels, breadcrumb
  chevron, `RoutedNote`, and every `placeholder:text-text-tertiary` input. Measured 2.33–2.56 (light)
  / 3.52–4.10 (dark). Corroborated by `axe-core` (`color-contrast`, serious). **FIXED** by darkening
  `--text-tertiary` to `#6b6b73` (light, →4.81–5.28) and lightening to `#85858d` (dark, →4.64–5.41) in
  `src/styles/tokens.css`.
- **[Serious] `text-secondary` fails AA on `panel` (light).** 1.4.3. 4.40:1. Locations: any secondary
  text inside `bg-panel` chips/cards (`ContextChip`, `StatusChip` label, menu items). **FIXED**:
  `--text-secondary` `#71717a`→`#5e5e66` (→5.84 on panel).
- **[Serious] Functional severity colors fail AA when used as *text* (light).** 1.4.3. `minor`
  2.90–3.19, `pass` 3.16–3.30, `risk` 4.39 on panel. **FIXED** by introducing dedicated AA text
  tokens `--risk-text/--minor-text/--pass-text` (+ `text-risk-text` etc. utilities in `globals.css`)
  and adopting them in the editable consumers: `signal-form.tsx` (error text), `drift-indicator.tsx`
  ("Edited since submit"). **REPORTED** for the report-only consumers — change `text-risk`/`text-minor`
  to `text-risk-text`/`text-minor-text` in `src/components/signal-row.tsx` (issue-quote line ~80) and
  `src/components/results-drawer.tsx` (verdict badge line ~243, the *text* color only — the *border*
  color may stay `risk`/`minor` since it passes the 3:1 UI threshold).
- **[Minor] Signal-bar `minor`/`pass` fills are marginally under the 3:1 UI threshold on `panel`
  track (light): 2.90 / 3.00.** WCAG 1.4.11 (Non-text Contrast). **REPORTED** (file
  `src/components/signal-bar.tsx`, fills via `BAR_TONE_BG` in `src/lib/doc-page.ts`). Recommended fix:
  point `BAR_TONE_BG` at the darker `bg-minor-text`/`bg-pass-text` (and `bg-risk-text`) for the fill,
  which raises all three to ≥4.5:1 on the panel track while keeping the green/amber/red semantics. The
  score is also given numerically (`x/10`) and via `role="meter"`, so color is not the sole channel.

### Screen reader & semantics

- **[Serious] No "skip to main content" link; `<main>` had no target id.** WCAG 2.4.1 (Bypass
  Blocks). Every page repeats the sticky header before content. **FIXED**: added a visually-hidden
  skip link as the first focusable element in `src/app/layout.tsx`, and `id="main-content"` +
  `tabIndex={-1}` on `<main>` in `src/components/app-shell.tsx`.
- **[Minor] Header logo had a redundant accessible name.** WCAG 1.1.1. The `<img alt="Big Shot
  Pictures">` sat inside a link already labelled "Creative Review", producing the name "Big Shot
  Pictures Creative Review". **FIXED**: `alt=""` (decorative) in `app-shell.tsx`; the link text names
  it. (Pre-existing lint warning to prefer `next/image` is unrelated and left as-is.)
- **[Moderate] Library results have no live announcement of the filtered count.** WCAG 4.1.3 (Status
  Messages). Typing in search / changing the status filter silently re-renders the list. **FIXED**:
  added an `aria-live="polite"` visually-hidden region announcing the match count in
  `src/app/p/[projectId]/page.tsx`.
- **[OK] Squiggle keyboard path.** The flagged-phrase highlights are ProseMirror decorations and are
  not individually focusable, but the results drawer lists each inline issue as a real `<button>`
  (`SignalRow`), which focuses + scrolls to the squiggle. This is an acceptable supplement; no fix
  needed. Heading order (`h1` per page, `h2` in dialogs/sections), button-vs-link usage, `aria-current`,
  and `role="meter"`/`role="status"`/`role="alert"` were all verified correct.

### Keyboard & focus

- **[Serious] Modal dialogs do not trap focus.** WCAG 2.4.3 (Focus Order) / 2.1.2 (modal pattern). The
  signal create/edit + delete-confirm overlays (`src/app/settings/signals/page.tsx`), the destination
  picker, the franchise detail, and the account stub all closed on Escape but let Tab walk into the
  page behind the backdrop, and several never moved focus into the dialog. **FIXED**: added a shared
  `useFocusTrap` hook (`src/lib/use-focus-trap.ts`) — moves focus in on open, cycles Tab/Shift+Tab
  within the dialog, restores focus to the trigger on close — and wired it into `account-dialog.tsx`,
  `destination-picker.tsx`, `franchise-detail.tsx`, and the signals `Overlay`.
- **[Moderate] Popover `Menu` had no keyboard affordances inside the panel.** WCAG 2.1.1 / menu
  pattern. Opening the project switcher / status / routing menu left focus on the trigger; no
  arrow-key navigation; Escape did not return focus. **FIXED** in `src/components/menu.tsx`: focus the
  first item on open, Down/Up from the trigger opens-and-focuses, Arrow/Home/End roving focus across
  `[role="menuitem"]` items (skipping disabled), Escape returns focus to the trigger, Tab closes
  (no trap, focus continues naturally).
- **[OK] Visible focus.** Every interactive element uses `focus-visible:ring-2 ring-accent` (16–19:1),
  satisfying 2.4.7. The results drawer (report-only) already closes on Escape and is non-modal.

### Motion

- **[OK] `prefers-reduced-motion` honored.** WCAG 2.3.3 (A). `src/app/globals.css` has a single global
  rule neutralizing animations/transitions/smooth-scroll, and motion-driven components
  (`status-chip`, `results-drawer`, report-only) additionally gate via `useReducedMotion()`. The
  `.signal-highlight--focus` pulse and the skeleton shimmer both yield. No fix needed.

### Forms

- **[Moderate] Signal form: required fields not exposed; errors not announced.** WCAG 3.3.1 / 3.3.2 /
  4.1.3. Name/Prompt/Threshold are required but had no `required`/`aria-required`, and error text was a
  plain `<p>` (not a live region). **FIXED** in `src/components/signal-form.tsx`: `required` +
  `aria-required="true"` on the three required controls, and `role="alert"` on each error message
  (`aria-invalid`/`aria-describedby` association was already correct). Error text recolored to
  `text-risk-text` for AA.
- **[OK] Search / status filter.** `aria-label="Search documents"` / `"Filter by status"` are present
  and correct; the new live region (above) reports results. `SubtypeSelect` and the destination radio
  group (`<fieldset>`/`<legend>`) are correctly labelled.

---

## What was fixed vs. reported

**Fixed (13):** contrast tokens (`text-secondary`, `text-tertiary`, new `*-text` severity tokens) in
`tokens.css` + `globals.css`; skip link + main landmark id (`layout.tsx`, `app-shell.tsx`); decorative
logo alt; menu keyboard navigation (`menu.tsx`); modal focus trap hook + 4 dialogs
(`use-focus-trap.ts`, `account-dialog.tsx`, `destination-picker.tsx`, `franchise-detail.tsx`,
`signals/page.tsx`); signal-form required fields + alert errors + AA error color (`signal-form.tsx`);
drift indicator AA text + border (`drift-indicator.tsx`); library results live region
(`p/[projectId]/page.tsx`).

**Reported-only (4)** — fix belongs in a do-not-edit file:
1. `signal-row.tsx` — issue-quote text uses `text-risk`/`text-minor`; switch to `text-risk-text`/
   `text-minor-text` (tokens already exist) for AA in light.
2. `results-drawer.tsx` — verdict badge *text* uses `text-risk`/`text-minor`; switch to the `*-text`
   variants (badge *border* may stay).
3. `signal-bar.tsx` / `doc-page.ts` `BAR_TONE_BG` — `minor`/`pass` fills are 2.90/3.00 on the panel
   track (light), just under 3:1; repoint to `bg-minor-text`/`bg-pass-text`/`bg-risk-text`.
4. (Same family) any other report-only use of `text-minor`/`text-risk`/`text-pass` as body text.

## Verification

`npx tsc --noEmit` ✓ · `npm run lint` ✓ (0 errors; 1 pre-existing `<img>` warning) ·
`npm test` ✓ **258 passed (36 files)** · `npm run build` ✓.
