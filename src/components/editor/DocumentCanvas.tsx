'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Document } from '@tiptap/extension-document'
import { Paragraph } from '@tiptap/extension-paragraph'
import { Text } from '@tiptap/extension-text'
import { UndoRedo, Placeholder } from '@tiptap/extensions'
import type { EditorView } from '@tiptap/pm/view'
import { cn } from '@/lib/utils'
import { SignalHighlight, type SignalHighlightIssue } from './SignalHighlight'
import { DictationInterim, DICTATION_INTERIM_MARK_NAME } from './DictationInterim'
import './editor.css'

export type DocumentCanvasMode = 'edit' | 'read'

/**
 * Imperative handle a parent uses to drive the transient review overlay and to
 * replace the document body programmatically.
 *
 * - `setSignalHighlights` rebuilds the decoration set; passing `[]` clears it.
 * - `setContent` REPLACES the whole document with new HTML (e.g. an "Apply AI
 *   edit"). It emits Tiptap's update event, so the parent's `onChange` fires with
 *   the new serialized HTML and the parent's body state stays in sync. Replacing
 *   the document also clears the signal-highlight overlay (any doc change does).
 * - `insertText` inserts plain text at the current cursor/selection (e.g. a
 *   voice-dictation transcript). It is a GENUINE author edit: it goes through the
 *   normal command pipeline, fires `onUpdate` → the parent's `onChange` syncs body.
 *
 * Streaming dictation (interim → final) is driven by the trio below. Streaming feeds
 * INTERIM hypotheses (updating several times a second) and a FINAL string per
 * utterance. The interim shows as ghosted provisional text at the caret that REPLACES
 * itself in place as it refines (`setInterim`), then either commits to normal authored
 * text (`commitInterim`) or is discarded (`clearInterim`). The provisional range is
 * tracked internally; positions are re-validated against the live doc on every call so
 * a stale range can never corrupt the document.
 *
 * Interim churn is PROVISIONAL, not authored content: `setInterim`/`clearInterim`
 * transactions are tagged `interimMeta` and the editor's `onUpdate` SKIPS `onChange`
 * for them. So merely starting to talk does NOT look like a genuine edit and cannot
 * wipe a pending review preview. Only a COMMIT (the text is now real authored content)
 * fires `onChange` — exactly once — so an open review survives streaming and re-syncs
 * once when the utterance settles.
 *
 * - `setInterim(text)`: insert OR replace the tracked provisional range at the caret
 *   with `text`, carrying the `DictationInterim` mark (the ghost). The next call deletes
 *   the prior interim and inserts the new one in place, so there is only ever ONE
 *   interim span. `setInterim('')` clears the visible interim (and tracking). If no
 *   interim is active, the new one is anchored at the current selection. Does NOT fire
 *   `onChange` (provisional). Stays out of undo history.
 * - `commitInterim(finalText?)`: settle the in-flight utterance into normal authored
 *   text as a SINGLE undoable history step, then fire `onChange` once.
 *   - When `finalText` is given it REPLACES the tracked interim range (or, if the range
 *     went stale, the remembered interim anchor) with `finalText` — so the committed
 *     text always lands where the ghost was shown, never at a moved live caret. Spacing
 *     is normalized here: `finalText` is trimmed and a single separating space is added
 *     only when the preceding char is not whitespace and not the document start.
 *   - When `finalText` is omitted it strips the ghost mark in place, leaving whatever
 *     interim text was last shown as authored text.
 *   No-op if no interim is active.
 * - `clearInterim()`: delete the tracked provisional range entirely (discard an
 *   uncommitted interim) and clear tracking. No-op if no interim is active. Does NOT
 *   fire `onChange`; stays out of undo history.
 */
export interface DocumentCanvasHandle {
  setSignalHighlights: (issues: readonly SignalHighlightIssue[]) => void
  setContent: (html: string) => void
  insertText: (text: string) => void
  setInterim: (text: string) => void
  /**
   * Commit the in-flight dictation utterance to authored text. Pass the settled
   * `finalText` to replace the tracked interim (at its anchor, not the live caret) with
   * spacing normalization; omit it to simply un-ghost the last interim in place.
   */
  commitInterim: (finalText?: string) => void
  clearInterim: () => void
}

