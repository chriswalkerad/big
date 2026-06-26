import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import type { Document, ReviewResult } from '@/types'
import { createStorageRepository } from '@/lib/storage'
import { DocumentPage } from './document-page'

// ProseMirror's native mousedown path calls elementFromPoint (absent in jsdom).
beforeAll(() => {
  if (typeof document.elementFromPoint !== 'function') {
    document.elementFromPoint = () => null
  }
})

const REVIEW: ReviewResult = {
  detectedSubtype: 'character_concept',
  suggestedTitle: 'AI Title',
  themes: ['friendship'],
  signals: [
    { signalId: 'clarity', score: 40, rationale: 'unclear', issues: [{ quote: 'vague', message: 'm', severity: 'minor' }] },
    { signalId: 'completeness', score: 80, rationale: 'ok', issues: [] },
    { signalId: 'brand_safety', score: 90, rationale: 'safe', issues: [] },
    { signalId: 'hook_strength', score: 70, rationale: 'good', issues: [] },
    { signalId: 'character', score: 70, rationale: 'fine', issues: [] },
    { signalId: 'franchise_fit', score: 60, rationale: 'fits', issues: [] },
  ],
  verdict: { label: 'needs_work', flagCount: 1 },
}

function seedDoc(overrides: Partial<Document> = {}): Document {
  const repo = createStorageRepository()
  const now = new Date().toISOString()
  const doc: Document = {
    id: 'doc-test',
    projectId: 'proj-eloise',
    title: '',
    body: 'Eloise has a vague plan.',
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
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('DocumentPage edit mode — submit flow', () => {
  it('shows DOC_NOT_FOUND when the doc is missing', async () => {
    render(<DocumentPage projectId="proj-eloise" docId="missing" mode="edit" />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveAttribute('data-error-code', 'DOC_NOT_FOUND')
    })
  })

  it('runs a review preview WITHOUT submitting, then confirm commits status + storage', async () => {
    seedDoc()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: REVIEW }), { status: 200 }),
    )

    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)

    // Step 1: the primary action runs the review (no longer labelled "Submit").
    const runReview = await screen.findByRole('button', { name: /run review/i })
    fireEvent.click(runReview)

    // Running a review auto-opens the detail panel, where the verdict header appears
    // (the preview). The verdict label + count also echo in the minimal strip, so scope
    // these assertions to the review-results region.
    const region = await screen.findByRole('region', { name: 'Review results' })
    await waitFor(() => {
      expect(within(region).getByText('Needs work')).toBeInTheDocument()
    })
    expect(within(region).getByText('1 of 6 need attention')).toBeInTheDocument()

    // The preview did NOT submit: still draft, no snapshot, title/subtype untouched.
    const previewed = createStorageRepository().getDocument('doc-test')
    expect(previewed?.status).toBe('draft')
    expect(previewed?.submittedSnapshot).toBeUndefined()
    expect(previewed?.title).toBe('')
    expect(previewed?.subtype).toBe('story_premise')

    // Step 2: confirm submission opens the IN-PANEL choose-reviewer view (no dialog);
    // it does NOT commit yet.
    const confirm = screen.getByRole('button', { name: /confirm submission/i })
    fireEvent.click(confirm)

    // The in-panel choose-reviewer view replaces the review; nothing is committed until a
    // reviewer is chosen.
    const picker = await screen.findByRole('region', { name: /choose a reviewer/i })
    expect(createStorageRepository().getDocument('doc-test')?.status).toBe('draft')

    // Step 3: pick a reviewer and submit → the old submit behaviour now commits, with the
    // chosen reviewer recorded on the document.
    fireEvent.click(within(picker).getByLabelText(/luigi lucarelli/i))
    fireEvent.click(within(picker).getByRole('button', { name: /submit for review/i }))

    await waitFor(() => {
      const saved = createStorageRepository().getDocument('doc-test')
      expect(saved?.status).toBe('submitted')
      expect(saved?.submittedSnapshot?.review.verdict.label).toBe('needs_work')
      // Empty title prefilled from the suggestion; subtype detected (source still auto).
      expect(saved?.title).toBe('AI Title')
      expect(saved?.subtype).toBe('character_concept')
      // The reviewer chosen in the picker is recorded.
      expect(saved?.reviewer?.id).toBe('person-luigi-lucarelli')
    })

    // The confirm action is gone once the doc is submitted (snapshot, not preview).
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /confirm submission/i }),
      ).not.toBeInTheDocument()
    })
  })

  it('orders the header as type/status row → title → owner/reviewer byline', async () => {
    seedDoc({ title: 'A Concept' })
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)

    // Anchors: the type/status row owns the Subtype <select>; the title is the
    // labelled input; the byline carries the "Owner" person note.
    const subtypeRow = await screen.findByLabelText('Subtype')
    const title = screen.getByLabelText('Title')
    const byline = screen.getByText('Owner')

    // type/status row precedes the title…
    expect(
      subtypeRow.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // …and the title precedes the owner/reviewer byline.
    expect(
      title.compareDocumentPosition(byline) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('exposes an Apply button in the suggested-prompt area of the review panel', async () => {
    seedDoc()
    const REVIEW_WITH_PROMPT: ReviewResult = {
      ...REVIEW,
      summary: 'Tighten clarity and resubmit.',
      suggestedPrompt: 'Revise the following concept: …',
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: REVIEW_WITH_PROMPT }), { status: 200 }),
    )

    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)
    fireEvent.click(await screen.findByRole('button', { name: /run review/i }))

    // The Apply button is wired (orchestrator implements the rewrite); Copy is gone.
    expect(await screen.findByRole('button', { name: /apply suggested prompt/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copy suggested prompt/i })).not.toBeInTheDocument()
  })

  it('hides the review section until a review is run (no verdict on a fresh draft)', async () => {
    seedDoc()
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)

    // The page shows the title/meta + Run review, but NO verdict / flag count / empty
    // placeholder / review strip / review region until a review exists.
    await screen.findByRole('button', { name: /run review/i })
    expect(screen.queryByRole('region', { name: 'Review results' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Review summary' })).not.toBeInTheDocument()
    expect(screen.queryByText(/need attention/i)).not.toBeInTheDocument()
    expect(screen.queryByText('No review yet.')).not.toBeInTheDocument()
  })

  it('auto-opens the detail panel on Run review; the × collapses to the minimal strip', async () => {
    seedDoc()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: REVIEW }), { status: 200 }),
    )
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)
    fireEvent.click(await screen.findByRole('button', { name: /run review/i }))

    // The detail panel auto-opens (its region is in the accessible tree, not inert).
    const region = await screen.findByRole('region', { name: 'Review results' })
    expect(within(region).getByText('Needs work')).toBeInTheDocument()

    // The panel is an INLINE side panel, not a modal: it is NOT a dialog, carries no
    // aria-modal, and the editor stays fully interactive alongside it (its container is
    // not inert / aria-hidden). The writing column reflows around the panel; it is never
    // covered by a scrim.
    expect(screen.queryByRole('dialog', { name: /review results/i })).not.toBeInTheDocument()
    expect(region.closest('[inert]')).toBeNull()
    expect(region.closest('[aria-modal="true"]')).toBeNull()
    const editor = document.querySelector('.document-canvas-prose') as HTMLElement | null
    expect(editor).not.toBeNull()
    expect(editor?.closest('[inert]')).toBeNull()
    expect(editor?.closest('[aria-hidden="true"]')).toBeNull()
    // No backdrop scrim is rendered.
    expect(document.querySelector('.review-scrim')).toBeNull()

    // The × collapses back to the minimal strip → the detail region leaves the a11y
    // tree, while the slim strip keeps the verdict visible.
    fireEvent.click(within(region).getByRole('button', { name: /close review details/i }))
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Review results' })).not.toBeInTheDocument()
    })
    const strip = screen.getByRole('region', { name: 'Review summary' })
    expect(within(strip).getByText('Needs work')).toBeInTheDocument()

    // "View N signals" on the strip re-opens the detail panel.
    fireEvent.click(within(strip).getByRole('button', { name: /view \d+ signals/i }))
    expect(await screen.findByRole('region', { name: 'Review results' })).toBeInTheDocument()
  })

  it('toggles the review panel from the far-right type-row button (disabled until a review exists)', async () => {
    seedDoc()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: REVIEW }), { status: 200 }),
    )
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)

    // No review yet → the toggle is present but disabled (its hint points the user to
    // run a review first).
    const toggle = await screen.findByRole('button', { name: /show review panel/i })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    // Run a review → the panel auto-opens and the toggle reflects the open state.
    fireEvent.click(screen.getByRole('button', { name: /run review/i }))
    await screen.findByRole('region', { name: 'Review results' })
    const openToggle = screen.getByRole('button', { name: /hide review panel/i })
    expect(openToggle).toBeEnabled()
    expect(openToggle).toHaveAttribute('aria-pressed', 'true')

    // Clicking it hides the panel (region leaves the a11y tree)…
    fireEvent.click(openToggle)
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Review results' })).not.toBeInTheDocument()
    })

    // …and clicking again re-shows it — proving it can re-open an auto-collapsed panel.
    fireEvent.click(screen.getByRole('button', { name: /show review panel/i }))
    expect(await screen.findByRole('region', { name: 'Review results' })).toBeInTheDocument()
  })

  it('renders a typed error in the panel when the review fails (retryable)', async () => {
    seedDoc()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: { code: 'AI_RATE_LIMIT', message: 'rate limited', retryable: true } }), { status: 429 }),
    )

    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)
    fireEvent.click(await screen.findByRole('button', { name: /run review/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveAttribute('data-error-code', 'AI_RATE_LIMIT')
    })
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    // A failed preview offers no confirm affordance.
    expect(screen.queryByRole('button', { name: /confirm submission/i })).not.toBeInTheDocument()
  })
})

