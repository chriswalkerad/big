'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, PanelRight, Sparkles, X } from 'lucide-react'
import type {
  Document,
  Person,
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
import { Button } from '@/components/button'
import { TopBar } from '@/components/top-bar'
import { ContextChip } from '@/components/context-chip'
import { StatusChip } from '@/components/status-chip'
import { SubtypeChip } from '@/components/subtype-chip'
import { SubtypeSelect } from '@/components/subtype-select'
import { ReviewerStatusControl } from '@/components/reviewer-status-control'
import { CopyLinkButton } from '@/components/copy-link-button'
import { DriftIndicator } from '@/components/drift-indicator'
import { ResultsPanel, ReviewStrip } from '@/components/results-panel'
import { FranchiseDetail } from '@/components/franchise-detail'
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
 *
 * Layout (Notion-minimal): a slim `<TopBar>` action line, then ONE continuous white
 * page — a centered column holding the title, meta, a slim review strip (minimal
 * default), and the borderless editor. The full review DETAIL lives in an INLINE
 * side panel that is part of the primary content area: when open, the content area
 * becomes a two-column layout (writing column + a ~380px detail panel beside it) and
 * the writing column reflows to make room — it is never covered. No scrim, no modal,
 * no focus trap; the editor stays fully interactive while the panel is open. The panel
 * slides in (~270ms, reduced-motion-safe), opened on demand or auto-opened when a
 * review completes. On mobile (<lg) the panel stacks below the writing column.
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
  // The review detail panel (slide-in). Held so Run review can move focus into the
  // freshly revealed feedback.
  const resultsPanelRef = useRef<HTMLElement | null>(null)

  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<AppError | null>(null)

  const [doc, setDoc] = useState<Document | null>(null)
  const [signals, setSignals] = useState<SignalDef[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [people, setPeople] = useState<Person[]>([])

  // Live working state (edit mode mutates these before persisting on key events).
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('') // plain text
  const [subtype, setSubtype] = useState<TextSubtype>('story_premise')
  const [subtypeSource, setSubtypeSource] = useState<'auto' | 'user'>('auto')
  const [status, setStatus] = useState<SubmissionStatus>('draft')
  const [routing, setRouting] = useState<RoutingDestination | undefined>(undefined)
  const [snapshot, setSnapshot] = useState<SubmittedSnapshot | undefined>(undefined)
  // The reviewer recorded on the document (set at submission; drafts have none).
  const [reviewer, setReviewer] = useState<Person | undefined>(undefined)

  // Review state.
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState<AppError | null>(null)
  const [focusedSignalId, setFocusedSignalId] = useState<string | null>(null)
  const [franchiseOpen, setFranchiseOpen] = useState(false)
  // The expandable review detail panel. Minimal by default (false) — the slim strip
  // is shown inline; the panel opens on demand ("View signals" / squiggle click) or
  // auto-opens when a review completes (see runReview).
  const [panelOpen, setPanelOpen] = useState(false)

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
    setPeople(repo.listPeople())
    setProject(repo.getProject(found.projectId) ?? repo.getProject(projectId))
    setTitle(found.title)
    setBody(found.body)
    bodyRef.current = found.body
    setSubtype(found.subtype)
    setSubtypeSource(found.subtypeSource)
    setStatus(found.status)
    setRouting(found.routing)
    setSnapshot(found.submittedSnapshot)
    setReviewer(found.reviewer)
    setLoaded(true)
  }, [docId, projectId, mode])
  /* eslint-enable react-hooks/set-state-in-effect */

  const inlineIds = useMemo(() => inlineSignalIdSet(signals), [signals])

  // When the detail panel opens, move focus into it so keyboard/SR users land on the
  // freshly revealed review (and Esc-to-close has a sensible focus origin). This is a
  // one-time focus MOVE, not a trap — the editor and the rest of the page stay fully
  // reachable. The panel region is focusable via tabIndex={-1} on the ResultsPanel
  // section's ref node.
  useEffect(() => {
    if (!panelOpen) return
    const node = resultsPanelRef.current
    if (node && typeof node.focus === 'function') {
      node.focus({ preventScroll: true })
    }
  }, [panelOpen])

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
    setReviewer(stamped.reviewer)
  }, [])

  // --- Read mode: render the snapshot, not the live body ---------------------
  // The results reflect, in priority order: a pending preview review (edit mode, not
  // yet confirmed), otherwise the submitted snapshot's review (computed on submit,
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
  // Squiggle click → open the detail panel (if closed) and focus the matching row.
  const handleHighlightClick = useCallback((signalId: string) => {
    setFocusedSignalId(signalId)
    setPanelOpen(true)
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
  // The "Apply" affordance hands the review's suggested prompt to an AI rewrite of the
  // current body (POST /api/apply). The flow:
  //   1. capture the CURRENT body as `preApplyBody` (so Discard can restore it),
  //   2. flip `applying` → editor overlay (dim scrim + "Rewriting…") + non-editable,
  //   3. on success: replace the canvas with the rewritten text and enter
  //      `awaitingDecision` (the Accept / Discard bar),
  //   4. on failure: surface a typed error and leave the body untouched.
  const handleApplyPrompt = useCallback(async () => {
    const instruction = displayReview?.suggestedPrompt
    if (!instruction || !project || applying || awaitingDecision) return
    // Capture the CURRENT body (via the ref, which always reflects the latest editor
    // text) so Discard can restore it verbatim even if onChange churns meanwhile.
    const before = bodyRef.current
    setPreApplyBody(before)
    setApplyError(null)
    setApplying(true)

    // `before` is already PLAIN text (body state is plain text), so send it as-is —
    // re-running htmlToText here would double-decode entity-like substrings.
    const result = await requestApply({ text: before, instruction, project })

    if (!result.ok) {
      setApplyError(result.error)
      setApplying(false)
      setPreApplyBody(null)
      return
    }

    // Replace the document with the rewrite, then await the author's Accept / Discard
    // decision. Reset the `programmatic` flag IMMEDIATELY after setContent (which
    // dispatches its onChange synchronously) so it can never stick when the rewrite
    // equals the current text and Tiptap suppresses the update — a stuck flag would
    // swallow the author's next keystroke. The review PREVIEW was computed against the
    // pre-rewrite text, so drop it: confirm is gated on a pending preview, and the
    // author re-runs review on the rewrite (or after Discard).
    const next = result.data.text
    programmaticContentRef.current = true
    canvasRef.current?.setContent(textToHtml(next))
    programmaticContentRef.current = false
    bodyRef.current = next
    setBody(next)
    setPendingReview(null)
    setPendingBody(null)
    setApplying(false)
    setAwaitingDecision(true)
  }, [displayReview, project, applying, awaitingDecision])

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
    } else if (doc) {
      // Draft (no snapshot): persist the accepted rewrite so a reload/navigate keeps it.
      persist({ body: bodyRef.current })
    }
  }, [doc, snapshot, commitDoc, persist])

  // Discard the rewrite: restore the captured pre-apply body verbatim and exit the
  // decision state. The restore re-emits onChange so body state matches the editor.
  const discardRewrite = useCallback(() => {
    const restore = preApplyBody
    if (restore !== null) {
      programmaticContentRef.current = true
      canvasRef.current?.setContent(textToHtml(restore))
      programmaticContentRef.current = false
      bodyRef.current = restore
      setBody(restore)
    }
    setAwaitingDecision(false)
    setPreApplyBody(null)
    setApplyError(null)
    // The rewrite's preview was dropped on Apply, so the review now showing is the
    // submitted snapshot's (or none). Re-render the inline squiggles to match the
    // restored body — Apply's setContent had cleared them.
    canvasRef.current?.setSignalHighlights(
      snapshot?.review ? toHighlightIssues(snapshot.review.signals, inlineIds) : [],
    )
  }, [preApplyBody, snapshot, inlineIds])

  // --- Review preview (step 1 of review-then-confirm) ------------------------
  // The edit-mode primary action (Run review / Resubmit / Cmd+Enter) runs the AI review
  // of the current body and shows it with inline squiggles, but DOES NOT submit: no
  // snapshot, no status change, no prefill. The result is held as a pending preview for
  // the author to read; they may edit (which clears the preview) and re-run, or confirm
  // to commit. The submit transition itself lives in `confirmSubmission`.
  const runReview = useCallback(async () => {
    const current = doc
    if (!repoRef.current || !current || !project) return
    // `body` is already PLAIN text — send it as-is (htmlToText here would double-decode).
    const text = body
    setReviewError(null)
    setReviewLoading(true)
    setFocusedSignalId(null)
    // Auto-open the detail panel so the run's loading state — then the result — is
    // visible the moment it lands.
    setPanelOpen(true)

    const result = await requestReview({ text, project, signals })
    if (!result.ok) {
      setReviewError(result.error)
      setReviewLoading(false)
      return
    }

    const review = result.data
    setReviewLoading(false)
    // Hold the preview (result + exact reviewed body); nothing is committed yet.
    setPendingReview(review)
    setPendingBody(text)

    // Render inline squiggles for the previewed body.
    canvasRef.current?.setSignalHighlights(toHighlightIssues(review.signals, inlineIds))
  }, [body, doc, project, signals, inlineIds])

  // --- Confirm submission (step 2 of review-then-confirm) --------------------
  // Confirming the preview no longer commits immediately: the author must first pick WHO
  // should review the document. "Confirm submission" in the ResultsPanel opens an
  // IN-PANEL choose-reviewer view (no dialog); `commitSubmission` runs once a reviewer is
  // chosen there. A reviewer is REQUIRED to submit, so there is no commit path that skips
  // this step.
  //
  // Commit the pending preview WITH the chosen reviewer: build the working doc from live
  // fields with the exact reviewed body, apply the submit transition (sets/replaces the
  // snapshot, records the reviewer, prefills, advances the status), persist, render
  // squiggles from the committed review, and clear the preview. This is the old one-step
  // submit behaviour, now gated behind reading the review AND choosing a reviewer.
  const commitSubmission = useCallback(
    (chosenReviewer: Person) => {
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
      const next = applySubmit(working, {
        body: text,
        review,
        submittedAt: new Date().toISOString(),
        reviewer: chosenReviewer,
      })
      commitDoc(next)

      // Render inline squiggles for the freshly submitted body, then clear the preview.
      canvasRef.current?.setSignalHighlights(toHighlightIssues(review.signals, inlineIds))
      setPendingReview(null)
      setPendingBody(null)
    },
    [doc, pendingReview, pendingBody, title, subtype, subtypeSource, status, commitDoc, inlineIds],
  )

  // --- Unsubmit (manual only) ------------------------------------------------
  const handleUnsubmit = useCallback(() => {
    const current = doc
    if (!current) return
    setFocusedSignalId(null)
    setPendingReview(null)
    setPendingBody(null)
    setPanelOpen(false)
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

  // --- Keyboard: Cmd/Ctrl+Enter = Run review; Esc = close panel --------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && panelOpen) {
        setPanelOpen(false)
        return
      }
      if (isRead) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        // Don't kick off a review while one is running, while an AI rewrite is in flight,
        // or while an Accept/Discard decision is pending (the body is mid-change).
        if (!reviewLoading && !applying && !awaitingDecision) void runReview()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isRead, reviewLoading, applying, awaitingDecision, runReview, panelOpen])

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

  // There is review content to surface (a settled review, an in-flight run, or an
  // error) → the slim strip renders, and the detail panel may be opened.
  const hasReviewContent = Boolean(displayReview || reviewLoading || reviewError)

  return (
    // Break OUT of the app shell's centered max-w-5xl so the page is a continuous
    // full-bleed white surface with its own slim TopBar action line.
    <div className="mx-[calc(50%-50vw)] -my-6 flex min-h-[calc(100vh-46px)] flex-col bg-bg">
      <TopBar
        breadcrumb={
          <AppBreadcrumb
            segments={[
              { label: project.name, href: `/p/${projectId}` },
              { label: title || 'Untitled', current: true },
            ]}
            className="min-w-0"
          />
        }
        actions={
          <>
            {!isRead ? (
              <Button
                variant="ink"
                onClick={() => void runReview()}
                disabled={reviewLoading}
                aria-busy={reviewLoading ? true : undefined}
              >
                {reviewLoading ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
                )}
                {reviewLoading ? 'Reviewing…' : status === 'draft' ? 'Run review' : 'Resubmit'}
              </Button>
            ) : (
              <>
                <ReviewerStatusControl
                  status={status}
                  routing={routing}
                  onStatusChange={handleReviewerStatus}
                  onApprove={handleApprove}
                />
                <CopyLinkButton url={reviewUrl} />
              </>
            )}
          </>
        }
      />

      {/* The content area. When the detail panel is open on lg+ it becomes a two-column
          row (writing column + inline panel) and the writing column reflows to make
          room; below lg the panel stacks beneath the writing column. No scrim — the
          panel is part of the primary content, not an overlay. */}
      <div className="document-content-area flex min-h-0 flex-1 flex-col lg:flex-row">

        {/* The continuous white page — the centered reading column. */}
        <div
          ref={editorContainerRef}
          className="document-page-column flex min-w-0 flex-1 flex-col gap-5 px-5 py-8 sm:px-6 sm:py-12"
        >
        {/* Subtype + a calm meta line (project · audience · status). Sits above the
            title so the document's type/context/status reads before the heading. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
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
          <span aria-hidden="true" className="text-text-tertiary">·</span>
          <ContextChip name={project.name} audience={audienceShort} />
          <span aria-hidden="true" className="text-text-tertiary">·</span>
          <StatusChip status={status} />
          {isRead && routing ? <RoutedNote destination={routing} /> : null}

          {/* Far-right panel toggle — shows/hides the inline review detail panel so the
              author can re-open the review (e.g. before resubmitting) after it
              auto-collapsed. Wired to the same `panelOpen` state. Disabled (with a
              hint) until there is review content to show — the panel only mounts then. */}
          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            disabled={!hasReviewContent}
            aria-pressed={panelOpen}
            aria-label={panelOpen ? 'Hide review panel' : 'Show review panel'}
            title={hasReviewContent ? undefined : 'Run a review to see feedback'}
            className={cn(
              'ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-control text-text-secondary',
              'transition-colors hover:bg-panel hover:text-text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              'disabled:pointer-events-none disabled:opacity-40',
              panelOpen && 'bg-panel text-text-primary',
            )}
          >
            <PanelRight className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Title — the largest text on the page. Edit mode is a borderless
            large-text input; a clear placeholder signals it's editable. */}
        {isRead ? (
          <h1 className="text-doc-title text-text-primary">{title || 'Untitled'}</h1>
        ) : (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => persist({ title })}
            placeholder="Untitled — add a title"
            aria-label="Title"
            className={cn(
              'w-full bg-transparent text-doc-title text-text-primary placeholder:text-text-tertiary',
              'focus:outline-none',
            )}
          />
        )}

        {/* People line — the project owner and (once submitted) the chosen reviewer,
            shown calmly beneath the status meta. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label-sm text-text-tertiary">
          <PersonNote label="Owner" person={project.owner} />
          {reviewer ? (
            <>
              <span aria-hidden="true">·</span>
              <PersonNote label="Reviewer" person={reviewer} />
            </>
          ) : null}
        </div>

        {/* Drift indicator (edit mode) — the live body differs from the snapshot. */}
        {drift ? (
          <DriftIndicator
            busy={reviewLoading}
            onResubmit={() => void runReview()}
            onUnsubmit={handleUnsubmit}
          />
        ) : null}

        {/* Slim review strip — the minimal default. Renders NOTHING until a review
            exists / is running / errored; "View N signals" opens the detail panel. */}
        <ReviewStrip
          loading={reviewLoading}
          error={reviewError}
          review={displayReview}
          onView={() => setPanelOpen(true)}
          onApplyPrompt={isRead ? undefined : handleApplyPrompt}
          applying={applying}
        />

        {/* The borderless writing surface. */}
        <div className="relative">
          <DocumentCanvas
            ref={canvasRef}
            mode={mode}
            // Lock the surface while an AI rewrite is in flight.
            editable={isRead ? false : !applying}
            content={initialContent}
            onChange={isRead ? undefined : handleBodyChange}
            onHighlightClick={handleHighlightClick}
          />

          {/* AI-rewrite in-flight scrim: dims the column with a spinner + "Rewriting…".
              The editor is also made non-editable while `applying`. */}
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
                'sticky bottom-3 z-10 mt-3 flex flex-wrap items-center justify-between gap-2',
                'rounded-card border border-border bg-surface px-3 py-2 shadow-lg',
              )}
            >
              <span className="text-label-sm text-text-secondary">
                Rewrite applied — keep it?
              </span>
              <div className="flex items-center gap-2">
                <Button variant="default" onClick={discardRewrite}>
                  <X className="size-3.5" aria-hidden="true" />
                  Discard
                </Button>
                <Button variant="ink" onClick={acceptRewrite}>
                  <Check className="size-3.5" aria-hidden="true" />
                  Accept
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {/* A failed rewrite surfaces a typed error below the column (never silent). */}
        {applyError ? <ErrorState error={applyError} title="Rewrite failed" /> : null}
        </div>

        {/* The expandable review DETAIL panel — an INLINE side panel that is part of the
            content area, NOT a modal overlay. On lg+ it sits to the right of the writing
            column (which reflows to make room) and slides in from the right; below lg it
            stacks beneath the writing column and slides up. No scrim, no inert, no focus
            trap — the editor stays fully interactive alongside it. Mounted whenever there
            is review content so it can animate in/out; the closed panel collapses to zero
            width/height. The ResultsPanel inside renders nothing until there is content. */}
        {hasReviewContent ? (
          <div
            className={cn('review-panel', panelOpen && 'review-panel--open')}
            // A closed panel is collapsed and visually hidden; keep it out of the a11y
            // tree until opened. NOT `inert`/`aria-modal` — when open the panel and the
            // rest of the page (the editor) are both fully interactive.
            aria-hidden={panelOpen ? undefined : true}
          >
            <ResultsPanel
              ref={resultsPanelRef}
              loading={reviewLoading}
              error={reviewError}
              review={displayReview}
              signals={signals}
              focusedSignalId={focusedSignalId}
              pending={!isRead && pendingReview !== null}
              onRetry={() => void runReview()}
              people={people}
              currentReviewer={reviewer}
              onConfirmReviewer={commitSubmission}
              onPhraseClick={handlePhraseClick}
              onFranchiseClick={() => setFranchiseOpen(true)}
              onApplyPrompt={isRead ? undefined : handleApplyPrompt}
              applying={applying}
              onClose={() => setPanelOpen(false)}
            />
          </div>
        ) : null}
      </div>

      <FranchiseDetail project={project} open={franchiseOpen} onClose={() => setFranchiseOpen(false)} />
    </div>
  )
}

/** A calm "Owner · Maya Kambe" / "Reviewer · Luigi Lucarelli" meta note. */
function PersonNote({ label, person }: { label: string; person: Person }) {
  return (
    <span>
      {label} <span aria-hidden="true">·</span>{' '}
      <span className="text-text-secondary">{person.name}</span>
    </span>
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
