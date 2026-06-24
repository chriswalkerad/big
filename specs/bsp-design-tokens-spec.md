# Design Tokens Spec: Creative Review Workspace

## YOUR JOB
You are setting up the visual foundation for a Next.js app. Read this entire document, then implement everything described as CSS variables and shadcn/Tailwind config. Do not invent additional tokens. Do not add colors beyond what is listed. **Follow the Git Conventions doc (`bsp-git-conventions.md`) for every commit.** When you are done, every token in this spec exists as a CSS variable, light and dark mode both work, and no component in the codebase has a hard-coded hex value.

**Deliverables checklist (verify before finishing):**
- [ ] `src/styles/tokens.css` — all CSS variables, light and dark
- [ ] `tailwind.config.ts` — extended with token references
- [ ] `src/components/theme-provider.tsx` — `next-themes` setup
- [ ] Theme toggle component (reusable, used in the app shell)
- [ ] `npm run build` passes with no hard-coded hex values in components

---

Visual foundation. Super minimal, Linear/Jasper/Notion restraint. Neutral black/white/gray only; the *sole* color in the product is functional: the highlight squiggle (risk/minor) and the fill bar (pass/near/fail). Light and dark. All values are CSS-variable tokens; components reference tokens, never hard-coded hex.

## Font
- **Inter**, fallback `-apple-system, "SF Pro Display", system-ui, "Segoe UI", Roboto, sans-serif`.
- Tabular figures for signal scores and numbers.

## Type scale (compact, 4px baseline grid)
UI (13px base):
- `label-xs` 11px / 16 / 500 (uppercase labels +0.05em tracking)
- `label-sm` 12px / 16 / 500
- `body` 13px / 20 / 400
- `body-emphasis` 14px / 20 / 500
- `title` 16px / 24 / 600
- `heading` 20px / 28 / 600 (-0.01em)
- `display` 28px / 36 / 600 (-0.01em) — empty states only

Document content:
- `doc-body` 15px / 24 / 400, max measure ~70ch
- `doc-title` 24px / 32 / 600 (-0.01em)

Weights: **400 / 500 / 600 only.** No bold.

## Color — neutral, light + dark
Grayscale ramp (zinc-like). The accent is *not* chromatic; interactive emphasis is near-black (light) / near-white (dark), with gray steps for hover/active.

Light:
- bg `#FFFFFF`, surface `#FAFAFA`, panel `#F4F4F5`, border `#E4E4E7`
- text-primary `#18181B`, text-secondary `#71717A`, text-tertiary `#A1A1AA`
- accent/interactive `#18181B`

Dark:
- bg `#0A0A0A`, surface `#141414`, panel `#1C1C1F`, border `#262626`
- text-primary `#FAFAFA`, text-secondary `#A1A1AA`, text-tertiary `#71717A`
- accent/interactive `#FAFAFA`

The **only** chromatic colors, used *only* in highlights and signal bars, nowhere else:
- `risk` red — `#DC2626` light / `#F87171` dark (Brand Safety squiggle, "fail" bar segment)
- `minor` amber — `#D97706` / `#FBBF24` (Clarity/Hook squiggle, "near" bar segment)
- `pass` green — `#16A34A` / `#4ADE80` ("pass" bar segments)

## Spacing (4px grid)
`4, 8, 12, 16, 24, 32, 48`. Compact paddings (list rows ~8-12px vertical).

## Radius
`6px` controls, `8px` cards/drawer, pill for chips.

## Highlights (squiggle)
- Wavy underline under the flagged phrase (`text-decoration: wavy` or an SVG underline). No background fill, to keep the document calm.
- Color = severity: risk = red, minor = amber.
- Hover shows the message (native `title`). Click focuses the matching drawer row.

## Signal bar (score + fill bar)
- A score displayed as `x/10` beside a single horizontal fill bar.
- Bar fills proportionally to the score (e.g. 7/10 = 70% filled).
- Fill color by threshold: score at or above threshold → green; 1-2 below → amber; 3+ below → red. Unfilled portion is border/surface gray.
- Simple, readable, no segment math needed.

## Theming
- Tokens as CSS variables, shadcn-compatible. Light/dark via `next-themes` (or equivalent), persisted.
