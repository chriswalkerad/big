'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
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
import './editor.css'

export type DocumentCanvasMode = 'edit' | 'read'

/**
 * Imperative handle a parent uses to drive the transient review overlay.
 * Calling `setSignalHighlights` rebuilds the decoration set; passing `[]` clears it.
 */
export interface DocumentCanvasHandle {
  setSignalHighlights: (issues: readonly SignalHighlightIssue[]) => void
}

export interface DocumentCanvasProps {
  /** `edit` → editable author view; `read` → read-only reviewer view. */
  mode: DocumentCanvasMode
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

function DocumentCanvasInner(
  props: DocumentCanvasProps,
  ref: Ref<DocumentCanvasHandle>,
): React.ReactElement {
  const { mode, onHighlightClick, content, value, onChange, className } = props
  const initialContent = content ?? value ?? ''

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
    ],
    content: initialContent,
    editable: mode === 'edit',
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

  // Keep `editable` in sync if the parent flips mode without remounting.
  useEffect(() => {
    editor?.setEditable(mode === 'edit')
  }, [editor, mode])

  useImperativeHandle(
    ref,
    (): DocumentCanvasHandle => ({
      setSignalHighlights: (issues) => {
        editor?.commands.setSignalHighlights(issues)
      },
    }),
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
