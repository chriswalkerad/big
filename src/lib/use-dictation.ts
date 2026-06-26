'use client'

// Voice dictation hook. Captures mic audio with the Web Audio API, segments speech into
// phrases via an RMS silence gate, encodes each finalized phrase as a 16 kHz mono WAV,
// and transcribes it through the Azure-backed /api/transcribe endpoint (the model —
// MAI-Transcribe-1.5 / Azure fast transcription — accepts WAV/MP3/FLAC, NOT webm/opus,
// so we encode WAV ourselves rather than using MediaRecorder). The recognized text is
// reported to the caller via `onPhrase`. All audio internals are encapsulated here; the
// consumer only sees `status`, `error`, and start/stop controls.
//
// Segmentation: a single audio graph — MediaStreamSource → AnalyserNode (for the silence
// gate) and → ScriptProcessorNode (which accumulates raw Float32 PCM for the current
// phrase). An AnalyserNode is polled on animation frames for the signal RMS. Once speech
// has been detected and then a silence window (~800ms) elapses, the accumulated PCM is
// downsampled to 16 kHz mono, encoded to a WAV Blob, and sent for transcription; capture
// continues uninterrupted for the next phrase.

import { useCallback, useEffect, useRef, useState } from 'react'
import { type AppError, appError } from '@/lib/errors'
import { requestTranscribe } from '@/lib/transcribe-client'

export type DictationStatus = 'idle' | 'listening' | 'transcribing' | 'error'

export interface UseDictationOptions {
  onPhrase: (text: string) => void
}

export interface UseDictation {
  status: DictationStatus
  error: AppError | null
  start: () => Promise<void>
  stop: () => void
}

// RMS above this (0..1) counts as speech; sustained below it as silence.
const SPEECH_RMS_THRESHOLD = 0.015
// Silence after speech that finalizes a phrase.
const SILENCE_MS = 800
// The output sample rate the transcription model expects.
const TARGET_SAMPLE_RATE = 16000
// ScriptProcessor frame size (samples per onaudioprocess call).
const PROCESSOR_BUFFER = 4096

/**
 * Encode mono Float32 PCM samples (already at `sampleRate`) into a standard 16-bit PCM
 * WAV Blob (44-byte header). Reusable + dependency-free.
 */
export function pcmToWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2
  const blockAlign = bytesPerSample // mono
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM fmt chunk size
  view.setUint16(20, 1, true) // audio format = PCM
  view.setUint16(22, 1, true) // channels = mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 8 * bytesPerSample, true) // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  // Float [-1,1] → signed 16-bit.
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

/** Concatenate the buffered Float32 chunks into one contiguous array. */
function concatChunks(chunks: Float32Array[]): Float32Array {
  let total = 0
  for (const c of chunks) total += c.length
  const out = new Float32Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

/**
 * Downsample mono Float32 PCM from `fromRate` to `toRate` by simple block averaging.
 * Returns the input unchanged when the rate already matches (or is lower).
 */
function downsample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (toRate >= fromRate) return samples
  const ratio = fromRate / toRate
  const outLength = Math.floor(samples.length / ratio)
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(Math.floor((i + 1) * ratio), samples.length)
    let sum = 0
    let count = 0
    for (let j = start; j < end; j++) {
      sum += samples[j]
      count++
    }
    out[i] = count > 0 ? sum / count : 0
  }
  return out
}

