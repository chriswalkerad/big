import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDictation } from './use-dictation'
import { requestSpeechToken } from './speech-token-client'
import { appError } from './errors'

// The token mint is the network seam: mock it so the hook's start path can be driven
// without a server.
vi.mock('./speech-token-client', () => ({
  requestSpeechToken: vi.fn(),
}))
const requestSpeechTokenMock = vi.mocked(requestSpeechToken)

// --- Fake Speech SDK ---------------------------------------------------------
// A minimal stand-in for microsoft-cognitiveservices-speech-sdk. The recognizer captures
// the assigned event handlers so a test can fire `recognizing`/`recognized`/`canceled` as
// the live service would, and exposes the start callbacks so we can drive success/failure.
type RecognizingArgs = { result: { text: string } }
type RecognizedArgs = { result: { text: string; reason: number } }
type CanceledArgs = { reason: number; errorCode: number; errorDetails?: string }

let lastRecognizer: FakeRecognizer | null = null
function register(r: FakeRecognizer) {
  lastRecognizer = r
}

class FakeRecognizer {
  recognizing: ((sender: unknown, e: RecognizingArgs) => void) | null = null
  recognized: ((sender: unknown, e: RecognizedArgs) => void) | null = null
  canceled: ((sender: unknown, e: CanceledArgs) => void) | null = null
  authorizationToken = ''
  startError: string | null = null
  closed = false
  stopped = false

  constructor() {
    register(this)
  }
  startContinuousRecognitionAsync(onOk: () => void, onErr: (e: string) => void) {
    if (this.startError) onErr(this.startError)
    else onOk()
  }
  stopContinuousRecognitionAsync(onOk: () => void) {
    this.stopped = true
    onOk()
  }
  close() {
    this.closed = true
  }
}

const fakeAudioConfig = { close: vi.fn() }

vi.mock('microsoft-cognitiveservices-speech-sdk', () => {
  return {
    SpeechConfig: {
      fromAuthorizationToken: vi.fn(() => ({ speechRecognitionLanguage: '' })),
    },
    AudioConfig: {
      fromDefaultMicrophoneInput: vi.fn(() => fakeAudioConfig),
    },
    SpeechRecognizer: FakeRecognizer,
    ResultReason: { RecognizedSpeech: 3 },
    CancellationReason: { Error: 1, EndOfStream: 0 },
    CancellationErrorCode: { NoError: 0, AuthenticationFailure: 1, Forbidden: 8, ServiceError: 6 },
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  requestSpeechTokenMock.mockReset()
  fakeAudioConfig.close.mockReset()
  lastRecognizer = null
})

const okToken = () =>
  ({ ok: true as const, data: { token: 'tok-123', region: 'eastus' } })

describe('useDictation', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useDictation({ onInterim: () => {}, onFinal: () => {} }))
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
  })

  it('wires recognizing → onInterim (full hypothesis) and recognized → onFinal', async () => {
    requestSpeechTokenMock.mockResolvedValue(okToken())
    const onInterim = vi.fn()
    const onFinal = vi.fn()
    const { result } = renderHook(() => useDictation({ onInterim, onFinal }))

    await act(async () => {
      await result.current.start()
    })
    await waitFor(() => expect(result.current.status).toBe('listening'))
    expect(lastRecognizer).not.toBeNull()

    act(() => {
      lastRecognizer?.recognizing?.(null, { result: { text: 'hello wor' } })
    })
    expect(onInterim).toHaveBeenCalledWith('hello wor')

    act(() => {
      // reason 3 === ResultReason.RecognizedSpeech in the fake SDK
      lastRecognizer?.recognized?.(null, { result: { text: 'hello world', reason: 3 } })
    })
    expect(onFinal).toHaveBeenCalledWith('hello world')

    // A non-speech recognized event (e.g. NoMatch reason) does NOT fire onFinal.
    act(() => {
      lastRecognizer?.recognized?.(null, { result: { text: '', reason: 0 } })
    })
    expect(onFinal).toHaveBeenCalledTimes(1)
  })

  it('surfaces a typed error when the token mint fails (never throws)', async () => {
    requestSpeechTokenMock.mockResolvedValue({ ok: false, error: appError('NETWORK_OFFLINE') })
    const { result } = renderHook(() => useDictation({ onInterim: () => {}, onFinal: () => {} }))

    await act(async () => {
      await result.current.start()
    })
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error?.code).toBe('NETWORK_OFFLINE')
    // No recognizer was ever created.
    expect(lastRecognizer).toBeNull()
  })

  it('a mic-denied cancellation surfaces a typed "microphone blocked" error', async () => {
    requestSpeechTokenMock.mockResolvedValue(okToken())
    const { result } = renderHook(() => useDictation({ onInterim: () => {}, onFinal: () => {} }))

    await act(async () => {
      await result.current.start()
    })
    await waitFor(() => expect(result.current.status).toBe('listening'))

    act(() => {
      // reason 1 === CancellationReason.Error; ServiceError (6) with a permission detail.
      lastRecognizer?.canceled?.(null, {
        reason: 1,
        errorCode: 6,
        errorDetails: 'Microphone permission was denied by the user.',
      })
    })

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error?.message).toMatch(/microphone access/i)
  })

  it('an auth-failure cancellation attempts a token refresh before erroring', async () => {
    requestSpeechTokenMock.mockResolvedValue(okToken())
    const { result } = renderHook(() => useDictation({ onInterim: () => {}, onFinal: () => {} }))

    await act(async () => {
      await result.current.start()
    })
    await waitFor(() => expect(result.current.status).toBe('listening'))

    // The refresh succeeds → no error; the recognizer's token is reassigned.
    requestSpeechTokenMock.mockResolvedValueOnce({
      ok: true,
      data: { token: 'tok-refreshed', region: 'eastus' },
    })
    await act(async () => {
      // reason 1 (Error), errorCode 1 (AuthenticationFailure)
      lastRecognizer?.canceled?.(null, { reason: 1, errorCode: 1, errorDetails: 'auth failed' })
      await Promise.resolve()
    })

    expect(result.current.status).toBe('listening')
    expect(lastRecognizer?.authorizationToken).toBe('tok-refreshed')
  })

  it('stop tears down the recognizer + audio config and returns to idle', async () => {
    requestSpeechTokenMock.mockResolvedValue(okToken())
    const { result } = renderHook(() => useDictation({ onInterim: () => {}, onFinal: () => {} }))

    await act(async () => {
      await result.current.start()
    })
    await waitFor(() => expect(result.current.status).toBe('listening'))
    const rec = lastRecognizer

    act(() => {
      result.current.stop()
    })

    expect(result.current.status).toBe('idle')
    expect(rec?.stopped).toBe(true)
    expect(rec?.closed).toBe(true)
    expect(fakeAudioConfig.close).toHaveBeenCalled()
  })
})
