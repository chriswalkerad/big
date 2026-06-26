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
  // SYNCHRONOUS "a start/restart is in flight" latch. `stoppedRef` only flips false AFTER
  // the awaited token mint + SDK import, so it can't gate a re-entrant start() during those
  // awaits; this ref does. Set true synchronously before any await, cleared on teardown and
  // once a recognizer is live. Guarantees exactly one recognizer + one mic capture.
  const startingRef = useRef(false)
  // The lazily-imported SDK, cached so a mid-session restart doesn't re-import.
  const sdkRef = useRef<SpeechSdk | null>(null)
  // Indirection for buildAndStart's self-restart (auth-cancel path), so the callback can
  // reference itself without a use-before-declaration cycle.
  const buildAndStartRef = useRef<(() => Promise<boolean>) | null>(null)

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
  // `keepStarting` leaves the in-flight latch set so a restart can rebuild without a
  // concurrent start() slipping in between the dead session's teardown and the new one.
  const teardown = useCallback((keepStarting = false) => {
    stoppedRef.current = true
    if (!keepStarting) startingRef.current = false
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

  // Build a fresh recognizer around a freshly-minted token and start continuous
  // recognition. Used both for the initial start() and for the restart triggered when an
  // auth/forbidden cancellation kills the session. Assumes the in-flight latch is held and
  // any prior session has already been torn down. Returns true once recognition is wired.
  const buildAndStart = useCallback((): Promise<boolean> => {
    const sdk = sdkRef.current
    if (!sdk) return Promise.resolve(false)
    const {
      SpeechConfig,
      AudioConfig,
      SpeechRecognizer,
      ResultReason,
      CancellationReason,
      CancellationErrorCode,
    } = sdk

    return requestSpeechToken().then((tokenResult) => {
      if (!tokenResult.ok) {
        setError(tokenResult.error)
        setStatus('error')
        teardown()
        return false
      }
      const { token, region } = tokenResult.data

      stoppedRef.current = false

      let recognizer: SpeechRecognizer
      try {
        const speechConfig = SpeechConfig.fromAuthorizationToken(token, region)
        speechConfig.speechRecognitionLanguage = 'en-US'
        const audioConfig = AudioConfig.fromDefaultMicrophoneInput()
        audioConfigRef.current = audioConfig
        recognizer = new SpeechRecognizer(speechConfig, audioConfig)
        recognizerRef.current = recognizer
      } catch (e) {
        setError(appError('UNKNOWN', "Couldn't start audio capture.", e))
        setStatus('error')
        teardown()
        return false
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

      // Cancellation. Only an actual error reason is surfaced; a normal end-of-stream is
      // not. An auth/forbidden code means the token expired and Azure has ALREADY torn down
      // this session — reassigning `authorizationToken` on the dead recognizer would not
      // resume anything. So fully RESTART: tear down the dead session and build a brand-new
      // recognizer around a fresh token. Only if that restart itself fails do we surface a
      // typed error.
      recognizer.canceled = (_, e) => {
        if (stoppedRef.current) return
        if (e.reason !== CancellationReason.Error) return

        const isAuth =
          e.errorCode === CancellationErrorCode.AuthenticationFailure ||
          e.errorCode === CancellationErrorCode.Forbidden

        if (isAuth) {
          // Hold the in-flight latch across the dead-session teardown + rebuild so a
          // concurrent start() can't double-init while we restart.
          startingRef.current = true
          teardown(true)
          void (buildAndStartRef.current?.() ?? Promise.resolve(false))
            .catch((restartErr) => {
              setError(toAppError(restartErr))
              setStatus('error')
              teardown()
              return false
            })
            .then((restarted) => {
              if (!restarted) startingRef.current = false
            })
          return
        }
        surfaceCancelError(e.errorDetails)
      }

      // Begin continuous recognition. On success, schedule periodic token refreshes so a
      // long session never drops; on failure (mic permission denied via AudioConfig, etc.)
      // surface a typed error.
      return new Promise<boolean>((resolve) => {
        recognizer.startContinuousRecognitionAsync(
          () => {
            if (stoppedRef.current) {
              resolve(false)
              return
            }
            setStatus('listening')
            // The session is live; the in-flight latch can drop — a subsequent start() is a
            // no-op via stoppedRef, and a restart re-arms the latch itself.
            startingRef.current = false
            refreshTimerRef.current = setInterval(() => {
              void requestSpeechToken().then((refreshed) => {
                const active = recognizerRef.current
                if (!stoppedRef.current && refreshed.ok && active) {
                  // Proactive refresh on a STILL-LIVE recognizer: reassigning the token in
                  // place is the correct, supported path (no restart needed here).
                  active.authorizationToken = refreshed.data.token
                }
              })
            }, TOKEN_REFRESH_MS)
            resolve(true)
          },
          (err: string) => {
            if (stoppedRef.current) {
              resolve(false)
              return
            }
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
            resolve(false)
          },
        )
      })
    })
  }, [teardown])
  // Keep the self-restart indirection pointed at the latest buildAndStart (set outside
  // render so refs aren't mutated during render).
  useEffect(() => {
    buildAndStartRef.current = buildAndStart
  }, [buildAndStart])

  const start = useCallback(async () => {
    // Already running, or a start/restart is already in flight — no-op. The synchronous
    // latch is what makes a rapid second start() (double-click / StrictMode double-invoke)
    // safe: stoppedRef stays true through the awaits below, so it alone can't gate re-entry.
    if (!stoppedRef.current || startingRef.current) return
    startingRef.current = true
    setError(null)

    // Lazy, client-only load of the SDK (SSR-safe, off the initial bundle), cached so a
    // later restart reuses it.
    if (!sdkRef.current) {
      try {
        sdkRef.current = await import('microsoft-cognitiveservices-speech-sdk')
      } catch (e) {
        setError(appError('UNKNOWN', "Couldn't load the speech recognizer.", e))
        setStatus('error')
        startingRef.current = false
        return
      }
    }

    // A stop() during the awaited import wins: it clears the latch. If the latch is no
    // longer ours, abandon this start rather than resurrecting a torn-down session.
    if (!startingRef.current) return

    await buildAndStart()
  }, [buildAndStart])

  // Full cleanup on unmount.
  useEffect(() => () => teardown(), [teardown])

  return { status, error, start, stop }
}