export interface DocumentCanvasProps {
  /** `edit` → editable author view; `read` → read-only reviewer view. */
  mode: DocumentCanvasMode
  /**
   * Optional hard override of editability, independent of `mode`. Used to LOCK the
   * editor while an AI rewrite is in flight (the "Rewriting…" overlay): pass `false`
   * to make the surface non-editable even in edit mode. When omitted, editability
   * follows `mode` (`edit` → editable).
   */
  editable?: boolean
  /** Fired when a highlighted phrase is clicked; receives the `data-signal-id`. */
  onHighlightClick?: (signalId: string) => void
  /** Initial / controlled body. `content` and `value` are aliases. */
  content?: string
  /** Alias for `content`. */
  value?: string
  /** Called with the serialized HTML body whenever the document changes. */
  onChange?: (html: string) => void
  /** Optional extra class names for the editor container. */
  className?: string
}

const PLACEHOLDER_TEXT = 'Start your brief…'

/**
 * Transaction meta flag marking a PROVISIONAL interim transaction (`setInterim` /
 * `clearInterim`). The editor's `onUpdate` reads it and SKIPS `onChange` for these:
 * ghost text is not authored content, so it must never look like a genuine edit (which
 * would wipe a pending review preview the instant the user starts talking). Only a
 * COMMIT — the text is now real — emits `onChange`.
 */
const INTERIM_TX_META = 'dictationInterim'

/**
 * True when no separating space is needed before the commit point: either the doc/block
 * start (`textBetween` across a block boundary yields `''`) or the preceding char is
 * already whitespace. Empty string means a boundary, so it counts as "start".
 */
function isWhitespaceOrStart(char: string | undefined): boolean {
  return char === undefined || char === '' || /\s/.test(char)
}

/**
 * Re-validate a tracked interim range against the current document size.
 *
 * The interim range is held in a ref across renders and dictation ticks; an unrelated
 * edit (or content replacement) can shrink the doc out from under it. Before EVERY use
 * we clamp `from`/`to` into `[0, docSize]`; if the range collapses or inverts after
 * clamping it is treated as gone (`null`). This guarantees the insert/replace/remove/
 * delete transactions can never address out-of-bounds positions and corrupt the doc.
 */
function clampInterimRange(
  range: { from: number; to: number } | null,
  docSize: number,
): { from: number; to: number } | null {
  if (!range) return null
  const from = Math.max(0, Math.min(range.from, docSize))
  const to = Math.max(0, Math.min(range.to, docSize))
  if (to < from) return null
  return { from, to }
}

