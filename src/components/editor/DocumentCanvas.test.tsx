import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { createRef } from 'react'
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { DocumentCanvas, type DocumentCanvasHandle } from './DocumentCanvas'
import type { SignalHighlightIssue } from './SignalHighlight'

// jsdom does not implement Document.elementFromPoint, which ProseMirror's native
// mousedown handler calls after our handleDOMEvents handler returns. Stub it so the
// native path is harmless under jsdom; our handler still runs first and is asserted.
beforeAll(() => {
  if (typeof document.elementFromPoint !== 'function') {
    document.elementFromPoint = () => null
  }
})

const SAMPLE_BODY = 'The mascot drinks soda in the opening scene.'

const SAMPLE_ISSUES: SignalHighlightIssue[] = [
  {
    signalId: 'brand_safety',
    quote: 'drinks soda',
    message: 'Unhealthy behaviour for the mascot.',
    severity: 'risk',
  },
]

afterEach(cleanup)

describe('DocumentCanvas', () => {
  it('renders the body content in read mode as read-only', async () => {
    const ref = createRef<DocumentCanvasHandle>()
    const { container } = render(
      <DocumentCanvas ref={ref} mode="read" content={`<p>${SAMPLE_BODY}</p>`} />,
    )

    await waitFor(() => {
      expect(container.querySelector('.ProseMirror')).toBeTruthy()
    })

    const prose = container.querySelector<HTMLElement>('.ProseMirror')
    expect(prose?.textContent).toContain('drinks soda')
    expect(prose?.getAttribute('contenteditable')).toBe('false')
  })

  it('renders an editable surface in edit mode', async () => {
    const ref = createRef<DocumentCanvasHandle>()
    const { container } = render(
      <DocumentCanvas ref={ref} mode="edit" content={`<p>${SAMPLE_BODY}</p>`} />,
    )

    await waitFor(() => {
      expect(container.querySelector('.ProseMirror')).toBeTruthy()
    })

    const prose = container.querySelector<HTMLElement>('.ProseMirror')
    expect(prose?.getAttribute('contenteditable')).toBe('true')
  })

  it('exposes setSignalHighlights via ref and renders squiggles', async () => {
    const ref = createRef<DocumentCanvasHandle>()
    const { container } = render(
      <DocumentCanvas ref={ref} mode="edit" content={`<p>${SAMPLE_BODY}</p>`} />,
    )

    await waitFor(() => {
      expect(ref.current).toBeTruthy()
    })

    ref.current!.setSignalHighlights(SAMPLE_ISSUES)

    await waitFor(() => {
      const el = container.querySelector<HTMLElement>('.signal-highlight')
      expect(el).toBeTruthy()
      expect(el?.getAttribute('data-signal-id')).toBe('brand_safety')
      expect(el?.getAttribute('data-severity')).toBe('risk')
      expect(el?.getAttribute('title')).toBe('Unhealthy behaviour for the mascot.')
    })
  })

  it('replaces the body via setContent and fires onChange', async () => {
    const onChange = vi.fn()
    const ref = createRef<DocumentCanvasHandle>()
    const { container } = render(
      <DocumentCanvas
        ref={ref}
        mode="edit"
        content={`<p>${SAMPLE_BODY}</p>`}
        onChange={onChange}
      />,
    )

    await waitFor(() => expect(ref.current).toBeTruthy())

    ref.current!.setContent('<p>new text</p>')

    // The rendered editor reflects the replaced content...
    await waitFor(() => {
      const prose = container.querySelector<HTMLElement>('.ProseMirror')
      expect(prose?.textContent).toContain('new text')
      expect(prose?.textContent).not.toContain('drinks soda')
    })

    // ...and onChange fired with the new serialized HTML so the parent stays in sync.
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('new text')
  })

  it('inserts text at the caret via insertText and fires onChange', async () => {
    const onChange = vi.fn()
    const ref = createRef<DocumentCanvasHandle>()
    // Seed the existing text via a first dictation chunk so the caret sits right
    // after it (insertContent advances the selection past what it wrote). The next
    // chunk then appends — a genuine author edit, exactly as voice dictation drives it.
    const { container } = render(
      <DocumentCanvas ref={ref} mode="edit" content="" onChange={onChange} />,
    )

    await waitFor(() => expect(ref.current).toBeTruthy())
    await waitFor(() => expect(container.querySelector('.ProseMirror')).toBeTruthy())

    ref.current!.insertText('Hello')
    ref.current!.insertText(' world')

    // The rendered editor reflects the inserted text...
    await waitFor(() => {
      const prose = container.querySelector<HTMLElement>('.ProseMirror')
      expect(prose?.textContent).toContain('Hello world')
    })

    // ...and onChange fired with the new serialized HTML so the parent body syncs.
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('Hello world')
  })

  it('refines interim in place then commits to normal text; setInterim does NOT fire onChange, commit does', async () => {
    const onChange = vi.fn()
    const ref = createRef<DocumentCanvasHandle>()
    const { container } = render(
      <DocumentCanvas ref={ref} mode="edit" content="" onChange={onChange} />,
    )

    await waitFor(() => expect(ref.current).toBeTruthy())
    await waitFor(() => expect(container.querySelector('.ProseMirror')).toBeTruthy())

    onChange.mockClear()

    // First hypothesis → ghost text appears. Provisional: no onChange.
    ref.current!.setInterim('hello')
    await waitFor(() => {
      const ghost = container.querySelector<HTMLElement>('.dictation-interim')
      expect(ghost?.textContent).toBe('hello')
    })
    expect(onChange).not.toHaveBeenCalled()

    // Refined hypothesis → REPLACES in place; still exactly one ghost span. Still no onChange.
    ref.current!.setInterim('hello there')
    await waitFor(() => {
      const ghosts = container.querySelectorAll('.dictation-interim')
      expect(ghosts.length).toBe(1)
      expect(ghosts[0]?.textContent).toBe('hello there')
    })
    const prose = container.querySelector<HTMLElement>('.ProseMirror')
    expect(prose?.textContent).toBe('hello there')
    expect(prose?.textContent).not.toContain('hellohello')
    expect(onChange).not.toHaveBeenCalled()

    // Commit (no finalText) → un-ghost in place; mark gone; onChange fires once now.
    ref.current!.commitInterim()
    await waitFor(() => {
      expect(container.querySelector('.dictation-interim')).toBeNull()
    })
    expect(container.querySelector<HTMLElement>('.ProseMirror')?.textContent).toBe(
      'hello there',
    )
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('hello there')
  })

  it('commitInterim(finalText) after setInterim replaces in place (one span → solid text) and fires onChange once', async () => {
    const onChange = vi.fn()
    const ref = createRef<DocumentCanvasHandle>()
    const { container } = render(
      <DocumentCanvas ref={ref} mode="edit" content="" onChange={onChange} />,
    )

    await waitFor(() => expect(ref.current).toBeTruthy())
    await waitFor(() => expect(container.querySelector('.ProseMirror')).toBeTruthy())

    ref.current!.setInterim('hello ther')
    await waitFor(() => {
      expect(container.querySelector('.dictation-interim')?.textContent).toBe('hello ther')
    })

    onChange.mockClear()
    ref.current!.commitInterim('hello there')

    await waitFor(() => {
      expect(container.querySelector('.dictation-interim')).toBeNull()
    })
    const prose = container.querySelector<HTMLElement>('.ProseMirror')
    // Final settled text replaced the ghost in place — solid text, no provisional span.
    expect(prose?.textContent).toBe('hello there')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('hello there')
  })

  it('commitInterim(finalText) lands at the interim anchor even if the selection moved away', async () => {
    const ref = createRef<DocumentCanvasHandle>()
    const { container } = render(
      <DocumentCanvas ref={ref} mode="edit" content="<p>start end</p>" />,
    )

    await waitFor(() => expect(ref.current).toBeTruthy())
    await waitFor(() => expect(container.querySelector('.ProseMirror')).toBeTruthy())

    // Anchor the interim at the current caret, then MOVE the DOM selection elsewhere
    // before committing — proving the commit uses the remembered anchor, not the caret.
    ref.current!.setInterim('MID')
    await waitFor(() => {
      expect(container.querySelector('.dictation-interim')?.textContent).toBe('MID')
    })

    // Simulate the user clicking away: collapse the browser selection to the very end of
    // the document, so a naive "insert at live caret" would land the final text wrongly.
    const prose = container.querySelector<HTMLElement>('.ProseMirror')!
    const sel = window.getSelection()
    const lastText = prose.lastChild?.lastChild ?? prose.lastChild ?? prose
    const range = document.createRange()
    range.selectNodeContents(lastText)
    range.collapse(false)
    sel?.removeAllRanges()
    sel?.addRange(range)

    // Commit the settled text: it must replace the MID ghost in place, NOT append at end.
    ref.current!.commitInterim('MIDDLE')
    await waitFor(() => {
      expect(container.querySelector('.dictation-interim')).toBeNull()
    })
    // The committed text is where the ghost was (where MID had been), not at the moved caret.
    expect(prose.textContent).toContain('MIDDLE')
    expect(prose.textContent).not.toContain('MID ')
  })

  it('normalizes spacing: no stray leading/trailing space, single space between utterances', async () => {
    const onChange = vi.fn()
    const ref = createRef<DocumentCanvasHandle>()
    const { container } = render(
      <DocumentCanvas ref={ref} mode="edit" content="" onChange={onChange} />,
    )

    await waitFor(() => expect(ref.current).toBeTruthy())
    await waitFor(() => expect(container.querySelector('.ProseMirror')).toBeTruthy())

    // First utterance at the doc start → no leading space even though finalText is padded.
    ref.current!.setInterim('first')
    await waitFor(() =>
      expect(container.querySelector('.dictation-interim')?.textContent).toBe('first'),
    )
    ref.current!.commitInterim('  first  ')
    await waitFor(() => expect(container.querySelector('.dictation-interim')).toBeNull())
    expect(container.querySelector<HTMLElement>('.ProseMirror')?.textContent).toBe('first')

    // Second utterance → exactly one separating space, no doubled space.
    ref.current!.setInterim('second')
    await waitFor(() =>
      expect(container.querySelectorAll('.dictation-interim').length).toBe(1),
    )
    ref.current!.commitInterim(' second ')
    await waitFor(() => expect(container.querySelector('.dictation-interim')).toBeNull())
    expect(container.querySelector<HTMLElement>('.ProseMirror')?.textContent).toBe(
      'first second',
    )
  })

  it('undo after commit removes the dictated text in one step', async () => {
    const ref = createRef<DocumentCanvasHandle>()
    const { container } = render(
      <DocumentCanvas ref={ref} mode="edit" content="<p>seed</p>" />,
    )

    await waitFor(() => expect(ref.current).toBeTruthy())
    await waitFor(() => expect(container.querySelector('.ProseMirror')).toBeTruthy())

    ref.current!.setInterim('spoken')
    await waitFor(() =>
      expect(container.querySelector('.dictation-interim')?.textContent).toBe('spoken'),
    )
    ref.current!.commitInterim('spoken words')
    await waitFor(() => expect(container.querySelector('.dictation-interim')).toBeNull())

    const prose = container.querySelector<HTMLElement>('.ProseMirror')!
    expect(prose.textContent).toContain('spoken words')

    // Cmd/Ctrl+Z through the real ProseMirror undo keymap must remove the dictated text
    // (the interim churn was kept out of history; the commit is the single undoable step).
    fireEvent.keyDown(prose, { key: 'z', ctrlKey: true })
    fireEvent.keyDown(prose, { key: 'z', metaKey: true })

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>('.ProseMirror')?.textContent,
      ).not.toContain('spoken words')
    })
  })

  it('clears an uncommitted interim, removing the provisional text', async () => {
    const ref = createRef<DocumentCanvasHandle>()
    const { container } = render(
      <DocumentCanvas ref={ref} mode="edit" content="" />,
    )

    await waitFor(() => expect(ref.current).toBeTruthy())
    await waitFor(() => expect(container.querySelector('.ProseMirror')).toBeTruthy())

    ref.current!.setInterim('draft')
    await waitFor(() => {
      expect(container.querySelector('.dictation-interim')?.textContent).toBe('draft')
    })

    ref.current!.clearInterim()
    await waitFor(() => {
      expect(container.querySelector('.dictation-interim')).toBeNull()
    })
    expect(container.querySelector<HTMLElement>('.ProseMirror')?.textContent).not.toContain(
      'draft',
    )
  })

  it('fires onHighlightClick with the data-signal-id on mousedown', async () => {
    const onHighlightClick = vi.fn()
    const ref = createRef<DocumentCanvasHandle>()
    const { container } = render(
      <DocumentCanvas
        ref={ref}
        mode="read"
        content={`<p>${SAMPLE_BODY}</p>`}
        onHighlightClick={onHighlightClick}
      />,
    )

    await waitFor(() => expect(ref.current).toBeTruthy())
    ref.current!.setSignalHighlights(SAMPLE_ISSUES)

    let highlight: HTMLElement | null = null
    await waitFor(() => {
      highlight = container.querySelector<HTMLElement>('.signal-highlight')
      expect(highlight).toBeTruthy()
    })

    highlight!.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
    )

    expect(onHighlightClick).toHaveBeenCalledWith('brand_safety')
  })
})
