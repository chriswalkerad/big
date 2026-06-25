import { describe, it, expect } from 'vitest'
import type { Document, Person, ReviewResult } from '@/types'
import {
  applySubmit,
  applyUnsubmit,
  applyReviewerStatus,
  applyApprove,
  applyManualSubtype,
  hasDrift,
} from './doc-page'

// A submit always carries the reviewer chosen at submission.
const REVIEWER: Person = {
  id: 'person-luigi-lucarelli',
  name: 'Luigi Lucarelli',
  role: 'Character Designer & Concept Artist',
}

function review(overrides: Partial<ReviewResult> = {}): ReviewResult {
  return {
    detectedSubtype: 'character_concept',
    suggestedTitle: 'AI Suggested Title',
    themes: ['friendship'],
    signals: [],
    verdict: { label: 'needs_work', flagCount: 2 },
    ...overrides,
  }
}

function draftDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc-1',
    projectId: 'proj-eloise',
    title: '',
    body: 'original body',
    subtype: 'story_premise',
    subtypeSource: 'auto',
    status: 'draft',
    createdBy: 'You',
    createdAt: '2026-06-23T00:00:00.000Z',
    updatedAt: '2026-06-23T00:00:00.000Z',
    ...overrides,
  }
}

describe('applySubmit', () => {
  it('sets the submitted snapshot from the reviewed body + review', () => {
    const doc = draftDoc()
    const out = applySubmit(doc, { body: 'original body', review: review(), submittedAt: 'T1', reviewer: REVIEWER })
    // The snapshot records body/review/submittedAt; the reviewer lives on the document.
    expect(out.submittedSnapshot).toEqual({
      body: 'original body',
      review: review(),
      submittedAt: 'T1',
    })
  })

  it('records the chosen reviewer on the document', () => {
    const out = applySubmit(draftDoc(), {
      body: 'b',
      review: review(),
      submittedAt: 'T1',
      reviewer: REVIEWER,
    })
    expect(out.reviewer).toEqual(REVIEWER)
    // A draft never carries a reviewer until it is submitted.
    expect(draftDoc().reviewer).toBeUndefined()
  })

  it('advances a draft to submitted', () => {
    const out = applySubmit(draftDoc(), { body: 'b', review: review(), submittedAt: 'T1', reviewer: REVIEWER })
    expect(out.status).toBe('submitted')
  })

  it('preserves a non-draft status on resubmit', () => {
    const doc = draftDoc({ status: 'in_review' })
    const out = applySubmit(doc, { body: 'b', review: review(), submittedAt: 'T1', reviewer: REVIEWER })
    expect(out.status).toBe('in_review')
  })

  it('prefills an empty title and the subtype while source is auto', () => {
    const out = applySubmit(draftDoc(), { body: 'b', review: review(), submittedAt: 'T1', reviewer: REVIEWER })
    expect(out.title).toBe('AI Suggested Title')
    expect(out.subtype).toBe('character_concept')
    expect(out.subtypeSource).toBe('auto')
  })

  it('does NOT override a user-chosen subtype on resubmit', () => {
    const doc = applyManualSubtype(draftDoc(), 'world_building')
    expect(doc.subtypeSource).toBe('user')
    const out = applySubmit(doc, {
      body: 'b',
      review: review({ detectedSubtype: 'script_excerpt' }),
      submittedAt: 'T1',
      reviewer: REVIEWER,
    })
    expect(out.subtype).toBe('world_building')
    expect(out.subtypeSource).toBe('user')
  })

  it('replaces the prior snapshot on resubmit (no history)', () => {
    const first = applySubmit(draftDoc(), {
      body: 'first body',
      review: review({ suggestedTitle: 'First' }),
      submittedAt: 'T1',
      reviewer: REVIEWER,
    })
    const second = applySubmit(first, {
      body: 'second body',
      review: review({ suggestedTitle: 'Second' }),
      submittedAt: 'T2',
      reviewer: REVIEWER,
    })
    expect(second.submittedSnapshot?.body).toBe('second body')
    expect(second.submittedSnapshot?.submittedAt).toBe('T2')
  })
})

describe('drift + editing does not auto-unsubmit', () => {
  it('detects drift when the working body diverges from the snapshot', () => {
    const submitted = applySubmit(draftDoc(), {
      body: 'submitted body',
      review: review(),
      submittedAt: 'T1',
      reviewer: REVIEWER,
    })
    // Author keeps editing the live working body (a separate value in the UI).
    const liveBody = 'submitted body, now with more'
    expect(hasDrift(liveBody, submitted.submittedSnapshot)).toBe(true)
    // The snapshot is untouched by editing — status stays submitted.
    expect(submitted.status).toBe('submitted')
    expect(submitted.submittedSnapshot?.body).toBe('submitted body')
  })
})

describe('applyUnsubmit', () => {
  it('clears the snapshot, returns to draft, and drops routing', () => {
    const submitted = applyApprove(
      applySubmit(draftDoc(), { body: 'b', review: review(), submittedAt: 'T1', reviewer: REVIEWER }),
      'animation',
    )
    expect(submitted.submittedSnapshot).toBeDefined()
    const out = applyUnsubmit(submitted)
    expect(out.submittedSnapshot).toBeUndefined()
    expect(out.status).toBe('draft')
    expect(out.routing).toBeUndefined()
  })
})

describe('reviewer actions', () => {
  it('applies a reviewer status change', () => {
    const submitted = applySubmit(draftDoc(), { body: 'b', review: review(), submittedAt: 'T1', reviewer: REVIEWER })
    const out = applyReviewerStatus(submitted, 'changes_requested')
    expect(out.status).toBe('changes_requested')
  })

  it('records routing when approving', () => {
    const submitted = applySubmit(draftDoc(), { body: 'b', review: review(), submittedAt: 'T1', reviewer: REVIEWER })
    const out = applyApprove(submitted, 'production')
    expect(out.status).toBe('approved')
    expect(out.routing).toBe('production')
  })

  it('defaults nothing — routing only set via approve', () => {
    const submitted = applySubmit(draftDoc(), { body: 'b', review: review(), submittedAt: 'T1', reviewer: REVIEWER })
    expect(submitted.routing).toBeUndefined()
  })
})
