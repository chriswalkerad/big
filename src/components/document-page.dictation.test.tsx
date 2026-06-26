import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import type { Document } from '@/types'
import { createStorageRepository } from '@/lib/storage'

// --- Mocks ------------------------------------------------------------------
// The capability gate and the streaming dictation hook are mocked so the mic UI can be
// tested without the Speech SDK / microphone (absent in jsdom). The real DocumentCanvas
// still mounts, so setInterim/commitInterim genuinely drive the editor.

const getSpeechAvailable = vi.fn<() => Promise<boolean>>()
vi.mock('@/lib/speech-token-client', () => ({
  getSpeechAvailable: () => getSpeechAvailable(),
  // requestSpeechToken is unused here (the hook is mocked) but exported for completeness.
  requestSpeechToken: vi.fn(),
}))

// A controllable fake of useDictation. It is a REAL tiny hook with its own local state, so
// start()/stop() drive a status the host re-renders from naturally. It captures the latest
// onInterim/onFinal into module refs so a test can fire them as the SDK would.
type Cb = (text: string) => void
let lastOnInterim: Cb | null = null
let lastOnFinal: Cb | null = null
let lastOnClearInterim: (() => void) | null = null
// Setter into the fake hook's status, captured so a test can drive the 'error' transition
// (a non-auth mic/network cancellation jumps status straight to 'error' in the real hook).
let setDictationStatus: ((s: 'idle' | 'listening' | 'error') => void) | null = null
const startSpy = vi.fn()
const stopSpy = vi.fn()

vi.mock('@/lib/use-dictation', () => ({
  useDictation: ({
    onInterim,
    onFinal,
    onClearInterim,
  }: {
    onInterim: Cb
    onFinal: Cb
    onClearInterim: () => void
  }) => {
    lastOnInterim = onInterim
    lastOnFinal = onFinal
    lastOnClearInterim = onClearInterim
    const [status, setStatus] = useState<'idle' | 'listening' | 'error'>('idle')
    setDictationStatus = setStatus
    return {
      status,
      error: null,
      start: () => {
        startSpy()
        setStatus('listening')
        return Promise.resolve()
      },
      stop: () => {
        stopSpy()
        setStatus('idle')
      },
    }
  },
}))

import { DocumentPage } from './document-page'

beforeAll(() => {
  if (typeof document.elementFromPoint !== 'function') {
    document.elementFromPoint = () => null
  }
})

