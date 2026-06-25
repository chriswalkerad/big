'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, Sparkles, X } from 'lucide-react'
import type {
  Document,
  Project,
  ReviewResult,
  RoutingDestination,
  SignalDef,
  SubmissionStatus,
  SubmittedSnapshot,
  TextSubtype,
} from '@/types'
import { type AppError, appError } from '@/lib/errors'
import { createStorageRepository, type StorageRepository } from '@/lib/storage'
import { requestReview } from '@/lib/review-client'
import { requestApply } from '@/lib/apply-client'
import { htmlToText, textToHtml } from '@/lib/doc-body'
import {
  ROUTING_LABELS,
  applyApprove,
  applyManualSubtype,
  applyReviewerStatus,
  applySubmit,
  applyUnsubmit,
  hasDrift,
  inlineSignalIdSet,
  toHighlightIssues,
} from '@/lib/doc-page'
import { cn } from '@/lib/utils'
import { AppBreadcrumb } from '@/components/app-breadcrumb'
import { ContextChip } from '@/components/context-chip'
import { StatusChip } from '@/components/status-chip'
import { SubtypeChip } from '@/components/subtype-chip'
import { SubtypeSelect } from '@/components/subtype-select'
import { ReviewerStatusControl } from '@/components/reviewer-status-control'
import { CopyLinkButton } from '@/components/copy-link-button'
import { DriftIndicator } from '@/components/drift-indicator'
import { ResultsPanel } from '@/components/results-panel'
import { FranchiseDetail } from '@/components/franchise-detail'
import { SubmissionCelebration } from '@/components/celebration/submission-celebration'
import { LoadingState } from '@/components/loading-state'
import { ErrorState } from '@/components/error-state'
import {
  DocumentCanvas,
  type DocumentCanvasHandle,
} from '@/components/editor/DocumentCanvas'

export type DocumentPageMode = 'edit' | 'read'

interface DocumentPageProps {
  projectId: string
  docId: string
  mode: DocumentPageMode
}

/**
 * The single document page, in two modes:
 *   - `edit`  — the author's live working copy, with Submit / Resubmit / Unsubmit.
 *   - `read`  — the reviewer's view of the submitted snapshot (body + review),
 *               read-only, with reviewer status actions and a copy-link.
 * Loads the doc/signals/project from StorageRepository on mount and persists every
 * mutation through it.
 */
