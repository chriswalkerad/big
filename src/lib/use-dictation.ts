'use client'

// Streaming voice dictation hook, backed by the Azure real-time Speech SDK. Mints a
// short-lived authorization token from /api/speech-token (the subscription key never
// leaves the server), then runs continuous recognition: interim hypotheses stream in
// live via `onInterim` (the FULL current hypothesis for the in-progress utterance —
// the editor ghosts it and replaces it in place as it refines), and each finalized
// utterance is reported once via `onFinal`. All SDK internals are encapsulated here;
// the consumer only sees `status`, `error`, and start/stop controls.
//
// The SDK is browser-only (it reaches for the microphone and Web Audio) and pulls in a
// large bundle, so it is imported LAZILY inside `start()` — never at module top — which
// keeps this module SSR-safe and off the initial client payload.

import { useCallback, useEffect, useRef, useState } from 'react'
import { type AppError, appError, toAppError } from '@/lib/errors'
import { requestSpeechToken } from '@/lib/speech-token-client'

export type DictationStatus = 'idle' | 'listening' | 'error'

export interface UseDictationOptions {
  /** A live interim hypothesis: the FULL current text for the in-progress utterance. */
  onInterim: (text: string) => void
  /** A finalized utterance: the settled text for one recognized phrase. */
  onFinal: (text: string) => void
}

export interface UseDictation {
  status: DictationStatus
  error: AppError | null
  start: () => Promise<void>
  stop: () => void
}

// Azure Speech authorization tokens are valid for ~10 minutes; refresh comfortably
// inside that window so a long dictation session never drops on token expiry.
const TOKEN_REFRESH_MS = 9 * 60 * 1000

// The SDK module type, derived from the dynamic import so we never name `any`.
type SpeechSdk = typeof import('microsoft-cognitiveservices-speech-sdk')
type SpeechRecognizer = InstanceType<SpeechSdk['SpeechRecognizer']>
type AudioConfig = InstanceType<SpeechSdk['AudioConfig']>

