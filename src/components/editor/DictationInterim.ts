// DictationInterim — a provisional "ghost" text mark for streaming voice dictation.
//
// Read this before changing it; the design mirrors SignalHighlight's structure but
// makes a deliberately different modelling choice.
//
// 1. A MARK, not a decoration.
//    Unlike review highlights (which are a transient overlay that never touches the
//    document — see SignalHighlight), the interim transcript IS real text the user is
//    in the middle of authoring. It lives in the document so the caret sits inside it,
//    it refines in place as new hypotheses stream in, and it commits to normal authored
//    text on `commitInterim()`. We therefore model the "provisional" state as an inline
//    mark applied to that live text: committing is just removing the mark (the text
//    stays); discarding is deleting the marked range.
//
// 2. Purely presentational, no stored attributes, not serialized into `body`.
//    The mark only paints the ghost color via a token-backed class. It is never meant
//    to survive into the saved document — DocumentCanvas's imperative handle always
//    either commits (strips the mark) or clears (deletes the range) the interim before
//    the body is treated as final. The `<span class="dictation-interim">` rendering is
//    for the live, in-flight view only.
//
// Position tracking, replacement, and the insert/commit/clear transactions live in
// DocumentCanvas's imperative handle, which owns the tracked range. This file only
// declares the schema + rendering of the mark itself.

import { Mark, mergeAttributes } from '@tiptap/core'

/** Stable schema name; DocumentCanvas references it when adding/removing the mark. */
export const DICTATION_INTERIM_MARK_NAME = 'dictationInterim'

export const DictationInterim = Mark.create({
  name: DICTATION_INTERIM_MARK_NAME,

  // No attributes: the mark is a pure on/off presentational flag for ghost text.
  // Provisional text is short-lived and is never round-tripped through HTML, so we
  // do not register a `parseHTML` rule — nothing in a saved body should re-hydrate
  // as provisional. It only ever renders out while live in the editor.
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'dictation-interim' }),
      0,
    ]
  },
})

export default DictationInterim
