# Git Conventions: Creative Review Workspace

Every agent working on this codebase follows these conventions without exception. The commit history is a deliverable. Reviewers at Big Shot Pictures will read it. It should demonstrate engineering discipline, not just working code.

---

## Commit frequently

Commit after every meaningful unit of work. Do not batch unrelated changes into one commit. Do not wait until a feature is complete to commit. A good rule: if you can describe what you just did in one short sentence, commit it.

Examples of when to commit:
- After scaffolding a new file or component
- After adding a type or interface
- After wiring a new route
- After a test passes
- After fixing a bug
- After a refactor that leaves tests green

Never commit:
- Broken code (tests failing, build broken, lint errors)
- Unrelated changes bundled together
- Work-in-progress with a message like "wip" or "stuff" or "asdf"

---

## Commit message format (Conventional Commits)

Every commit message follows this format:

```
<type>(<scope>): <short description>

[optional body — one or two sentences if the why is not obvious]
```

**Types:**
- `feat` — a new feature or visible behavior
- `fix` — a bug fix
- `chore` — setup, config, deps, tooling (no production code change)
- `test` — adding or updating tests only
- `refactor` — restructuring code without changing behavior
- `style` — formatting, token cleanup, no logic change
- `docs` — README or documentation only

**Scope** is the area of the codebase affected. Use these consistently:
- `backend` — shared types, StorageRepository, API route, providers
- `editor` — Tiptap DocumentCanvas, SignalHighlight extension
- `tokens` — design tokens, CSS variables, theme config
- `seed` — seed data file
- `library` — document library screen
- `doc-page` — document editor / review page
- `drawer` — results drawer
- `signals` — signal admin screens
- `nav` — breadcrumb, app shell, theme toggle
- `tests` — cross-cutting test additions
- `deps` — dependency changes only

**Short description:** lowercase, no period, present tense, under 72 characters.

**Examples:**
```
feat(backend): add StorageRepository with get/save/list/remove
feat(backend): add POST /api/review endpoint with zod validation
feat(backend): implement MockProvider with deterministic PRNG
feat(editor): add SignalHighlight extension with decoration set
feat(editor): wire onHighlightClick via handleDOMEvents
feat(tokens): add CSS variable ramp for light and dark modes
feat(library): render filterable document list with status chips
feat(library): add full-text search over title and body
feat(doc-page): implement submit flow with snapshot and prefill
feat(doc-page): show version drift indicator with resubmit/unsubmit
feat(drawer): slide-up results drawer with verdict and signal rows
feat(signals): full CRUD admin for signal definitions
fix(editor): clear decorations on docChanged to prevent stale highlights
fix(backend): map AI 429 response to AI_RATE_LIMIT error code
test(backend): add zod schema tests for ReviewResult shape
test(backend): verify MockProvider quotes are real substrings of input
chore(deps): install @tiptap/react and related packages
chore: initialise Next.js project with TypeScript and Tailwind
docs: add README with setup, architecture, and tradeoffs
```

---

## Branch naming

Work on a feature branch. Never commit directly to `main`.

Format: `<type>/<short-description-in-kebab-case>`

Examples:
```
feat/backend-data-layer
feat/tiptap-editor
feat/design-tokens
feat/seed-data
feat/document-library
feat/doc-page-submit-flow
feat/results-drawer
feat/signal-admin
fix/highlight-anchor-edge-cases
chore/project-setup
```

---

## When to open a pull request

Open a PR from your feature branch to `main` when:
- All checklist items in your spec are done
- `npm run build` passes
- `npm run lint` passes
- `npm test` passes

PR title follows the same Conventional Commits format as commit messages.

PR description should include:
- What was built (one paragraph)
- Any tradeoffs or known limitations
- How to test it locally

Keep PRs focused. One spec = one PR. Do not mix backend and frontend changes in the same PR unless they are trivially coupled.

---

## What reviewers will see

The GitHub history for this project will be read by dkrish, AlexJBSP, and ogrodev before they look at the code. A clean, readable history of small, well-described commits signals that the engineer understands collaborative engineering practice. A single "initial commit" or a handful of vague messages signals the opposite.

Treat the commit history as part of the portfolio.
