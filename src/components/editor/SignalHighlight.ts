// SignalHighlight — a transient ProseMirror decoration layer for review feedback.
//
// Two deliberate decisions are baked into this extension; read them before changing it.
//
// 1. Decorations, NOT marks.
//    Highlights are a transient overlay tied to the latest review run — they are not
//    part of the document. Modelling them as stored marks would pollute the schema,
//    serialize into `body`, and survive edits/undo as if the author had typed them.
//    ProseMirror Decorations live outside the document: they paint over the current
//    view, never touch the doc, and vanish the moment we rebuild the DecorationSet.
//    That is exactly the lifetime we want for review highlights.
//
// 2. Quote-match, NOT character offsets.
//    The review model quotes the phrase it is flagging ("…this exact sentence…").
//    LLMs reproduce short verbatim quotes reliably; what they (and humans) get wrong
//    is character arithmetic — off-by-one offsets, counting code points vs. UTF-16
//    units, drift after any edit. Counting characters is where the bugs live. So we
//    locate each quote at render time by string match inside a single text node
//    (`from = nodePos + text.indexOf(quote)`). No cross-node search, no offset storage.

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { SignalIssue } from '@/types'

/**
 * The base `SignalIssue` (quote/message/severity) carries no signal id, but the
 * decoration's `data-signal-id` — which `onHighlightClick(signalId)` reads back —
 * needs one. The extension therefore consumes issues that have been tagged with the
 * id of the signal that produced them.
 */
export interface SignalHighlightIssue extends SignalIssue {
  signalId: string
}

/** Meta key used to ship a fresh issue list into the plugin via a transaction. */
const SET_HIGHLIGHTS_META = 'setSignalHighlights'

export const signalHighlightPluginKey = new PluginKey<DecorationSet>('signalHighlight')

/**
 * Build a DecorationSet for the given issues against the current document.
 *
 * Each issue's `quote` is located by exact string match inside a single text node.
 * Rules (see header):
 *  - single-node match only (no cross-node search)
 *  - multiple matches → first occurrence
 *  - quote not found → skipped silently (never throws)
 */
function buildDecorations(
  doc: ProseMirrorNode,
  issues: readonly SignalHighlightIssue[],
): DecorationSet {
  const decorations: Decoration[] = []

  for (const issue of issues) {
    const quote = issue.quote
    if (!quote) continue

    // Walk text nodes; the first node that contains the quote wins (first occurrence).
    let placed = false
    doc.descendants((node, nodePos) => {
      if (placed) return false
      if (!node.isText || typeof node.text !== 'string') return true

      const index = node.text.indexOf(quote)
      if (index === -1) return true

      const from = nodePos + index
      const to = from + quote.length
      decorations.push(
        Decoration.inline(from, to, {
          class: 'signal-highlight',
          'data-signal-id': issue.signalId,
          'data-severity': issue.severity,
          title: issue.message,
        }),
      )
      placed = true
      return false
    })
    // Not found → skip silently (no push, no crash).
  }

  return DecorationSet.create(doc, decorations)
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    signalHighlight: {
      /**
       * Replace the current highlight overlay with decorations for `issues`.
       * Rebuilds the DecorationSet from scratch — there is no incremental update.
       */
      setSignalHighlights: (issues: readonly SignalHighlightIssue[]) => ReturnType
    }
  }
}

export const SignalHighlight = Extension.create({
  name: 'signalHighlight',

  addCommands() {
    return {
      setSignalHighlights:
        (issues: readonly SignalHighlightIssue[]) =>
        ({ state, dispatch }) => {
          if (dispatch) {
            const tr = state.tr.setMeta(SET_HIGHLIGHTS_META, issues)
            dispatch(tr)
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: signalHighlightPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr: Transaction, current: DecorationSet, _oldState: EditorState, newState: EditorState): DecorationSet {
            // A new issue list always rebuilds the overlay from scratch.
            const incoming = tr.getMeta(SET_HIGHLIGHTS_META) as
              | readonly SignalHighlightIssue[]
              | undefined
            if (incoming) {
              return buildDecorations(newState.doc, incoming)
            }
            // Any real document edit clears the overlay — we do NOT map positions
            // across edits. Highlights stay gone until the next review.
            if (tr.docChanged) {
              return DecorationSet.empty
            }
            // Selection-only / no-op transactions keep the current overlay.
            return current
          },
        },
        props: {
          decorations(state: EditorState): DecorationSet | undefined {
            return signalHighlightPluginKey.getState(state)
          },
        },
      }),
    ]
  },
})

export default SignalHighlight