export function DocumentPage({ projectId, docId, mode }: DocumentPageProps) {
  const isRead = mode === 'read'
  const repoRef = useRef<StorageRepository | null>(null)
  const canvasRef = useRef<DocumentCanvasHandle | null>(null)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  // Set true around a PROGRAMMATIC `setContent` (Apply rewrite / Discard restore) so
  // the resulting onChange — which mirrors body state — does NOT also clear the Apply
  // decision the way a genuine keystroke does. Reset on the next change.
  const programmaticContentRef = useRef(false)
  // The last body text the editor reported, used to ignore text-identical internal
  // editor transactions (focus/selection churn) so they don't clear preview/decision
  // state. Kept as a ref so it tracks the latest value without re-render churn.
  const bodyRef = useRef('')
  // The inline results panel (right column). Held so Run review can scroll the freshly
  // revealed feedback into view while the editor + author text stay visible.
  const resultsPanelRef = useRef<HTMLElement | null>(null)

  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<AppError | null>(null)

  const [doc, setDoc] = useState<Document | null>(null)
  const [signals, setSignals] = useState<SignalDef[]>([])
  const [project, setProject] = useState<Project | null>(null)

  // Live working state (edit mode mutates these before persisting on key events).
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('') // plain text
  const [subtype, setSubtype] = useState<TextSubtype>('story_premise')
  const [subtypeSource, setSubtypeSource] = useState<'auto' | 'user'>('auto')
  const [status, setStatus] = useState<SubmissionStatus>('draft')
  const [routing, setRouting] = useState<RoutingDestination | undefined>(undefined)
  const [snapshot, setSnapshot] = useState<SubmittedSnapshot | undefined>(undefined)

  // Review state.
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState<AppError | null>(null)
  const [focusedSignalId, setFocusedSignalId] = useState<string | null>(null)
  const [franchiseOpen, setFranchiseOpen] = useState(false)
  // The GREENLIGHT celebration plays the instant a submission is confirmed.
  const [celebrating, setCelebrating] = useState(false)
  // On narrow screens the drawer is collapsible (it stacks below the editor). Open by
  // default so its metadata + review are visible; the toggle only exists below `lg`,
  // where the fixed-drawer layout does not apply.
  const [drawerOpen, setDrawerOpen] = useState(true)

  // Review-then-confirm preview: a freshly run review held for the author to read
  // BEFORE the doc is submitted. `pendingReview` is the result; `pendingBody` is the
  // exact (plain-text) body it was run against. While set, nothing has been committed —
  // no snapshot, no status change, no prefill — until `confirmSubmission` runs. Cleared
  // when the author edits the body (the preview no longer matches) or on confirm.
  const [pendingReview, setPendingReview] = useState<ReviewResult | null>(null)
  const [pendingBody, setPendingBody] = useState<string | null>(null)

  // --- AI rewrite ("Apply") state --------------------------------------------
  // `applying` is true while the rewrite request is in flight: the editor surface
  // shows a dim "Rewriting…" overlay and is made non-editable. On success the canvas
  // is replaced with the rewritten text and we enter an "awaiting decision" state —
  // an Accept / Discard bar over the editor. `preApplyBody` holds the EXACT body
  // captured BEFORE the request so Discard can restore it verbatim. Editing while a
  // decision is pending clears it (the rewrite is implicitly accepted-in-place).
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<AppError | null>(null)
  const [preApplyBody, setPreApplyBody] = useState<string | null>(null)
  const [awaitingDecision, setAwaitingDecision] = useState(false)

  // --- Load on mount ---------------------------------------------------------
  // localStorage is client-only and unavailable during SSR, so the document is loaded
  // from StorageRepository in a mount effect and synced into React state — the
  // canonical "synchronize with an external system" use of an effect. The setState
  // calls run exactly once per (docId, projectId, mode); there is no cascade, so the
  // set-state-in-effect rule is intentionally suppressed for this block.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const repo = createStorageRepository()
    repoRef.current = repo
    const found = repo.getDocument(docId)
    if (!found) {
      setLoadError(appError('DOC_NOT_FOUND'))
      setLoaded(true)
      return
    }
    setDoc(found)
    setSignals(repo.listSignals())
    setProject(repo.getProject(found.projectId) ?? repo.getProject(projectId))
    setTitle(found.title)
    setBody(found.body)
    bodyRef.current = found.body
    setSubtype(found.subtype)
    setSubtypeSource(found.subtypeSource)
    setStatus(found.status)
    setRouting(found.routing)
    setSnapshot(found.submittedSnapshot)
    setLoaded(true)
  }, [docId, projectId, mode])
  /* eslint-enable react-hooks/set-state-in-effect */

  const inlineIds = useMemo(() => inlineSignalIdSet(signals), [signals])

  // After load, render the existing snapshot's inline squiggles onto the canvas. This
  // is a DOM/external sync (no React state), and the editor handle initializes
  // asynchronously, so we retry on a few animation frames until it is ready.
  const snapshotReview = snapshot?.review
  useEffect(() => {
    if (!loaded || !snapshotReview) return
    let frames = 0
    let raf = 0
    const apply = () => {
      const handle = canvasRef.current
      if (handle) {
        handle.setSignalHighlights(toHighlightIssues(snapshotReview.signals, inlineIds))
        return
      }
      if (frames++ < 30) raf = requestAnimationFrame(apply)
    }
    raf = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(raf)
  }, [loaded, snapshotReview, inlineIds])

  // --- Persistence -----------------------------------------------------------
  // Persist a partial patch (used for small field edits like title/subtype).
  const persist = useCallback(
    (patch: Partial<Document>): Document | null => {
      const repo = repoRef.current
      const current = doc
      if (!repo || !current) return null
      const next: Document = { ...current, ...patch, updatedAt: new Date().toISOString() }
      repo.saveDocument(next)
      setDoc(next)
      return next
    },
    [doc],
  )

  // Commit a full next Document (from a transition reducer): persist it and sync every
  // mirrored working field so the UI reflects the new document atomically.
  const commitDoc = useCallback((next: Document) => {
    const repo = repoRef.current
    if (!repo) return
    const stamped: Document = { ...next, updatedAt: new Date().toISOString() }
    repo.saveDocument(stamped)
    setDoc(stamped)
    setTitle(stamped.title)
    setBody(stamped.body)
    bodyRef.current = stamped.body
    setSubtype(stamped.subtype)
    setSubtypeSource(stamped.subtypeSource)
    setStatus(stamped.status)
    setRouting(stamped.routing)
    setSnapshot(stamped.submittedSnapshot)
  }, [])

  // --- Read mode: render the snapshot, not the live body ---------------------
  // The results panel reflects, in priority order: a pending preview review (edit mode,
  // not yet confirmed), otherwise the submitted snapshot's review (computed on submit,
  // never live). Edits don't touch the snapshot; they clear the preview.
  const displayReview: ReviewResult | null =
    (!isRead && pendingReview) || snapshot?.review || null
  const displayBody = isRead ? (snapshot?.body ?? body) : body

  // The HTML content fed to the canvas. In read mode it is the snapshot body; in edit
  // mode it is the loaded body once (the editor owns edits thereafter).
  const initialContent = useMemo(
    () => textToHtml(displayBody),
    // Recompute only when the source body identity changes (load / mode), not on
    // every keystroke — the editor is uncontrolled after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isRead ? snapshot?.body : doc?.id, isRead],
  )

  // --- Bidirectional focus ---------------------------------------------------
  // Squiggle click → focus the matching panel row (the row scrolls itself into view).
  const handleHighlightClick = useCallback((signalId: string) => {
    setFocusedSignalId(signalId)
  }, [])

  // Panel phrase click → scroll to + emphasise the squiggle in the canvas.
  const handlePhraseClick = useCallback((signalId: string, quote: string) => {
    setFocusedSignalId(signalId)
    const root = editorContainerRef.current
    if (!root) return
    const candidates = root.querySelectorAll<HTMLElement>(
      `.signal-highlight[data-signal-id="${CSS.escape(signalId)}"]`,
    )
    let target: HTMLElement | null = null
    candidates.forEach((el) => {
      if (!target && (el.textContent ?? '').trim() === quote.trim()) target = el
    })
    if (!target && candidates.length > 0) target = candidates[0]
    if (target) {
      const el = target as HTMLElement
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      el.classList.add('signal-highlight--focus')
      window.setTimeout(() => el.classList.remove('signal-highlight--focus'), 1600)
    }
  }, [])

  // --- Apply prompt (AI rewrite) ---------------------------------------------
  // The "Apply" button in the review summary hands the review's suggested prompt to an
  // AI rewrite of the current body (POST /api/apply). The flow:
  //   1. capture the CURRENT body as `preApplyBody` (so Discard can restore it),
  //   2. flip `applying` → editor overlay (dim scrim + "Rewriting…") + non-editable,
  //   3. on success: replace the canvas with the rewritten text and enter
  //      `awaitingDecision` (the Accept / Discard bar),
  //   4. on failure: surface a typed error and leave the body untouched.
  const handleApplyPrompt = useCallback(async () => {
    const instruction = displayReview?.suggestedPrompt
    if (!instruction || !project || applying) return
    // Capture the CURRENT body (via the ref, which always reflects the latest editor
    // text) so Discard can restore it verbatim even if onChange churns meanwhile.
    const before = bodyRef.current
    setPreApplyBody(before)
    setApplyError(null)
    setApplying(true)

    const result = await requestApply({ text: htmlToText(before), instruction, project })

    if (!result.ok) {
      setApplyError(result.error)
      setApplying(false)
      setPreApplyBody(null)
      return
    }

    // Replace the document with the rewrite (emits onChange → body state syncs), then
    // await the author's Accept / Discard decision. Mark the replacement programmatic
    // so its onChange doesn't immediately dismiss the decision we're about to set.
    programmaticContentRef.current = true
    canvasRef.current?.setContent(textToHtml(result.data.text))
    setApplying(false)
    setAwaitingDecision(true)
  }, [displayReview, project, applying])

  // Accept the rewrite: keep the new body (already live in the editor + body state),
  // drop the now-stale review preview + squiggles (the reviewed text changed). If the
  // doc had a submitted snapshot, clear it too — the snapshot was reviewed against the
  // pre-rewrite text — committing the rewrite as the new draft body so state, storage
  // and the editor all agree.
  const acceptRewrite = useCallback(() => {
    setAwaitingDecision(false)
    setPreApplyBody(null)
    setApplyError(null)
    setPendingReview(null)
    setPendingBody(null)
    canvasRef.current?.setSignalHighlights([])
    if (doc && snapshot) {
      // applyUnsubmit clears the snapshot + routing and returns to draft; pair it with
      // the rewritten body so we don't revert to the old persisted text.
      commitDoc({ ...applyUnsubmit(doc), body: bodyRef.current })
    }
  }, [doc, snapshot, commitDoc])

  // Discard the rewrite: restore the captured pre-apply body verbatim and exit the
  // decision state. The restore re-emits onChange so body state matches the editor.
  const discardRewrite = useCallback(() => {
    if (preApplyBody !== null) {
      programmaticContentRef.current = true
      canvasRef.current?.setContent(textToHtml(preApplyBody))
    }
    setAwaitingDecision(false)
    setPreApplyBody(null)
    setApplyError(null)
  }, [preApplyBody])

  // --- Run review auto-scroll ------------------------------------------------
  // Bring the right-side results panel into view when a review run begins / lands, so
  // feedback no longer hides behind a bottom sheet — the editor + the author's text
  // stay visible while they read. On desktop the panel is sticky beside the editor, so
  // this matters most on narrow screens where the panel sits below the editor.
  const scrollResultsIntoView = useCallback(() => {
    const el = resultsPanelRef.current
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [])

  // --- Review preview (step 1 of review-then-confirm) ------------------------
  // The edit-mode primary action (button / Resubmit / Cmd+Enter) runs the AI review of
  // the current body and shows it in the right panel with inline squiggles, but DOES NOT
  // submit: no snapshot, no status change, no prefill. The result is held as a pending
  // preview for the author to read; they may edit (which clears the preview) and re-run,
  // or confirm to commit. The submit transition itself lives in `confirmSubmission`.
  const runReview = useCallback(async () => {
    const current = doc
    if (!repoRef.current || !current || !project) return
    const text = htmlToText(body)
    setReviewError(null)
    setReviewLoading(true)
    setFocusedSignalId(null)
    // Reveal the panel's loading state immediately (next frame, after it mounts/paints).
    requestAnimationFrame(scrollResultsIntoView)

    const result = await requestReview({ text, project, signals })
    if (!result.ok) {
      setReviewError(result.error)
      setReviewLoading(false)
      requestAnimationFrame(scrollResultsIntoView)
      return
    }

    const review = result.data
    setReviewLoading(false)
    // Hold the preview (result + exact reviewed body); nothing is committed yet.
    setPendingReview(review)
    setPendingBody(text)
    // Keep the feedback in view now that the verdict + rows have rendered.
    requestAnimationFrame(scrollResultsIntoView)

    // Render inline squiggles for the previewed body.
    canvasRef.current?.setSignalHighlights(toHighlightIssues(review.signals, inlineIds))
  }, [body, doc, project, signals, inlineIds, scrollResultsIntoView])

  // --- Confirm submission (step 2 of review-then-confirm) --------------------
  // Commit the pending preview: build the working doc from live fields with the exact
  // reviewed body, apply the submit transition (sets/replaces the snapshot, prefills,
  // advances the status), persist, render squiggles from the committed review, and clear
  // the preview. This is exactly the old one-step submit behaviour, now gated behind the
  // author reading the review first.
  const confirmSubmission = useCallback(() => {
    const current = doc
    if (!current || !pendingReview || pendingBody === null) return
    const review = pendingReview
    const text = pendingBody
    const working: Document = {
      ...current,
      title,
      body: text,
      subtype,
      subtypeSource,
      status,
    }
    const next = applySubmit(working, { body: text, review, submittedAt: new Date().toISOString() })
    commitDoc(next)

    // Render inline squiggles for the freshly submitted body, then clear the preview.
    canvasRef.current?.setSignalHighlights(toHighlightIssues(review.signals, inlineIds))
    setPendingReview(null)
    setPendingBody(null)
    // 🎬 The WOOOO moment — the studio just greenlit the submission.
    setCelebrating(true)
  }, [doc, pendingReview, pendingBody, title, subtype, subtypeSource, status, commitDoc, inlineIds])

  // --- Unsubmit (manual only) ------------------------------------------------
  const handleUnsubmit = useCallback(() => {
    const current = doc
    if (!current) return
    setFocusedSignalId(null)
    setPendingReview(null)
    setPendingBody(null)
    canvasRef.current?.setSignalHighlights([])
    commitDoc(applyUnsubmit(current))
  }, [doc, commitDoc])

  // --- Reviewer actions ------------------------------------------------------
  const handleReviewerStatus = useCallback(
    (next: SubmissionStatus) => {
      if (!doc) return
      commitDoc(applyReviewerStatus(doc, next))
    },
    [doc, commitDoc],
  )

  const handleApprove = useCallback(
    (destination: RoutingDestination) => {
      if (!doc) return
      commitDoc(applyApprove(doc, destination))
    },
    [doc, commitDoc],
  )

  // --- Editor change ---------------------------------------------------------
  // Editing invalidates any pending review preview (it no longer matches the body), so
  // the author must re-run the review before they can confirm. Squiggles already clear
  // on edit inside the canvas. Functional updaters keep this handler dependency-free.
  //
  // Editing also resolves a pending Apply decision: the author has moved on from the
  // raw rewrite, so the Accept / Discard bar is dismissed (the rewrite stays in place).
  //
  // The editor fires `onUpdate` not only for keystrokes but also for internal,
  // text-IDENTICAL transactions (selection/focus churn around the Apply click and the
  // programmatic `setContent`). Acting on those would wrongly clear the preview or the
  // pre-apply body. So we treat a change as a GENUINE edit only when (a) it is not a
  // programmatic `setContent`, AND (b) its text actually differs from the body we last
  // held (`bodyRef`). Only then do we invalidate the review preview and dismiss any
  // pending Apply decision.
  const handleBodyChange = useCallback((html: string) => {
    const nextText = htmlToText(html)
    if (programmaticContentRef.current) {
      // Apply/Discard `setContent` — mirror the body; the caller owns decision state.
      programmaticContentRef.current = false
      bodyRef.current = nextText
      setBody(nextText)
      return
    }
    if (nextText === bodyRef.current) {
      // A text-identical internal transaction — nothing actually changed.
      return
    }
    bodyRef.current = nextText
    setBody(nextText)
    setPendingReview((prev) => (prev ? null : prev))
    setPendingBody((prev) => (prev ? null : prev))
    setAwaitingDecision((prev) => (prev ? false : prev))
    setPreApplyBody((prev) => (prev !== null ? null : prev))
    setApplyError((prev) => (prev ? null : prev))
  }, [])

  // --- Keyboard: Cmd/Ctrl+Enter = Submit (edit mode) -------------------------
  useEffect(() => {
    if (isRead) return
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (!reviewLoading) void runReview()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isRead, reviewLoading, runReview])

  // --- Render guards ---------------------------------------------------------
  if (!loaded) {
    return <LoadingState rows={5} className="mt-8" label="Loading document…" />
  }
  if (loadError || !doc || !project) {
    return (
      <ErrorState
        error={loadError ?? appError('DOC_NOT_FOUND')}
        title="Document unavailable"
        className="mt-8"
      />
    )
  }

  const drift = !isRead && hasDrift(body, snapshot)
  const reviewUrl = `/p/${projectId}/d/${docId}/review`
  const audienceShort = shortAudience(project.audience)

  return (
    <div className="document-page flex flex-col gap-4">
      {/* Sticky breadcrumb — sits just under the h-14 app header over the app-canvas bg,
          so page navigation stays put while the editor and drawer scroll. The breadcrumb
          component itself is restyled by a sibling agent; we only own this sticky bar. */}
      <div className="sticky top-14 z-30 -mx-4 bg-app-canvas px-4 py-2 sm:-mx-6 sm:px-6">
        <AppBreadcrumb
          segments={[
            { label: project.name, href: `/p/${projectId}` },
            { label: title || 'Untitled', current: true },
          ]}
          className="min-w-0"
        />
      </div>

      {/* On `lg+` the metadata + review live in a single FIXED drawer pinned to the right
          of the content column; the editor column (`.document-main-col`) reserves right
          margin so nothing overlaps. Below `lg` the drawer returns to normal flow and
          stacks below the editor (collapsible). */}
      <div className="flex flex-col gap-4">
        {/* LEFT — the writing surface. A "paper on a desk": the gray desk frames a white
            paper sheet, now rendered as stacked page sheets (editor.css) so long content
            visually breaks across pages. The desk/paper backgrounds are theme-aware
            tokens (.document-desk / .document-paper). Applied to edit and read alike. */}
        <div
          ref={editorContainerRef}
          className="document-main-col document-desk order-1 rounded-card p-4 sm:p-6"
        >
          <div className="document-paper document-paper--pages relative mx-auto max-w-3xl rounded-card border border-border p-6 shadow-lg sm:p-8">
            <DocumentCanvas
              ref={canvasRef}
              mode={mode}
              // Lock the surface while an AI rewrite is in flight.
              editable={isRead ? false : !applying}
              content={initialContent}
              onChange={isRead ? undefined : handleBodyChange}
              onHighlightClick={handleHighlightClick}
            />

            {/* AI-rewrite in-flight scrim: dims the paper with a spinner + "Rewriting…".
                The editor is also made non-editable while `applying` (see DocumentCanvas
                `editable`). */}
            {applying ? (
              <div
                className="document-apply-overlay"
                role="status"
                aria-live="polite"
                aria-label="Rewriting"
              >
                <Loader2 className="size-6 animate-spin text-text-secondary" aria-hidden="true" />
                <span className="text-label-sm font-medium text-text-primary">Rewriting…</span>
              </div>
            ) : null}

            {/* Accept / Discard the AI rewrite. Shown after a successful Apply until the
                author decides (or edits). Accept keeps the rewrite; Discard restores the
                exact pre-apply body. */}
            {awaitingDecision ? (
              <div
                role="group"
                aria-label="Review the rewrite"
                className={cn(
                  'absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-center justify-between gap-2',
                  'rounded-card border border-border bg-surface px-3 py-2 shadow-lg',
                )}
              >
                <span className="text-label-sm text-text-secondary">
                  Rewrite applied — keep it?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={discardRewrite}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-label-sm text-text-secondary',
                      'transition-colors hover:bg-panel hover:text-text-primary',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    )}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={acceptRewrite}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-control bg-accent px-2.5 text-label-sm font-medium text-bg',
                      'transition-[transform,opacity] hover:opacity-90 active:scale-[0.98]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    )}
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                    Accept
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* A failed rewrite surfaces a typed error below the paper (never silent). */}
          {applyError ? (
            <div className="mx-auto mt-3 max-w-3xl">
              <ErrorState error={applyError} title="Rewrite failed" />
            </div>
          ) : null}

          {/* Mobile-only toggle for the stacked drawer (the fixed layout takes over at lg). */}
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-expanded={drawerOpen}
            className={cn(
              'mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-control border border-border bg-surface px-3 text-label-sm text-text-secondary lg:hidden',
              'transition-colors hover:bg-panel hover:text-text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            {drawerOpen ? 'Hide details & review' : 'Show details & review'}
          </button>
        </div>

        {/* THE DRAWER — one bordered surface: metadata (top), divider, then review. On
            lg it is FIXED to the right with an internally scrolling body; below lg it
            stacks here and is collapsible via the toggle above. */}
        <aside
          aria-label="Document details and review"
          className={cn(
            'document-drawer order-2 rounded-card border border-border bg-surface',
            !drawerOpen && 'hidden lg:flex',
          )}
        >
          <div className="document-drawer-scroll flex flex-col">
            {/* Metadata + controls. */}
            <div className="flex flex-col gap-3 p-4">
              <ContextChip
                name={project.name}
                audience={audienceShort}
                className="self-start"
              />

              <div className="flex flex-wrap items-center gap-2">
                {isRead ? (
                  <ReviewerStatusControl
                    status={status}
                    routing={routing}
                    onStatusChange={handleReviewerStatus}
                    onApprove={handleApprove}
                  />
                ) : (
                  <StatusChip status={status} />
                )}
                {isRead ? <CopyLinkButton url={reviewUrl} /> : null}
              </div>

              {isRead && routing ? <RoutedNote destination={routing} /> : null}

              {!isRead ? (
                <button
                  type="button"
                  onClick={() => void runReview()}
                  disabled={reviewLoading}
                  className={cn(
                    'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-control bg-accent px-3 text-label-sm font-medium text-bg',
                    'transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  )}
                >
                  {reviewLoading ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="size-3.5" aria-hidden="true" />
                  )}
                  {reviewLoading ? 'Reviewing…' : 'Run review'}
                </button>
              ) : null}

              <div className="flex flex-col gap-2 border-t border-border pt-3">
                {isRead ? (
                  <h1 className="text-doc-title text-text-primary">{title || 'Untitled'}</h1>
                ) : (
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => persist({ title })}
                    placeholder="Untitled"
                    aria-label="Title"
                    className={cn(
                      'w-full bg-transparent text-doc-title text-text-primary placeholder:text-text-tertiary',
                      'focus:outline-none',
                    )}
                  />
                )}
                <div className="flex items-center gap-2">
                  {isRead ? (
                    <SubtypeChip subtype={subtype} />
                  ) : (
                    <SubtypeSelect
                      value={subtype}
                      onChange={(next) => {
                        if (doc) {
                          commitDoc(
                            applyManualSubtype({ ...doc, title, body, subtype, subtypeSource }, next),
                          )
                        }
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Drift indicator (edit mode). */}
              {drift ? (
                <DriftIndicator
                  busy={reviewLoading}
                  onResubmit={() => void runReview()}
                  onUnsubmit={handleUnsubmit}
                />
              ) : null}
            </div>

            {/* Divider between the metadata block and the review section. The review
                section (ResultsPanel) renders NOTHING until there is a review, a run in
                flight, or an error — so the divider only reads as a seam once feedback
                exists. */}
            {displayReview || reviewLoading || reviewError ? (
              <div className="border-t border-border" />
            ) : null}

            {/* Review section — the second half of the single drawer. */}
            <ResultsPanel
              ref={resultsPanelRef}
              loading={reviewLoading}
              error={reviewError}
              review={displayReview}
              signals={signals}
              focusedSignalId={focusedSignalId}
              pending={!isRead && pendingReview !== null}
              onRetry={() => void runReview()}
              onConfirm={confirmSubmission}
              onPhraseClick={handlePhraseClick}
              onFranchiseClick={() => setFranchiseOpen(true)}
              onApplyPrompt={isRead ? undefined : handleApplyPrompt}
              applying={applying}
            />
          </div>
        </aside>
      </div>

      <FranchiseDetail project={project} open={franchiseOpen} onClose={() => setFranchiseOpen(false)} />

      <SubmissionCelebration
        show={celebrating}
        onDone={() => setCelebrating(false)}
        title={title || 'Untitled'}
      />
    </div>
  )
}

function RoutedNote({ destination }: { destination: RoutingDestination }) {
  return (
    <p className="text-label-sm text-text-tertiary">
      Routed to <span className="text-text-secondary">{ROUTING_LABELS[destination]}</span>.
    </p>
  )
}

/** Trim the long seed audience string to the short chip form. */
function shortAudience(audience: string): string {
  const match = audience.match(/(kids?\s*\d+\s*-\s*\d+)/i)
  return match ? capitalize(match[1]) : audience
}
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
