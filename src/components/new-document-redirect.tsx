'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Document } from '@/types'
import { type AppError, appError } from '@/lib/errors'
import { createStorageRepository } from '@/lib/storage'
import { LoadingState } from '@/components/loading-state'
import { ErrorState } from '@/components/error-state'

interface NewDocumentRedirectProps {
  projectId: string
}

const NEW_DOC_AUTHOR = 'You'

/** Generate a doc id; falls back to a timestamp-based id if randomUUID is missing. */
function newDocId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `doc-${crypto.randomUUID()}`
  }
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Creates a blank draft Document in StorageRepository on mount, then replaces the URL
 * with its edit route so the back button does not return here. Renders a brief loading
 * state during the hand-off and a typed error if the project is missing or storage
 * fails outright.
 */
export function NewDocumentRedirect({ projectId }: NewDocumentRedirectProps) {
  const router = useRouter()
  const createdRef = useRef(false)
  const [error, setError] = useState<AppError | null>(null)

  // Mount-time create + redirect against the client-only StorageRepository; the single
  // setError is the failure path of that external-store load (no cascade), so the
  // set-state-in-effect rule is intentionally suppressed here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Guard against the effect running twice (StrictMode) creating two docs.
    if (createdRef.current) return
    createdRef.current = true

    const repo = createStorageRepository()
    if (!repo.getProject(projectId)) {
      setError(appError('DOC_NOT_FOUND', 'That project could not be found.'))
      return
    }

    const now = new Date().toISOString()
    const doc: Document = {
      id: newDocId(),
      projectId,
      title: '',
      body: '',
      subtype: null,
      subtypeSource: 'auto',
      status: 'draft',
      createdBy: NEW_DOC_AUTHOR,
      createdAt: now,
      updatedAt: now,
    }
    repo.saveDocument(doc)
    router.replace(`/p/${projectId}/d/${doc.id}`)
  }, [projectId, router])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (error) {
    return <ErrorState error={error} title="Couldn't create document" className="mt-8" />
  }
  return <LoadingState rows={4} className="mt-8" label="Creating document…" />
}
