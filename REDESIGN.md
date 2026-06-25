# 🎬 The World's Greatest Creative Review App — Redesign Tracker

> Living source of truth for the app-wide minimal/Notion redesign. Update the **status
> markers** and **Progress log** as work lands. Goal: it should be impossible for us to
> ship anything less than the best version of this app.

Status legend: ⬜ not started · 🔄 in progress · ✅ done · ⏭️ superseded

---

## ⭐ North star (the desired outcome)
A calm, confident, **all-white, Notion-clean** creative-review tool. The writing is the hero;
the AI review is present but never noisy. No heavy chrome — one slim action line, generous
whitespace, quiet type, hairline borders. Every interaction feels smooth and intentional;
nothing competes for attention. It should feel like a premium, modern document app that a
studio exec would be delighted to use.

## 🎨 Design principles
1. **All-white, borderless pages** — one continuous page (no gray desk, no page-break sheets).
2. **No app header** — a single slim ~46px action line per page: brand + breadcrumb (left),
   page actions + `⋯` (Settings, theme) (right).
3. **Review is opt-in detail** — minimal by default (verdict chip + one-line strip); the full
   right panel slides in on demand and **auto-opens on Run review**.
4. **Compact, quiet controls** — small buttons (the HTML-mockup scale: ~12.5px text, tight
   padding, 7px radius, hairline border, charcoal/ink primary, brand-yellow used sparingly).
5. **Motion is smoothing, not showmanship** — opacity-first, 120–280ms, gentle ease, zero
   bounce; fully off under `prefers-reduced-motion`.
6. **Calm severity** — muted risk/minor/pass; tiny dots + thin score bars, never alarming.

## 🧭 Decisions (judgment calls — locked unless changed)
- ✅ Drop page-break sheets → one continuous white page.
- ✅ No header anywhere → slim `TopBar` (Settings + theme live in its `⋯`).
- ✅ Reskin the **whole app** (library, home, settings, doc page), not just the doc page.
- ✅ Run review **auto-opens** the detail panel; confirm there; collapses back to minimal.
- ✅ Buttons use the **small mockup scale** (user explicitly liked it).

---

## 📦 Wave 0 — Foundation ✅ DONE · `feat/redesign-foundation` @ 5ffa181 (merged → qa/redesign)
- ✅ Palette: `tokens.css` → white light (#fff) + Notion-dark (#191919) twin, **AA verified both themes**
- ✅ `TopBar` (`src/components/top-bar.tsx`): `<TopBar breadcrumb actions />`, ⋯ = Settings + ThemeToggle
- ✅ Stripped `app-shell` header → white frame + `<main>` only
- ✅ New `<Button variant="ink|default|ghost">` (`src/components/button.tsx`) — compact mockup scale
- ✅ Type scale reconciled to mockup (title 34/700, body 16/1.75, labels 11–12); 320 tests green

## 🪟 Wave 1 — Per-page reskins ✅ DONE (all merged → qa/redesign, 342 tests, build green)
- ✅ **A · Doc page:** `feat/redesign-docpage` @ 919280b — continuous white editor (desk + page
  sheets gone), title on page, `ReviewStrip` (minimal default), the `ResultsPanel` detail slides in
  (~270ms, auto-opens on Run review, bottom sheet on mobile), squiggle→opens+focuses; Apply overlay +
  Accept/Discard + GREENLIGHT celebration all preserved
- ✅ **B · Library + home:** `feat/redesign-library` @ 267fcb7 — hairline doc rows on white + `TopBar`
- ✅ **C · Settings + shared dialogs:** `feat/redesign-settings` @ e169571 — signal admin + dialogs minimal

## 🔁 Round 2 — post-QA feedback ✅ DONE (all merged → qa/redesign @ 2798e24, 350 tests, build green)
- ✅ **Inline panel (not modal):** in-flow side panel the editor reflows around — scrim gone, editor
  stays interactive. `feat/panel-inline`
- ✅ **Removed GREENLIGHT celebration** (files deleted). `feat/panel-inline`
- ✅ **Library TopBar flush** to viewport top. `feat/library-flush`
- ✅ **Typography → system-first font** (San Francisco on macOS) + 36px title, matching the mockup.
- ✅ **Owner/reviewer** — `Project.owner` + `Document.reviewer: Person`, real Big Shot creative roster
  (`src/lib/people.ts`), shown on doc + library rows, + **reviewer-picker step at submission**
  (`feat/people-model` + `feat/owner-reviewer-ui`)
- ✅ **Scores 0→100** — x/10 → 0–100 (a 5/10 = 50) across schema / providers / seed / thresholds /
  severity / display; verdict rules intact. `feat/score-100`
- 🔎 **Badge sizes** — verify the oversized "Needs attention" badge at QA (agents found verdict +
  scope badges already share classes; likely a different element).

## 🔭 Follow-ups (not blocking QA)
- ⬜ Playwright e2e (`submit.spec`, `drawer-dismiss.spec`) still target the OLD drawer/breadcrumb —
  rewrite for the new TopBar + slide-in panel (separate `test:e2e`, not in the tsc/lint/vitest gate).
- ⬜ Final AA + mobile sweep across all reskinned pages during QA.

## ✅ Definition of done (quality bars — non-negotiable)
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` all green
- [ ] WCAG **AA** contrast verified on the new palette, both themes (no regressions)
- [ ] Every animation reduced-motion-safe
- [ ] Token-only styling (hex only in `tokens.css`); no `any`
- [ ] Logic unchanged & working: Apply rewrite, accept/discard, review-then-confirm,
      celebration, storage/seed
- [ ] Tests updated (document-page / results-panel / library) + e2e specs match new structure
- [ ] Visual QA passed in-browser at desktop **and** mobile widths
- [ ] No PR until the owner has eyeballed it on `localhost:3000`

---

## 📓 Progress log
- **2026-06-25** — Direction approved from HTML mockups (minimal default + expandable right
  panel). Decisions locked. This tracker created.
- **2026-06-25** — Wave 0 foundation ✅ (tokens + TopBar + compact Button + mockup type, AA both
  themes, 320 tests). Merged into `qa/redesign` (901cb23) + pushed. Wave 1 launched: 3 parallel
  agents (doc page, library+home, settings+dialogs).

## ⏭️ Superseded by this redesign (logic carries over; chrome/layout replaced)
Gray "desk" + white paper, page-break sheets, the fixed-card right drawer, title-in-panel,
`bg-app-canvas` gray, the heavy app header. The **AI features and review flow are unchanged.**
