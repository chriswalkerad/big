import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
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
    { signalId: 'clarity', score: 4, rationale: 'unclear', issues: [{ quote: 'vague', message: 'm', severity: 'minor' }] },
    { signalId: 'completeness', score: 8, rationale: 'ok', issues: [] },
    { signalId: 'brand_safety', score: 9, rationale: 'safe', issues: [] },
    { signalId: 'hook_strength', score: 7, rationale: 'good', issues: [] },
    { signalId: 'character', score: 7, rationale: 'fine', issues: [] },
    { signalId: 'franchise_fit', score: 6, rationale: 'fits', issues: [] },
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

  it('submits, opens the drawer with the verdict, and updates status + storage', async () => {
    seedDoc()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: REVIEW }), { status: 200 }),
    )

    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)

    const submit = await screen.findByRole('button', { name: /submit/i })
    fireEvent.click(submit)

    // Verdict header appears in the drawer.
    await waitFor(() => {
      expect(screen.getByText('Needs work')).toBeInTheDocument()
    })
    expect(screen.getByText('1 of 6 need attention')).toBeInTheDocument()

    // Status auto-advanced to submitted and was persisted.
    await waitFor(() => {
      const saved = createStorageRepository().getDocument('doc-test')
      expect(saved?.status).toBe('submitted')
      expect(saved?.submittedSnapshot?.review.verdict.label).toBe('needs_work')
      // Empty title prefilled from the suggestion; subtype detected (source still auto).
      expect(saved?.title).toBe('AI Title')
      expect(saved?.subtype).toBe('character_concept')
    })
  })

  it('renders a typed error in the drawer when the review fails (retryable)', async () => {
    seedDoc()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: { code: 'AI_RATE_LIMIT', message: 'rate limited', retryable: true } }), { status: 429 }),
    )

    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="edit" />)
    fireEvent.click(await screen.findByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveAttribute('data-error-code', 'AI_RATE_LIMIT')
    })
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})

describe('DocumentPage read mode — reviewer actions', () => {
  it('opens the drawer with the snapshot verdict and offers reviewer status', async () => {
    seedDoc({
      status: 'submitted',
      title: 'A Concept',
      submittedSnapshot: { body: 'snapshot body', review: REVIEW, submittedAt: 'T1' },
    })

    render(<DocumentPage projectId="proj-eloise" docId="doc-test" mode="read" />)

    await waitFor(() => {
      expect(screen.getByText('Needs work')).toBeInTheDocument()
    })
    // Reviewer status control is present.
    expect(screen.getByRole('button', { name: /change review status/i })).toBeInTheDocument()
    // A copy-link affordance exists.
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument()
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
})
