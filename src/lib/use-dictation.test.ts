import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDictation, pcmToWav } from './use-dictation'
import { requestTranscribe } from './transcribe-client'
import { appError } from './errors'

// The transcribe client is the network seam: mock it so the hook's finalize path can be
// driven without a server.
vi.mock('./transcribe-client', () => ({
  requestTranscribe: vi.fn(),
}))
const requestTranscribeMock = vi.mocked(requestTranscribe)

// The hook's audio internals (MediaRecorder, AudioContext) are not exercised in jsdom.
// We only verify the permission-denied path: getUserMedia rejecting must land the hook
// in a typed error state without throwing to the caller/render.

afterEach(() => {
  vi.restoreAllMocks()
})

describe('pcmToWav', () => {
  it('writes a 44-byte RIFF/WAVE header with the given sample rate and mono 16-bit PCM', async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1])
    const blob = pcmToWav(samples, 16000)
    expect(blob.type).toBe('audio/wav')
    // 44 header bytes + 2 bytes/sample.
    expect(blob.size).toBe(44 + samples.length * 2)

    const view = new DataView(await blob.arrayBuffer())
    const tag = (o: number) =>
      String.fromCharCode(view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3))
    expect(tag(0)).toBe('RIFF')
    expect(tag(8)).toBe('WAVE')
    expect(tag(12)).toBe('fmt ')
    expect(tag(36)).toBe('data')
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(16000) // sample rate
    expect(view.getUint16(34, true)).toBe(16) // bits per sample
  })
})

describe('useDictation', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useDictation({ onPhrase: () => {} }))
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
  })

  it('enters a typed error state when mic permission is denied (never throws)', async () => {
    // A genuine DOMException so the hook's `instanceof DOMException` branch fires.
    const denied = new DOMException('denied', 'NotAllowedError')
    // jsdom has no mediaDevices; define a rejecting getUserMedia.
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(denied),
      },
    })

    const { result } = renderHook(() => useDictation({ onPhrase: () => {} }))
    await act(async () => {
      await result.current.start()
    })

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).not.toBeNull()
    expect(result.current.error?.message).toMatch(/microphone access/i)
  })
})

// --- Segmentation: the speech gate + empty-result no-op -----------------------
// jsdom has no Web Audio API, so we stub the minimal audio graph the hook builds and
// drive the silence-gate loop by hand. `rms` (set per test) controls what the analyser
// reports; `pumpPcm` feeds a buffer through the ScriptProcessor; `runFrames` advances the
// rAF-based tick loop. This lets us exercise finalizePhrase end-to-end.
describe('useDictation segmentation', () => {
  // Performance.now() the hook reads for the silence window; we advance it manually.
  let nowMs = 0
  // What the analyser reports as the current RMS each frame.
  let rms = 0
  let processorOnAudio: ((ev: { inputBuffer: { getChannelData: () => Float32Array } }) => void) | null = null
  const rafCbs: Array<() => void> = []

  function setupAudioGraph() {
    nowMs = 0
    rms = 0
    processorOnAudio = null
    rafCbs.length = 0

    // RMS = sqrt(mean(square)); a constant-`v` buffer has RMS = |v|, so encode the
    // desired RMS directly into the time-domain samples the analyser hands back.
    const analyser = {
      fftSize: 2048,
      getFloatTimeDomainData: (buf: Float32Array) => {
        buf.fill(rms)
      },
    }
    const processor = {
      set onaudioprocess(fn: typeof processorOnAudio) {
        processorOnAudio = fn
      },
      get onaudioprocess() {
        return processorOnAudio
      },
      connect: () => {},
      disconnect: () => {},
    }
    const ctx = {
      sampleRate: 16000,
      state: 'running' as const,
      createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => {} }),
      createAnalyser: () => analyser,
      createScriptProcessor: () => processor,
      destination: {},
      close: () => Promise.resolve(),
    }
    vi.stubGlobal('AudioContext', vi.fn(() => ctx))
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
    })
    vi.stubGlobal('performance', { now: () => nowMs })
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      rafCbs.push(cb)
      return rafCbs.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  }

  // Run the currently-queued rAF callback(s) once each. Each tick re-queues the next.
  function runFrames(n: number) {
    for (let i = 0; i < n; i++) {
      const cb = rafCbs.shift()
      if (cb) cb()
    }
  }

  function pumpPcm() {
    processorOnAudio?.({ inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.2) } })
  }

  // Drive one full speech-then-silence phrase: a speech frame (RMS above threshold,
  // PCM buffered), a first silence frame (records the silence-window start), then — after
  // advancing the clock past SILENCE_MS — a second silence frame that fires finalize.
  async function finalizeSpeechPhrase() {
    rms = 0.2
    pumpPcm()
    runFrames(1)
    rms = 0.001
    runFrames(1) // first silence frame: starts the window at the current clock
    nowMs += 1000 // advance past SILENCE_MS (800)
    runFrames(1) // second silence frame: window elapsed -> finalizePhrase()
    await Promise.resolve()
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    requestTranscribeMock.mockReset()
  })

  it('DISCARDS a pure-silence segment: never encodes or POSTs when no speech was detected', async () => {
    setupAudioGraph()
    const { result } = renderHook(() => useDictation({ onPhrase: () => {} }))
    await act(async () => {
      await result.current.start()
    })

    // Feed audio but keep RMS below the speech threshold the whole time; advance the
    // clock well past the silence window. With no speech ever seen, the gate must never
    // finalize, so requestTranscribe is never called.
    await act(async () => {
      rms = 0.001
      for (let i = 0; i < 5; i++) {
        pumpPcm()
        nowMs += 1000
        runFrames(1)
      }
    })

    expect(requestTranscribeMock).not.toHaveBeenCalled()
    expect(result.current.status).toBe('listening')
    expect(result.current.error).toBeNull()
  })

  it('an empty transcript is a no-op: no insert, no error, stays listening', async () => {
    requestTranscribeMock.mockResolvedValue({ ok: true, data: { text: '   ' } })
    const onPhrase = vi.fn()
    setupAudioGraph()
    const { result } = renderHook(() => useDictation({ onPhrase }))
    await act(async () => {
      await result.current.start()
    })

    // Speech, then silence past the window -> finalize a real (speech) segment.
    await act(async () => {
      await finalizeSpeechPhrase()
    })

    expect(requestTranscribeMock).toHaveBeenCalledOnce()
    expect(onPhrase).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.status).toBe('listening'))
    expect(result.current.error).toBeNull()
  })

  it('a non-empty transcript is inserted; a real error surfaces and stops', async () => {
    const onPhrase = vi.fn()
    setupAudioGraph()
    const { result } = renderHook(() => useDictation({ onPhrase }))
    await act(async () => {
      await result.current.start()
    })

    // First phrase: success with text -> onPhrase fires, stays listening.
    requestTranscribeMock.mockResolvedValueOnce({ ok: true, data: { text: 'hello there' } })
    await act(async () => {
      await finalizeSpeechPhrase()
    })
    expect(onPhrase).toHaveBeenCalledWith('hello there')
    await waitFor(() => expect(result.current.status).toBe('listening'))

    // Second phrase: a genuine failure -> error state.
    requestTranscribeMock.mockResolvedValueOnce({ ok: false, error: appError('NETWORK_OFFLINE') })
    await act(async () => {
      await finalizeSpeechPhrase()
    })
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error?.code).toBe('NETWORK_OFFLINE')
  })
})
