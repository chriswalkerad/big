import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import { Document } from '@tiptap/extension-document'
import { Paragraph } from '@tiptap/extension-paragraph'
import { Text } from '@tiptap/extension-text'
import type { DecorationSet } from '@tiptap/pm/view'
import {
  SignalHighlight,
  signalHighlightPluginKey,
  type SignalHighlightIssue,
} from './SignalHighlight'

// A small, isolated sample for the render tests. Two distinct signals, two severities.
const SAMPLE_BODY =
  'The brand mascot drinks soda all afternoon. The brand mascot is fine otherwise.'

const SAMPLE_ISSUES: SignalHighlightIssue[] = [
  {
    signalId: 'brand_safety',
    quote: 'drinks soda',
    message: 'Unhealthy behaviour for a kids brand mascot.',
    severity: 'risk',
  },
  {
    signalId: 'clarity',
    quote: 'fine otherwise',
    message: 'Vague — say what is actually fine.',
    severity: 'minor',
  },
]

function makeEditor(content: string): Editor {
  return new Editor({
    extensions: [Document, Paragraph, Text, SignalHighlight],
    content,
  })
}

/** Read the live decoration set out of the plugin state. */
function decorationSet(editor: Editor): DecorationSet {
  const set = signalHighlightPluginKey.getState(editor.state)
  if (!set) throw new Error('signalHighlight plugin state missing')
  return set
}

function decorationCount(editor: Editor): number {
  // find() with no bounds returns every decoration in the set.
  return decorationSet(editor).find().length
}

let editors: Editor[] = []
function track(editor: Editor): Editor {
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
})

describe('SignalHighlight', () => {
  it('starts with an empty decoration set', () => {
    const editor = track(makeEditor('<p>Hello world</p>'))
    expect(decorationCount(editor)).toBe(0)
  })

  it('rebuilds decorations on setSignalHighlights', () => {
    const editor = track(makeEditor(`<p>${SAMPLE_BODY}</p>`))

    editor.commands.setSignalHighlights(SAMPLE_ISSUES)

    expect(decorationCount(editor)).toBe(2)
  })

  it('writes class, data-signal-id, data-severity and title onto each decoration', () => {
    const editor = track(makeEditor(`<p>${SAMPLE_BODY}</p>`))
    editor.commands.setSignalHighlights(SAMPLE_ISSUES)

    // Decoration internals are not public API, but `.type.attrs` is where inline
    // decoration attributes are stored; assert via the rendered DOM instead.
    editor.view.updateState(editor.state)
    const els = editor.view.dom.querySelectorAll<HTMLElement>('.signal-highlight')
    expect(els.length).toBe(2)

    const risk = Array.from(els).find(
      (el) => el.getAttribute('data-signal-id') === 'brand_safety',
    )
    expect(risk).toBeTruthy()
    expect(risk?.getAttribute('data-severity')).toBe('risk')
    expect(risk?.getAttribute('title')).toBe(
      'Unhealthy behaviour for a kids brand mascot.',
    )
    expect(risk?.textContent).toBe('drinks soda')
  })

  it('clears decorations to empty on a document edit (docChanged)', () => {
    const editor = track(makeEditor(`<p>${SAMPLE_BODY}</p>`))
    editor.commands.setSignalHighlights(SAMPLE_ISSUES)
    expect(decorationCount(editor)).toBe(2)

    // Any real edit clears the overlay — positions are never mapped across edits.
    editor.commands.insertContentAt(1, 'X')

    expect(decorationCount(editor)).toBe(0)
    expect(decorationSet(editor)).toBe(
      // DecorationSet.empty is a shared singleton.
      signalHighlightPluginKey.getState(editor.state),
    )
  })

  it('keeps decorations through a selection-only change', () => {
    const editor = track(makeEditor(`<p>${SAMPLE_BODY}</p>`))
    editor.commands.setSignalHighlights(SAMPLE_ISSUES)
    expect(decorationCount(editor)).toBe(2)

    editor.commands.setTextSelection(3)

    expect(decorationCount(editor)).toBe(2)
  })

  it('takes the first occurrence when a quote matches more than once', () => {
    const editor = track(makeEditor(`<p>${SAMPLE_BODY}</p>`))

    // "The brand mascot" appears twice; only the first should be decorated.
    editor.commands.setSignalHighlights([
      {
        signalId: 'clarity',
        quote: 'The brand mascot',
        message: 'duplicate phrase',
        severity: 'minor',
      },
    ])

    const decos = decorationSet(editor).find()
    expect(decos.length).toBe(1)
    const firstIndex = SAMPLE_BODY.indexOf('The brand mascot')
    // ProseMirror positions are 1-based at the paragraph start, so from = index + 1.
    expect(decos[0].from).toBe(firstIndex + 1)
  })

  it('skips an unknown quote silently without crashing', () => {
    const editor = track(makeEditor(`<p>${SAMPLE_BODY}</p>`))

    expect(() =>
      editor.commands.setSignalHighlights([
        {
          signalId: 'clarity',
          quote: 'this phrase is not in the document',
          message: 'should be skipped',
          severity: 'minor',
        },
        SAMPLE_ISSUES[0], // a real match alongside the miss
      ]),
    ).not.toThrow()

    // Only the matching issue produced a decoration.
    expect(decorationCount(editor)).toBe(1)
  })

  it('passing an empty list clears the overlay', () => {
    const editor = track(makeEditor(`<p>${SAMPLE_BODY}</p>`))
    editor.commands.setSignalHighlights(SAMPLE_ISSUES)
    expect(decorationCount(editor)).toBe(2)

    editor.commands.setSignalHighlights([])

    expect(decorationCount(editor)).toBe(0)
  })
})