describe('DocumentPage apply (AI rewrite) — accept / discard', () => {
  const REVIEW_WITH_PROMPT: ReviewResult = {
    ...REVIEW,
    summary: 'Tighten clarity and resubmit.',
    suggestedPrompt: 'Revise the following concept: …',
  }

  // Route fetch by URL: /api/review returns the review (so Apply has a suggestedPrompt),
  // /api/apply returns the rewritten text.
  function mockReviewThenApply(rewritten: string) {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/apply')) {
        return new Response(JSON.stringify({ ok: true, data: { text: rewritten } }), { status: 200 })
      }
      return new Response(JSON.stringify({ ok: true, data: REVIEW_WITH_PROMPT }), { status: 200 })
    })
  }

  async function runReviewThenApply(rewritten = 'A crisp rewritten concept.') {
    seedDoc()
    mockReviewThenApply(rewritten)
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)
    fireEvent.click(await screen.findByRole('button', { name: /run review/i }))
    const apply = await screen.findByRole('button', { name: /apply suggested prompt/i })
    fireEvent.click(apply)
  }

  it('applying calls /api/apply and then shows an Accept / Discard decision bar', async () => {
    await runReviewThenApply()

    // After the rewrite lands, the author is asked to keep or discard it.
    expect(await screen.findByRole('button', { name: /^accept$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^discard$/i })).toBeInTheDocument()

    // /api/apply was actually hit.
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
    const hitApply = calls.some((c) => String(c[0]).includes('/api/apply'))
    expect(hitApply).toBe(true)
  })

  it('Accept keeps the rewrite and clears the decision bar', async () => {
    await runReviewThenApply()
    fireEvent.click(await screen.findByRole('button', { name: /^accept$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^accept$/i })).not.toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /^discard$/i })).not.toBeInTheDocument()
  })

  it('Discard restores the pre-apply body and clears the decision bar', async () => {
    await runReviewThenApply()
    fireEvent.click(await screen.findByRole('button', { name: /^discard$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^discard$/i })).not.toBeInTheDocument()
    })
    // The original seed text is back in the editor.
    expect(screen.getByText(/Eloise has a vague plan\./)).toBeInTheDocument()
  })

  it('Accept on a submitted doc clears the stale snapshot and commits the rewrite body', async () => {
    // A submitted doc: its snapshot was reviewed against the OLD body. Rewriting then
    // accepting must drop that snapshot and persist the rewritten text as the new body.
    seedDoc({
      status: 'submitted',
      title: 'A Concept',
      submittedSnapshot: { body: 'Eloise has a vague plan.', review: REVIEW, submittedAt: 'T1' },
    })
    mockReviewThenApply('A crisp rewritten concept.')
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)
    // A submitted doc surfaces its saved review on open; run a fresh review to get a
    // suggested prompt, then apply + accept.
    fireEvent.click(await screen.findByRole('button', { name: /run review|resubmit/i }))
    fireEvent.click(await screen.findByRole('button', { name: /apply suggested prompt/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^accept$/i }))

    await waitFor(() => {
      const saved = createStorageRepository().getDocument('doc-test')
      expect(saved?.submittedSnapshot).toBeUndefined()
      expect(saved?.status).toBe('draft')
      expect(saved?.body).toBe('A crisp rewritten concept.')
    })
  })

  it('surfaces a typed error and shows no decision bar when the rewrite fails', async () => {
    seedDoc()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/apply')) {
        return new Response(
          JSON.stringify({ ok: false, error: { code: 'AI_RATE_LIMIT', message: 'rate limited', retryable: true } }),
          { status: 429 },
        )
      }
      return new Response(JSON.stringify({ ok: true, data: REVIEW_WITH_PROMPT }), { status: 200 })
    })

    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)
    fireEvent.click(await screen.findByRole('button', { name: /run review/i }))
    fireEvent.click(await screen.findByRole('button', { name: /apply suggested prompt/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveAttribute('data-error-code', 'AI_RATE_LIMIT')
    })
    expect(screen.queryByRole('button', { name: /^accept$/i })).not.toBeInTheDocument()
  })
})

