import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDictation, pcmToWav } from './use-dictation'

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