export function useDictation({ onInterim, onFinal }: UseDictationOptions): UseDictation {
  const [status, setStatus] = useState<DictationStatus>('idle')
  const [error, setError] = useState<AppError | null>(null)

  // SDK handles, kept in refs so they survive renders and can be torn down on
  // stop/unmount without re-triggering effects.
  const recognizerRef = useRef<SpeechRecognizer | null>(null)
  const audioConfigRef = useRef<AudioConfig | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Set true once stop()/teardown runs so post-stop SDK callbacks don't resurrect state.
  const stoppedRef = useRef(true)

  // Keep the latest callbacks without re-creating start/stop.
  const onInterimRef = useRef(onInterim)
  const onFinalRef = useRef(onFinal)
  useEffect(() => {
    onInterimRef.current = onInterim
  }, [onInterim])
  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  // Tear down every SDK resource and the refresh timer. Safe to call repeatedly.
  const teardown = useCallback(() => {
    stoppedRef.current = true
    if (refreshTimerRef.current !== null) {
      clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    const recognizer = recognizerRef.current
    recognizerRef.current = null
    if (recognizer) {
      try {
        recognizer.stopContinuousRecognitionAsync(
          () => {
            try {
              recognizer.close()
            } catch {
              // already closed
            }
          },
          () => {
            try {
              recognizer.close()
            } catch {
              // already closed
            }
          },
        )
      } catch {
        // ignore — best-effort teardown
      }
    }
    const audioConfig = audioConfigRef.current
    audioConfigRef.current = null
    if (audioConfig) {
      try {
        audioConfig.close()
      } catch {
        // already closed
      }
    }
  }, [])

  const stop = useCallback(() => {
    teardown()
    setStatus('idle')
  }, [teardown])

  const start = useCallback(async () => {
    // Already running — no-op.
    if (!stoppedRef.current) return
    setError(null)

    // Mint a short-lived token. A failure here (HTTP/network/not configured) is a typed
    // error — never a throw to render.
    const tokenResult = await requestSpeechToken()
    if (!tokenResult.ok) {
      setError(tokenResult.error)
      setStatus('error')
      return
    }
    const { region } = tokenResult.data

    // Lazy, client-only load of the SDK (SSR-safe, off the initial bundle).
    let sdk: SpeechSdk
    try {
      sdk = await import('microsoft-cognitiveservices-speech-sdk')
    } catch (e) {
      setError(appError('UNKNOWN', "Couldn't load the speech recognizer.", e))
      setStatus('error')
      return
    }
    const { SpeechConfig, AudioConfig, SpeechRecognizer, ResultReason, CancellationReason, CancellationErrorCode } = sdk

    stoppedRef.current = false

    let recognizer: SpeechRecognizer
    let audioConfig: AudioConfig
    try {
      const speechConfig = SpeechConfig.fromAuthorizationToken(tokenResult.data.token, region)
      speechConfig.speechRecognitionLanguage = 'en-US'
      audioConfig = AudioConfig.fromDefaultMicrophoneInput()
      audioConfigRef.current = audioConfig
      recognizer = new SpeechRecognizer(speechConfig, audioConfig)
      recognizerRef.current = recognizer
    } catch (e) {
      setError(appError('UNKNOWN', "Couldn't start audio capture.", e))
      setStatus('error')
      teardown()
      return
    }

    // Interim hypothesis — the full current text for the in-progress utterance.
    recognizer.recognizing = (_, e) => {
      if (stoppedRef.current) return
      if (e.result.text) onInterimRef.current(e.result.text)
    }

    // A finalized utterance.
    recognizer.recognized = (_, e) => {
      if (stoppedRef.current) return
      if (e.result.reason === ResultReason.RecognizedSpeech && e.result.text) {
        onFinalRef.current(e.result.text)
      }
    }

    // Cancellation. Only an actual error reason is surfaced; a normal end-of-stream is
    // not. An auth/forbidden code gets one token-refresh attempt before erroring (the
    // mic may simply have outlived its token).
    recognizer.canceled = (_, e) => {
      if (stoppedRef.current) return
      if (e.reason !== CancellationReason.Error) return

      const isAuth =
        e.errorCode === CancellationErrorCode.AuthenticationFailure ||
        e.errorCode === CancellationErrorCode.Forbidden

      if (isAuth) {
        // Try to refresh the token in place and keep going before giving up.
        void requestSpeechToken().then((refreshed) => {
          if (stoppedRef.current) return
          const active = recognizerRef.current
          if (refreshed.ok && active) {
            active.authorizationToken = refreshed.data.token
            return
          }
          surfaceCancelError(e.errorDetails)
        })
        return
      }
      surfaceCancelError(e.errorDetails)
    }

    function surfaceCancelError(details: string | undefined) {
      if (stoppedRef.current) return
      const hay = String(details ?? '').toLowerCase()
      const micBlocked =
        hay.includes('permission') || hay.includes('denied') || hay.includes('notallowed')
      setError(
        micBlocked
          ? appError(
              'UNKNOWN',
              'Microphone access was blocked. Allow it in your browser to dictate.',
              details,
            )
          : toAppError(new Error(details ?? 'Speech recognition was canceled.')),
      )
      setStatus('error')
      teardown()
    }

    // Begin continuous recognition. On success, schedule periodic token refreshes so a
    // long session never drops; on failure (mic permission denied via AudioConfig, etc.)
    // surface a typed error.
    recognizer.startContinuousRecognitionAsync(
      () => {
        if (stoppedRef.current) return
        setStatus('listening')
        refreshTimerRef.current = setInterval(() => {
          void requestSpeechToken().then((refreshed) => {
            const active = recognizerRef.current
            if (!stoppedRef.current && refreshed.ok && active) {
              active.authorizationToken = refreshed.data.token
            }
          })
        }, TOKEN_REFRESH_MS)
      },
      (err: string) => {
        if (stoppedRef.current) return
        const hay = String(err).toLowerCase()
        const micBlocked =
          hay.includes('permission') || hay.includes('denied') || hay.includes('notallowed')
        setError(
          appError(
            'UNKNOWN',
            micBlocked
              ? 'Microphone access was blocked. Allow it in your browser to dictate.'
              : "Couldn't start the microphone.",
            err,
          ),
        )
        setStatus('error')
        teardown()
      },
    )
  }, [teardown])

  // Full cleanup on unmount.
  useEffect(() => teardown, [teardown])

  return { status, error, start, stop }
}