export function useDictation({ onPhrase }: UseDictationOptions): UseDictation {
  const [status, setStatus] = useState<DictationStatus>('idle')
  const [error, setError] = useState<AppError | null>(null)

  // Audio graph handles, kept in refs so they survive renders and can be torn down on
  // stop/unmount without re-triggering effects.
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const rafRef = useRef<number | null>(null)

  // Buffered raw PCM for the in-progress phrase + segmentation bookkeeping.
  const chunksRef = useRef<Float32Array[]>([])
  const sampleRateRef = useRef<number>(TARGET_SAMPLE_RATE)
  const speechSeenRef = useRef(false)
  const silenceStartRef = useRef<number | null>(null)
  // Set true once stop() runs so async callbacks (raf/transcribe) don't resurrect state.
  const stoppedRef = useRef(true)
  // Keep the latest onPhrase without re-creating start/stop.
  const onPhraseRef = useRef(onPhrase)
  useEffect(() => {
    onPhraseRef.current = onPhrase
  }, [onPhrase])

  // Tear down every audio resource. Safe to call repeatedly.
  const teardown = useCallback(() => {
    stoppedRef.current = true
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const processor = processorRef.current
    if (processor) {
      processor.onaudioprocess = null
      try {
        processor.disconnect()
      } catch {
        // already disconnected
      }
    }
    processorRef.current = null
    sourceRef.current?.disconnect()
    sourceRef.current = null
    analyserRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    const ctx = audioCtxRef.current
    if (ctx && ctx.state !== 'closed') {
      void ctx.close().catch(() => {})
    }
    audioCtxRef.current = null
    chunksRef.current = []
    speechSeenRef.current = false
    silenceStartRef.current = null
  }, [])

  const stop = useCallback(() => {
    teardown()
    setStatus('idle')
  }, [teardown])

  // Flush the buffered phrase: assemble the PCM, downsample to 16 kHz mono, encode WAV,
  // transcribe it, and emit the text. Capture keeps running for the next phrase.
  const finalizePhrase = useCallback(() => {
    if (stoppedRef.current) return
    if (chunksRef.current.length === 0) return
    // Snapshot + reset the buffer for the next phrase.
    const parts = chunksRef.current
    chunksRef.current = []
    speechSeenRef.current = false
    silenceStartRef.current = null

    const pcm = concatChunks(parts)
    if (pcm.length === 0) return
    const downsampled = downsample(pcm, sampleRateRef.current, TARGET_SAMPLE_RATE)
    const blob = pcmToWav(downsampled, TARGET_SAMPLE_RATE)

    setStatus('transcribing')
    void requestTranscribe(blob).then((result) => {
      if (stoppedRef.current) return
      if (result.ok) {
        const text = result.data.text.trim()
        if (text) onPhraseRef.current(text)
        setStatus('listening')
      } else {
        setError(result.error)
        setStatus('error')
        teardown()
      }
    })
  }, [teardown])

  // The silence-gate loop. Computes RMS each frame; once speech then SILENCE_MS of quiet
  // has passed, finalizes the phrase. Held in a ref so the rAF loop can re-schedule
  // itself without a forward self-reference; assigned in an effect (never during render)
  // and kept current as `finalizePhrase` changes.
  const tickRef = useRef<() => void>(() => {})
  useEffect(() => {
    tickRef.current = () => {
      const analyser = analyserRef.current
      if (!analyser || stoppedRef.current) return
      const buf = new Float32Array(analyser.fftSize)
      analyser.getFloatTimeDomainData(buf)
      let sumSq = 0
      for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i]
      const rms = Math.sqrt(sumSq / buf.length)

      const now = performance.now()
      if (rms >= SPEECH_RMS_THRESHOLD) {
        speechSeenRef.current = true
        silenceStartRef.current = null
      } else if (speechSeenRef.current) {
        if (silenceStartRef.current === null) {
          silenceStartRef.current = now
        } else if (now - silenceStartRef.current >= SILENCE_MS) {
          finalizePhrase()
        }
      }
      rafRef.current = requestAnimationFrame(() => tickRef.current())
    }
  }, [finalizePhrase])

  const start = useCallback(async () => {
    // Already running — no-op.
    if (!stoppedRef.current) return
    setError(null)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      // Permission denied / no device — surface a typed error, never throw to render.
      setError(
        appError(
          'UNKNOWN',
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Microphone access was blocked. Allow it in your browser to dictate.'
            : "Couldn't start the microphone.",
          e,
        ),
      )
      setStatus('error')
      return
    }

    stoppedRef.current = false
    streamRef.current = stream

    // Build the audio graph: source → analyser (silence gate) and source → processor
    // (PCM accumulation). The processor must also connect to the destination for its
    // onaudioprocess to fire in some engines; it emits silence, so output is inaudible.
    try {
      const Ctx: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      audioCtxRef.current = ctx
      sampleRateRef.current = ctx.sampleRate

      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyserRef.current = analyser

      const processor = ctx.createScriptProcessor(PROCESSOR_BUFFER, 1, 1)
      processor.onaudioprocess = (ev: AudioProcessingEvent) => {
        if (stoppedRef.current) return
        // Copy channel 0 — the event buffer is reused across calls, so clone it.
        const input = ev.inputBuffer.getChannelData(0)
        chunksRef.current.push(new Float32Array(input))
      }
      source.connect(processor)
      processor.connect(ctx.destination)
      processorRef.current = processor
    } catch (e) {
      setError(appError('UNKNOWN', "Couldn't start audio capture.", e))
      setStatus('error')
      teardown()
      return
    }

    setStatus('listening')
    rafRef.current = requestAnimationFrame(() => tickRef.current())
  }, [teardown])

  // Full cleanup on unmount.
  useEffect(() => teardown, [teardown])

  return { status, error, start, stop }
}
