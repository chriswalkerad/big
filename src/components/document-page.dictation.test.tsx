import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import type { Document } from '@/types'
import { createStorageRepository } from '@/lib/storage'

// --- Mocks ------------------------------------------------------------------
// The capability gate and the dictation hook are mocked so the mic UI can be tested
// without touching MediaRecorder/getUserMedia (absent in jsdom). The real
// DocumentCanvas still mounts, so insertText genuinely edits the editor.

const getTranscribeAvailable = vi.fn<() => Promise<boolean>>()
vi.mock('@/lib/transcribe-client', () => ({
  getTranscribeAvailable: () => getTranscribeAvailable(),
  // requestTranscribe is unused here (the hook is mocked) but exported for completeness.
  requestTranscribe: vi.fn(),
}))

// A controllable fake of useDictation. It is a REAL tiny hook with its own local state
// (no cross-component shared store), so start()/stop() drive a status the host re-renders
// from naturally. It captures the latest onPhrase into a module ref so a test can fire a
// phrase as the audio pipeline would.
type Phrase = (text: string) => void
let lastOnPhrase: Phrase | null = null
const startSpy = vi.fn()
const stopSpy = vi.fn()

vi.mock('@/lib/use-dictation', () => ({
  useDictation: ({ onPhrase }: { onPhrase: Phrase }) => {
    lastOnPhrase = onPhrase
    const [status, setStatus] = useState<'idle' | 'listening' | 'transcribing' | 'error'>('idle')
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
  lastOnPhrase = null
  getTranscribeAvailable.mockReset()
  startSpy.mockReset()
  stopSpy.mockReset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DocumentPage voice dictation', () => {
  it('renders the mic in edit mode when transcription is available', async () => {
    getTranscribeAvailable.mockResolvedValue(true)
    seedDoc()
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)

    expect(
      await screen.findByRole('button', { name: /start voice dictation/i }),
    ).toBeInTheDocument()
  })

  it('does NOT render the mic when transcription is unavailable', async () => {
    getTranscribeAvailable.mockResolvedValue(false)
    seedDoc()
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)

    // Let the capability check resolve, then assert the mic is absent.
    await screen.findByRole('button', { name: /run review/i })
    await waitFor(() =>
      expect(getTranscribeAvailable).toHaveBeenCalled(),
    )
    expect(
      screen.queryByRole('button', { name: /voice dictation/i }),
    ).not.toBeInTheDocument()
  })

  it('does NOT render the mic in read mode even when available', async () => {
    getTranscribeAvailable.mockResolvedValue(true)
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
  })

  it('toggles recording state and shows the Listening indicator', async () => {
    getTranscribeAvailable.mockResolvedValue(true)
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

  it('routes a transcribed phrase into the editor at the caret', async () => {
    getTranscribeAvailable.mockResolvedValue(true)
    seedDoc({ body: 'Hello world' })
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)

    await screen.findByRole('button', { name: /start voice dictation/i })
    // The hook captured the onPhrase wiring; fire a phrase as the hook would. This calls
    // canvasRef.insertText, a genuine editor edit (state update) — wrap it in act.
    expect(lastOnPhrase).not.toBeNull()
    act(() => {
      lastOnPhrase?.('this is dictated')
    })

    // insertText placed the phrase into the live editor (with a normalized leading
    // space so it doesn't run into the existing body).
    await waitFor(() => {
      const editor = document.querySelector('.document-canvas-prose') as HTMLElement | null
      expect(editor?.textContent ?? '').toContain('this is dictated')
    })
  })
})
