'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
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
import { htmlToText, textToHtml } from '@/lib/doc-body'
import {
  ROUTING_LABELS,
  applyPrefill,
  hasDrift,
  inlineSignalIdSet,
  makeSnapshot,
  statusAfterSubmit,
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
import { ResultsDrawer } from '@/components/results-drawer'
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
 */
export function DocumentPage({ projectId, docId, mode }: DocumentPageProps) {
  const isRead = mode === 'read'
  const repoRef = useRef<StorageRepository | null>(null)
  const canvasRef = useRef<DocumentCanvasHandle | null>(null)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)

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

  // Review / drawer state.
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState<AppError | null>(null)
  const [focusedSignalId, setFocusedSignalId] = useState<string | null>(null)
  const [franchiseOpen, setFranchiseOpen] = useState(false)

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
    setSubtype(found.subtype)
    setSubtypeSource(found.subtypeSource)
    setStatus(found.status)
    setRouting(found.routing)
    setSnapshot(found.submittedSnapshot)
    // In read mode, open the drawer on load so the reviewer sees the verdict.
    if (mode === 'read' && found.submittedSnapshot) setDrawerOpen(true)
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

  // --- Read mode: render the snapshot, not the live body ---------------------
  // The drawer always reflects the submitted snapshot's review (computed on submit,
  // never live) in both modes; edits don't touch it.
  const displayReview: ReviewResult | null = snapshot?.review ?? null
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
  // Squiggle click → focus the matching drawer row.
  const handleHighlightClick = useCallback((signalId: string) => {
    setFocusedSignalId(signalId)
    setDrawerOpen(true)
  }, [])

  // Drawer phrase click → scroll to + emphasise the squiggle in the canvas.
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

  // --- Submit / Resubmit -----------------------------------------------------
  const runReview = useCallback(
    async (isResubmit: boolean) => {
      const repo = repoRef.current
      if (!repo || !doc || !project) return
      const text = htmlToText(body)
      setReviewError(null)
      setReviewLoading(true)
      setDrawerOpen(true)
      setFocusedSignalId(null)

      const result = await requestReview({ text, project, signals })
      if (!result.ok) {
        setReviewError(result.error)
        setReviewLoading(false)
        return
      }

      const review = result.data
      const submittedAt = new Date().toISOString()
      const newSnapshot = makeSnapshot(text, review, submittedAt)
      const prefill = applyPrefill({ title, subtype, subtypeSource }, review)
      const nextStatus = statusAfterSubmit(status)

      setSnapshot(newSnapshot)
      setTitle(prefill.title)
      setSubtype(prefill.subtype)
      setStatus(nextStatus)
      setReviewLoading(false)

      persist({
        title: prefill.title,
        body: text,
        subtype: prefill.subtype,
        subtypeSource: prefill.subtypeSource,
        status: nextStatus,
        submittedSnapshot: newSnapshot,
      })

      // Render inline squiggles for the freshly submitted body.
      canvasRef.current?.setSignalHighlights(toHighlightIssues(review.signals, inlineIds))
      void isResubmit
    },
    [body, doc, project, signals, title, subtype, subtypeSource, status, persist, inlineIds],
  )

  // --- Unsubmit (manual only) ------------------------------------------------
  const handleUnsubmit = useCallback(() => {
    setSnapshot(undefined)
    setStatus('draft')
    setRouting(undefined)
    setDrawerOpen(false)
    setFocusedSignalId(null)
    canvasRef.current?.setSignalHighlights([])
    persist({ submittedSnapshot: undefined, status: 'draft', routing: undefined })
  }, [persist])

  // --- Reviewer actions ------------------------------------------------------
  const handleReviewerStatus = useCallback(
    (next: SubmissionStatus) => {
      setStatus(next)
      persist({ status: next })
    },
    [persist],
  )

  const handleApprove = useCallback(
    (destination: RoutingDestination) => {
      setStatus('approved')
      setRouting(destination)
      persist({ status: 'approved', routing: destination })
    },
    [persist],
  )

  // --- Editor change ---------------------------------------------------------
  const handleBodyChange = useCallback((html: string) => {
    setBody(htmlToText(html))
  }, [])

  // --- Keyboard: Cmd/Ctrl+Enter = Submit (edit mode) -------------------------
  useEffect(() => {
    if (isRead) return
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (!reviewLoading) void runReview(false)
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
    <div className="flex flex-col gap-6 pb-[calc(60vh+2rem)]">
      {/* Top bar */}
      <div className="flex flex-col gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <AppBreadcrumb
            segments={[
              { label: project.name, href: `/p/${projectId}` },
              { label: title || 'Untitled', current: true },
            ]}
            className="min-w-0 flex-1"
          />
          <ContextChip name={project.name} audience={audienceShort} />
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
          {isRead ? (
            <CopyLinkButton url={reviewUrl} />
          ) : (
            <button
              type="button"
              onClick={() => void runReview(false)}
              disabled={reviewLoading}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-control bg-accent px-3 text-label-sm font-medium text-bg',
                'transition-opacity hover:opacity-90 disabled:opacity-60',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              )}
            >
              {reviewLoading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-3.5" aria-hidden="true" />
              )}
              {reviewLoading ? 'Reviewing…' : 'Submit'}
            </button>
          )}
        </div>

        {isRead && routing ? (
          <RoutedNote destination={routing} />
        ) : null}
      </div>

      {/* Title + subtype */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
        </div>
        <div className="flex items-center gap-2">
          {isRead ? (
            <SubtypeChip subtype={subtype} />
          ) : (
            <SubtypeSelect
              value={subtype}
              onChange={(next) => {
                setSubtype(next)
                setSubtypeSource('user')
                persist({ subtype: next, subtypeSource: 'user' })
              }}
            />
          )}
        </div>
      </div>

      {/* Drift indicator (edit mode) */}
      {drift ? (
        <DriftIndicator
          busy={reviewLoading}
          onResubmit={() => void runReview(true)}
          onUnsubmit={handleUnsubmit}
        />
      ) : null}

      {/* Body */}
      <div ref={editorContainerRef} className="min-h-[16rem]">
        <DocumentCanvas
          ref={canvasRef}
          mode={mode}
          content={initialContent}
          onChange={isRead ? undefined : handleBodyChange}
          onHighlightClick={handleHighlightClick}
        />
      </div>

      {/* Results drawer */}
      <ResultsDrawer
        open={drawerOpen}
        loading={reviewLoading}
        error={reviewError}
        review={displayReview}
        signals={signals}
        focusedSignalId={focusedSignalId}
        onClose={() => setDrawerOpen(false)}
        onRetry={() => void runReview(Boolean(snapshot))}
        onPhraseClick={handlePhraseClick}
        onFranchiseClick={() => setFranchiseOpen(true)}
      />

      <FranchiseDetail project={project} open={franchiseOpen} onClose={() => setFranchiseOpen(false)} />
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