describe('DocumentPage version drift (edit mode)', () => {
  // Seed a doc whose live body already differs from its snapshot, so the drift
  // indicator renders on load without needing to type into the editor.
  function seedDrifted() {
    return seedDoc({
      status: 'submitted',
      title: 'Drifted',
      body: 'edited working body',
      submittedSnapshot: { body: 'original snapshot body', review: REVIEW, submittedAt: 'T1' },
    })
  }

  it('shows the drift indicator when the body differs from the snapshot', async () => {
    seedDrifted()
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)
    expect(await screen.findByText(/edited since submit/i)).toBeInTheDocument()
    // Editing did NOT auto-unsubmit: status is still submitted.
    expect(createStorageRepository().getDocument('doc-test')?.status).toBe('submitted')
  })

  it('Resubmit previews then confirm replaces the snapshot with the current body', async () => {
    seedDrifted()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: REVIEW }), { status: 200 }),
    )
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)
    // A drifted (submitted) doc surfaces "Resubmit" both in the top action line and in
    // the drift indicator; either runs the review preview. Click the first.
    fireEvent.click((await screen.findAllByRole('button', { name: /resubmit/i }))[0])

    // Resubmit runs a preview — the snapshot is unchanged until confirmed.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm submission/i })).toBeInTheDocument()
    })
    expect(createStorageRepository().getDocument('doc-test')?.submittedSnapshot?.body).toBe(
      'original snapshot body',
    )

    fireEvent.click(screen.getByRole('button', { name: /confirm submission/i }))

    // Choosing a reviewer in the in-panel view commits the resubmit.
    const picker = await screen.findByRole('region', { name: /choose a reviewer/i })
    fireEvent.click(within(picker).getByRole('button', { name: /submit for review/i }))

    await waitFor(() => {
      const saved = createStorageRepository().getDocument('doc-test')
      expect(saved?.submittedSnapshot?.body).toBe('edited working body')
      expect(saved?.status).toBe('submitted')
      expect(saved?.reviewer).toBeDefined()
    })
    // No longer drifted → indicator gone.
    await waitFor(() => {
      expect(screen.queryByText(/edited since submit/i)).not.toBeInTheDocument()
    })
  })

  it('Unsubmit clears the snapshot and returns to draft', async () => {
    seedDrifted()
    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)
    fireEvent.click(await screen.findByRole('button', { name: /unsubmit/i }))

    await waitFor(() => {
      const saved = createStorageRepository().getDocument('doc-test')
      expect(saved?.submittedSnapshot).toBeUndefined()
      expect(saved?.status).toBe('draft')
    })
  })
})

