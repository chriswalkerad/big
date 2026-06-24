# Tiptap Editor Build Spec: Creative Review Workspace

## YOUR JOB
You are building the `DocumentCanvas` rich-text editor and its `SignalHighlight` extension for a Next.js creative-review app. Read this entire document, then build everything described. Do not ask clarifying questions. Do not add features beyond what is described. **Follow the Git Conventions doc (`bsp-git-conventions.md`) for every commit — commit frequently, use Conventional Commits format (scope: `editor`), and work on a feature branch (`feat/tiptap-editor`).** When you are done, the editor renders in both edit and read modes, highlights anchor to real substrings, all tests pass, `npm run build` succeeds, and `npm run lint` is clean.

> **Note on provenance:** the original "Tiptap editor prompt" was authored in conversation and never saved to a file. This document reconstructs it. The authoritative task list is **EPIC 7 in `bsp-linear-tickets.md`**; the authoritative component contract (packages + `DocumentCanvas` props) is the **"Depends on" section of `bsp-frontend-build-spec.md`**. Where this file adds detail, it governs the Tiptap implementation specifically.

**Deliverables checklist (verify before finishing):**
- [ ] `src/components/editor/SignalHighlight.ts` — ProseMirror decoration plugin + `setSignalHighlights` command, with the required comment header
- [ ] `src/components/editor/DocumentCanvas.tsx` — `"use client"`, `mode: "edit" | "read"`, composed extensions (no StarterKit)
- [ ] Placeholder text "Start your brief…"
- [ ] `onHighlightClick(signalId)` wired via `handleDOMEvents`
- [ ] `setSignalHighlights(issues)` exposed (ref or callback prop)
- [ ] Tests (see Tests section)
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Depends on (import, do not redefine)
- Shared types (`SignalIssue`, `Severity`, etc.) from the backend spec.
- Packages (install exactly these; per the frontend spec's Depends-On):
  `@tiptap/react`, `@tiptap/core`, `@tiptap/extension-document`, `@tiptap/extension-paragraph`, `@tiptap/extension-text`, `@tiptap/extensions` (UndoRedo + Placeholder), `@tiptap/pm` (ProseMirror primitives).
- `DocumentCanvas` props (the contract the frontend consumes):
  `mode: "edit" | "read"`, `onHighlightClick(signalId: string)`, `setSignalHighlights(issues)`.

## Implementation rules (non-negotiable)
1. **Do NOT use StarterKit.** Compose exactly: `Document`, `Paragraph`, `Text`, `UndoRedo`, `Placeholder`, and the custom `SignalHighlight` extension. Import `UndoRedo` and `Placeholder` from `@tiptap/extensions`, **not** individual packages.
2. **Import ALL ProseMirror primitives from `@tiptap/pm/state` and `@tiptap/pm/view`** — never from `prosemirror-state` or `prosemirror-view` directly.
3. **Set `immediatelyRender: false`** in `useEditor` to prevent Next.js SSR hydration mismatch.
4. **`SignalHighlight` renders as ProseMirror `Decoration`s, NOT stored marks.** Transient overlay only — no schema pollution.
5. **Clicking a decoration fires `onHighlightClick` via `handleDOMEvents`**, not a React `onClick`. Read `data-signal-id` off the target.
6. **On `tr.docChanged`, clear decorations to `DecorationSet.empty`.** Do NOT map or track positions across edits. (Editing clears highlights until the next review — matches the submit-flow spec.)
7. **Quote matching:** scan text nodes using `from = nodePos + text.indexOf(quote)`. Do NOT build a cross-node search. Single-node match only.
8. **Multi-match → first occurrence. Quote not found → skip silently** (no crash).
9. **Decoration attributes:** add CSS class `signal-highlight`, plus `data-signal-id`, `data-severity`, and a `title` attribute carrying the issue `message` (native hover tooltip).
10. The component file is **`"use client"`** — Tiptap is client-only.

## Required comment header on `SignalHighlight.ts`
Explain the two key decisions:
- **Decorations, not marks** — highlights are a transient overlay tied to the latest review; they must not pollute the document schema or persist in `body`.
- **Quote-match, not offsets** — LLMs quote phrases reliably, but character offsets drift; counting characters is where the bugs live. So we locate the quote by string match at render time.

## Styling
- `.signal-highlight` is a wavy underline (per the design tokens spec's Highlights section). Color by `data-severity`: `risk` = red, `minor` = amber. Tokens only — no hard-coded hex.

## Tests (per EPIC 7 sub-tasks 17–19)
- Decoration is cleared on doc edit (`docChanged` → `DecorationSet.empty`).
- Decorations are rebuilt on `setSignalHighlights`.
- Multi-match takes the first occurrence.
- Unknown/not-found quote skips silently, no crash.
- Plus ESLint + strict `tsc`.

## Out of scope (do not build)
- Rich-text formatting (bold/italic/headings), marks of any kind, cross-node quote search, position mapping across edits, collaborative editing, or any StarterKit extension.
