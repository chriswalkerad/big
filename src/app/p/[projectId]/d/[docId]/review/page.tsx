// Document page — read (review) mode. This is the share-link target: it renders the
// submitted snapshot read-only with reviewer actions. Same DocumentPage component,
// driven by `mode="read"`. Unwraps the async route params (a Promise in Next 16).

import { DocumentPage } from '@/components/document-page'

interface RouteParams {
  projectId: string
  docId: string
}

export default async function DocumentReviewPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { projectId, docId } = await params
  return <DocumentPage projectId={projectId} docId={docId} mode="read" />
}