describe('DocumentPage read mode — reviewer actions', () => {
  it('shows the snapshot verdict inline in the review panel and offers reviewer status', async () => {
    seedDoc({
      status: 'submitted',
      title: 'A Concept',
      submittedSnapshot: { body: 'snapshot body', review: REVIEW, submittedAt: 'T1' },
    })

    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="read" />)

    // The minimal default: the snapshot verdict shows in the slim review strip.
    const strip = await screen.findByRole('region', { name: 'Review summary' })
    expect(within(strip).getByText('Needs work')).toBeInTheDocument()

    // Reviewer status control is present in the top action line.
    expect(screen.getByRole('button', { name: /change review status/i })).toBeInTheDocument()
    // A copy-link affordance exists.
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument()

    // Opening the detail panel reveals the full review region (not a dismissable
    // bottom-sheet dialog), with the verdict header and signal rows.
    fireEvent.click(within(strip).getByRole('button', { name: /view \d+ signals/i }))
    const region = await screen.findByRole('region', { name: 'Review results' })
    expect(within(region).getByText('Needs work')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /dismiss results/i })).not.toBeInTheDocument()
  })

  it('changes the reviewer status and persists it', async () => {
    seedDoc({
      status: 'submitted',
      title: 'A Concept',
      submittedSnapshot: { body: 'snapshot body', review: REVIEW, submittedAt: 'T1' },
    })

    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="read" />)
    fireEvent.click(await screen.findByRole('button', { name: /change review status/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /changes requested/i }))

    await waitFor(() => {
      expect(createStorageRepository().getDocument('doc-test')?.status).toBe('changes_requested')
    })
  })

  it('approving opens the destination picker and saves routing', async () => {
    seedDoc({
      status: 'submitted',
      title: 'A Concept',
      submittedSnapshot: { body: 'snapshot body', review: REVIEW, submittedAt: 'T1' },
    })

    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="read" />)
    fireEvent.click(await screen.findByRole('button', { name: /change review status/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /^approved$/i }))

    // The destination picker opens with the default (Digital Test) preselected.
    const dialog = await screen.findByRole('dialog', { name: /choose a destination/i })
    expect(dialog).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Animation'))
    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }))

    await waitFor(() => {
      const saved = createStorageRepository().getDocument('doc-test')
      expect(saved?.status).toBe('approved')
      expect(saved?.routing).toBe('animation')
    })
  })
})
