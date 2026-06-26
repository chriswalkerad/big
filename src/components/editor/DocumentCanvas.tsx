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
 * - `setInterim(text)`: insert OR replace the tracked provisional range at the caret
 *   with `text`, carrying the `DictationInterim` mark (the ghost). The next call deletes
 *   the prior interim and inserts the new one in place, so there is only ever ONE
 *   interim span. `setInterim('')` clears the visible interim (and tracking). If no
 *   interim is active, the new one is anchored at the current selection.
 * - `commitInterim()`: strip the `DictationInterim` mark across the tracked range so the
 *   provisional text becomes normal authored text, clear tracking, and fire `onUpdate`
 *   (the parent's `onChange`/body syncs). No-op if no interim is active.
 * - `clearInterim()`: delete the tracked provisional range entirely (discard an
 *   uncommitted interim) and clear tracking. No-op if no interim is active.
 */
export interface DocumentCanvasHandle {
  setSignalHighlights: (issues: readonly SignalHighlightIssue[]) => void
  setContent: (html: string) => void
  insertText: (text: string) => void
  setInterim: (text: string) => void
  commitInterim: () => void
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
    onUpdate: ({ editor: instance }) => {
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
        } else {
          const node = state.schema.text(text, [mark])
          if (to > from) {
            tr.replaceWith(from, to, node)
          } else {
            tr.insert(from, node)
          }
          interimRangeRef.current = { from, to: from + text.length }
        }
        // `addToHistory: false` keeps the in-flight refinement churn out of undo —
        // only the committed text should be an undoable author edit.
        tr.setMeta('addToHistory', false)
        editor.view.dispatch(tr)
      },
      commitInterim: () => {
        if (!editor) return
        const tracked = interimRangeRef.current
        if (!tracked) return
        const { state } = editor.view
        const markType = state.schema.marks[DICTATION_INTERIM_MARK_NAME]
        if (!markType) {
          interimRangeRef.current = null
          return
        }
        const range = clampInterimRange(tracked, state.doc.content.size)
        interimRangeRef.current = null
        if (!range || range.to <= range.from) return
        // Strip the ghost mark: the text stays, now as normal authored text. This IS a
        // genuine author edit, so it belongs in history and must fire `onUpdate` so the
        // parent's `onChange`/body syncs.
        const tr = state.tr.removeMark(range.from, range.to, markType)
        editor.view.dispatch(tr)
        onChange?.(editor.getHTML())
      },
      clearInterim: () => {
        if (!editor) return
        const tracked = interimRangeRef.current
        interimRangeRef.current = null
        if (!tracked) return
        const { state } = editor.view
        const range = clampInterimRange(tracked, state.doc.content.size)
        if (!range || range.to <= range.from) return
        // Discard the uncommitted ghost entirely; keep it out of undo history.
        const tr = state.tr.delete(range.from, range.to)
        tr.setMeta('addToHistory', false)
        editor.view.dispatch(tr)
      },
    }),
    [editor, onChange],
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