function seedDoc(overrides: Partial<Document> = {}): Document {
  const repo = createStorageRepository()
  const now = new Date().toISOString()
  const doc: Document = {
    id: 'doc-test',
    projectId: 'proj-eloise',
    title: '',
    body: 'Hello world',
    subtype: 'story_premise',
    subtypeSource: 'auto',
    status: 'draft',
    createdBy: 'You',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
  repo.saveDocument(doc)
  return doc
}

beforeEach(() => {
  window.localStorage.clear()
  lastOnInterim = null
  lastOnFinal = null
  lastOnClearInterim = null
  setDictationStatus = null
  getSpeechAvailable.mockReset()
  startSpy.mockReset()
  stopSpy.mockReset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DocumentPage voice dictation', () => {
  it('renders the mic in edit mode when streaming speech is available', async () => {
    getSpeechAvailable.mockResolvedValue(true)
    seedDoc()
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)

    expect(
      await screen.findByRole('button', { name: /start voice dictation/i }),
    ).toBeInTheDocument()
  })

  it('does NOT render the mic when streaming speech is unavailable', async () => {
    getSpeechAvailable.mockResolvedValue(false)
    seedDoc()
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)

    // Let the capability check resolve, then assert the mic is absent.
    await screen.findByRole('button', { name: /run review/i })
    await waitFor(() => expect(getSpeechAvailable).toHaveBeenCalled())
    expect(
      screen.queryByRole('button', { name: /voice dictation/i }),
    ).not.toBeInTheDocument()
  })

  it('does NOT render the mic in read mode even when available', async () => {
    getSpeechAvailable.mockResolvedValue(true)
    seedDoc({
      status: 'submitted',
      title: 'A Concept',
      submittedSnapshot: {
        body: 'snapshot body',
        review: {
          detectedSubtype: 'story_premise',
          suggestedTitle: 'A Concept',
          themes: [],
          signals: [],
          verdict: { label: 'looks_ready', flagCount: 0 },
        },
        submittedAt: 'T1',
      },
    })
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="read" />)

    await screen.findByRole('button', { name: /change review status/i })
    expect(
      screen.queryByRole('button', { name: /voice dictation/i }),
    ).not.toBeInTheDocument()
    // Read mode can never dictate, so availability is never probed — no speech-token
    // mint on a page that cannot use it.
    expect(getSpeechAvailable).not.toHaveBeenCalled()
  })

  it('toggles recording state and shows the Listening indicator', async () => {
    getSpeechAvailable.mockResolvedValue(true)
    seedDoc()
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)

    const mic = await screen.findByRole('button', { name: /start voice dictation/i })
    expect(mic).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(mic)
    expect(startSpy).toHaveBeenCalledTimes(1)

    // Now listening: button flips to "Stop", aria-pressed true, indicator visible.
    const stopBtn = await screen.findByRole('button', { name: /stop voice dictation/i })
    expect(stopBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/listening/i)).toBeInTheDocument()

    fireEvent.click(stopBtn)
    expect(stopSpy).toHaveBeenCalledTimes(1)
    await screen.findByRole('button', { name: /start voice dictation/i })
  })

  it('streams an interim hypothesis into the editor then commits the final utterance', async () => {
    getSpeechAvailable.mockResolvedValue(true)
    seedDoc({ body: 'Hello world' })
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)

    await screen.findByRole('button', { name: /start voice dictation/i })
    expect(lastOnInterim).not.toBeNull()
    expect(lastOnFinal).not.toBeNull()

    // Interim hypothesis renders as ghosted text (the canvas replaces it in place).
    act(() => {
      lastOnInterim?.('this is dicta')
    })
    await waitFor(() => {
      const editor = document.querySelector('.document-canvas-prose') as HTMLElement | null
      expect(editor?.textContent ?? '').toContain('this is dicta')
    })

    // The final utterance is handed to the canvas via commitInterim(finalText), which
    // replaces the tracked interim range with the settled text as solid authored text.
    act(() => {
      lastOnFinal?.('this is dictated')
    })
    await waitFor(() => {
      const editor = document.querySelector('.document-canvas-prose') as HTMLElement | null
      expect(editor?.textContent ?? '').toContain('this is dictated')
    })
  })

  it('drops the interim ghost when dictation ERRORS (no leftover ghost text in the doc)', async () => {
    getSpeechAvailable.mockResolvedValue(true)
    seedDoc({ body: 'Hello world' })
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)

    const mic = await screen.findByRole('button', { name: /start voice dictation/i })
    fireEvent.click(mic)
    await screen.findByRole('button', { name: /stop voice dictation/i })
    expect(lastOnInterim).not.toBeNull()

    // A hypothesis is streaming as a ghost when the mic/network dies.
    act(() => {
      lastOnInterim?.('half spoken')
    })
    await waitFor(() => {
      const editor = document.querySelector('.document-canvas-prose') as HTMLElement | null
      expect(editor?.textContent ?? '').toContain('half spoken')
    })

    // A non-auth cancellation jumps status straight to 'error' (the hook tears down; the
    // stop-on-toggle path never runs). The error-transition effect must clear the ghost.
    act(() => {
      setDictationStatus?.('error')
    })
    await waitFor(() => {
      const editor = document.querySelector('.document-canvas-prose') as HTMLElement | null
      expect(editor?.textContent ?? '').not.toContain('half spoken')
      // The original authored content is untouched.
      expect(editor?.textContent ?? '').toContain('Hello world')
    })
  })

  it('drops the interim ghost on a NoMatch (onClearInterim) without authoring it', async () => {
    getSpeechAvailable.mockResolvedValue(true)
    seedDoc({ body: 'Hello world' })
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)

    await screen.findByRole('button', { name: /start voice dictation/i })
    expect(lastOnClearInterim).not.toBeNull()

    act(() => {
      lastOnInterim?.('mumble noise')
    })
    await waitFor(() => {
      const editor = document.querySelector('.document-canvas-prose') as HTMLElement | null
      expect(editor?.textContent ?? '').toContain('mumble noise')
    })

    // The utterance settled with no usable text (NoMatch): the hook calls onClearInterim,
    // which clears the canvas ghost — nothing is committed as authored content.
    act(() => {
      lastOnClearInterim?.()
    })
    await waitFor(() => {
      const editor = document.querySelector('.document-canvas-prose') as HTMLElement | null
      expect(editor?.textContent ?? '').not.toContain('mumble noise')
      expect(editor?.textContent ?? '').toContain('Hello world')
    })
  })

  it('commits a final utterance via commitInterim even with no prior interim', async () => {
    getSpeechAvailable.mockResolvedValue(true)
    seedDoc({ body: 'Hello world' })
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)

    await screen.findByRole('button', { name: /start voice dictation/i })
    expect(lastOnFinal).not.toBeNull()

    // onFinal goes straight to commitInterim(finalText) — no setInterim('… ') step — so
    // a final with no preceding interim still lands as solid authored text (the canvas
    // anchors at the caret and owns spacing).
    act(() => {
      lastOnFinal?.('straight to final')
    })
    await waitFor(() => {
      const editor = document.querySelector('.document-canvas-prose') as HTMLElement | null
      expect(editor?.textContent ?? '').toContain('straight to final')
    })
  })
})