function DocumentCanvasInner(
  props: DocumentCanvasProps,
  ref: Ref<DocumentCanvasHandle>,
): React.ReactElement {
  const { mode, editable, onHighlightClick, content, value, onChange, className } = props
  const initialContent = content ?? value ?? ''
  // Effective editability: an explicit `editable` override wins; otherwise follow mode.
  const isEditable = editable ?? mode === 'edit'

  // The live provisional-dictation range, or `null` when no interim is active.
  // `from`/`to` are document positions bounding the currently shown ghost text; the
  // next `setInterim` replaces exactly this span. Positions are re-validated against
  // the live doc on every use (see `currentInterimRange`) so a stale range — e.g. after
  // an unrelated edit shrank the doc — can never address out-of-bounds and corrupt it.
  const interimRangeRef = useRef<{ from: number; to: number } | null>(null)

  // The remembered START position of the active interim, captured when the first
  // `setInterim` of an utterance anchors. If the tracked range goes stale (e.g. the user
  // clicked away and an unrelated edit shifted the doc), `commitInterim(finalText)` falls
  // back to this anchor so the committed text still lands where the ghost was shown — not
  // at the live caret. Cleared whenever interim tracking ends.
  const interimAnchorRef = useRef<number | null>(null)

  // Read `data-signal-id` off the clicked element via handleDOMEvents (NOT a React
  // onClick) so clicks land on the ProseMirror decoration DOM, per spec rule 5.
  const handleHighlightMouseDown = useCallback(
    (_view: EditorView, event: MouseEvent): boolean => {
      if (!onHighlightClick) return false
      const target = event.target
      if (!(target instanceof globalThis.Element)) return false
      const hit = target.closest('[data-signal-id]')
      const signalId = hit?.getAttribute('data-signal-id')
      if (!signalId) return false
      onHighlightClick(signalId)
      return false
    },
    [onHighlightClick],
  )

  const editor = useEditor({
    // No StarterKit — compose exactly the extensions the spec allows (rule 1).
    extensions: [
      Document,
      Paragraph,
      Text,
      UndoRedo,
      Placeholder.configure({ placeholder: PLACEHOLDER_TEXT }),
      SignalHighlight,
      DictationInterim,
    ],
    content: initialContent,
    editable: isEditable,
    // Edit mode: place the caret at the top of the sheet on load so the author can
    // start typing immediately without clicking in. Read mode never grabs focus.
    autofocus: mode === 'edit' ? 'start' : false,
    // Prevent Next.js SSR hydration mismatch (rule 3).
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'document-canvas-prose',
      },
      handleDOMEvents: {
        mousedown: handleHighlightMouseDown,
      },
    },
    onUpdate: ({ editor: instance, transaction }) => {
      // PROVISIONAL interim transactions (`setInterim`/`clearInterim`) carry the ghost
      // text only and are NOT authored content. Skip `onChange` for them so streaming a
      // hypothesis never looks like a genuine edit (which would discard an open review
      // preview). The COMMIT path fires `onChange` itself, once.
      if (transaction.getMeta(INTERIM_TX_META)) return
      onChange?.(instance.getHTML())
    },
  })

  // Keep `editable` in sync if the parent flips mode or the override without remounting
  // (e.g. locking the editor while an AI rewrite runs).
  useEffect(() => {
    editor?.setEditable(isEditable)
  }, [editor, isEditable])

  useImperativeHandle(
    ref,
    (): DocumentCanvasHandle => ({
      setSignalHighlights: (issues) => {
        editor?.commands.setSignalHighlights(issues)
      },
      setContent: (html) => {
        // Replace the whole document. `emitUpdate: true` (Tiptap's default, set
        // explicitly here as a contract) makes ProseMirror NOT mark the
        // transaction `preventUpdate`, so `onUpdate` fires and the parent's
        // `onChange` receives the new serialized HTML — keeping body state in sync.
        editor?.commands.setContent(html, { emitUpdate: true })
      },
      insertText: (text) => {
        // A genuine author edit at the caret/selection. `insertContent` runs through
        // the normal command pipeline (no `programmaticContentRef` bypass), so
        // `onUpdate` fires and the parent's `onChange` syncs the plain-text body.
        editor?.commands.insertContent(text)
      },
      setInterim: (text) => {
        if (!editor) return
        const { state } = editor.view
        const { doc, tr } = state
        const markType = state.schema.marks[DICTATION_INTERIM_MARK_NAME]
        if (!markType) return

        // Re-validate any tracked range against the LIVE doc. If it no longer fits
        // (stale after an unrelated edit), drop tracking and re-anchor at the caret —
        // never address out-of-bounds.
        const tracked = clampInterimRange(interimRangeRef.current, doc.content.size)

        // Where the new interim goes: replace the tracked span if we have one, else
        // anchor at the current selection (collapsing any selection to its head).
        const from = tracked ? tracked.from : state.selection.from
        const to = tracked ? tracked.to : state.selection.from

        const mark = markType.create()
        if (text.length === 0) {
          // Empty interim → just remove the previously shown ghost (if any).
          if (tracked) tr.delete(tracked.from, tracked.to)
          interimRangeRef.current = null
          interimAnchorRef.current = null
        } else {
          const node = state.schema.text(text, [mark])
          if (to > from) {
            tr.replaceWith(from, to, node)
          } else {
            tr.insert(from, node)
          }
          interimRangeRef.current = { from, to: from + text.length }
          // Remember where this utterance's ghost begins so a later commit can land the
          // final text here even if the tracked range went stale (caret moved away).
          interimAnchorRef.current = from
        }
        // `addToHistory: false` keeps the in-flight refinement churn out of undo —
        // only the committed text should be an undoable author edit. `INTERIM_TX_META`
        // tells `onUpdate` to skip `onChange`: provisional text is not an edit.
        tr.setMeta('addToHistory', false)
        tr.setMeta(INTERIM_TX_META, true)
        editor.view.dispatch(tr)
      },
      commitInterim: (finalText) => {
        if (!editor) return
        const tracked = interimRangeRef.current
        const anchor = interimAnchorRef.current
        // No-op when no interim is active (nothing tracked and no anchor remembered).
        if (!tracked && anchor === null) return
        const { state } = editor.view
        const markType = state.schema.marks[DICTATION_INTERIM_MARK_NAME]
        // Tracking ends here regardless of which branch runs below.
        interimRangeRef.current = null
        interimAnchorRef.current = null
        if (!markType) return

        const docSize = state.doc.content.size
        const range = clampInterimRange(tracked, docSize)

        if (finalText === undefined) {
          // No settled text supplied: just un-ghost the interim in place. This is a
          // genuine author edit (undoable, fires onChange).
          if (!range || range.to <= range.from) return
          // Not tagged interim → `onUpdate` fires `onChange` once for this commit.
          const tr = state.tr.removeMark(range.from, range.to, markType)
          editor.view.dispatch(tr)
          return
        }

        // Replace the provisional range with the SETTLED text. Anchor at the tracked
        // ghost range if still valid, else fall back to the remembered start anchor so
        // the text lands where the ghost was shown — never at a moved live caret.
        const fallback = anchor === null ? null : Math.max(0, Math.min(anchor, docSize))
        const from = range ? range.from : fallback
        const to = range ? range.to : fallback
        if (from === null || to === null) return

        // Inter-utterance spacing: trim the settled text, then prefix a single space
        // only when the preceding char is not already whitespace and not the doc start.
        const trimmed = finalText.trim()
        const prevChar = from > 0 ? state.doc.textBetween(from - 1, from) : undefined
        const insertText = isWhitespaceOrStart(prevChar) ? trimmed : ` ${trimmed}`

        // A SINGLE undoable step (default addToHistory) and NOT tagged interim, so it
        // fires onChange exactly once via onUpdate. Insert as plain text (no ghost mark).
        const tr = state.tr
        const node = insertText.length > 0 ? state.schema.text(insertText) : null
        if (to > from) {
          if (node) tr.replaceWith(from, to, node)
          else tr.delete(from, to)
        } else if (node) {
          tr.insert(from, node)
        }
        // Ensure no ghost mark survives across the touched span.
        const end = from + insertText.length
        if (end > from) tr.removeMark(from, end, markType)
        // Not tagged interim → `onUpdate` fires `onChange` once for this commit.
        editor.view.dispatch(tr)
      },
      clearInterim: () => {
        if (!editor) return
        const tracked = interimRangeRef.current
        interimRangeRef.current = null
        interimAnchorRef.current = null
        if (!tracked) return
        const { state } = editor.view
        const range = clampInterimRange(tracked, state.doc.content.size)
        if (!range || range.to <= range.from) return
        // Discard the uncommitted ghost entirely; keep it out of undo history and out of
        // onChange (provisional text was never a genuine edit).
        const tr = state.tr.delete(range.from, range.to)
        tr.setMeta('addToHistory', false)
        tr.setMeta(INTERIM_TX_META, true)
        editor.view.dispatch(tr)
      },
    }),
    // `onChange` is fired by the editor's `onUpdate` (commits dispatch ordinary,
    // non-interim transactions), not by the handle directly — so it is not a dep here.
    [editor],
  )

  return (
    <EditorContent
      editor={editor}
      className={cn('document-canvas', className)}
    />
  )
}

export const DocumentCanvas = forwardRef<DocumentCanvasHandle, DocumentCanvasProps>(
  DocumentCanvasInner,
)
DocumentCanvas.displayName = 'DocumentCanvas'

export default DocumentCanvas
