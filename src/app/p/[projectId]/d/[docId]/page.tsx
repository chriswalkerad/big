// Document page — edit mode (the author's view). A server component whose only job is
// to unwrap the Next 16 async route params (a Promise) and hand plain strings to the
// client DocumentPage, which owns all editor/submit/storage behaviour.

import { DocumentPage } from '@/components/document-page'

interface RouteParams {
  projectId: string
  docId: string
}

export default async function DocumentEditPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { projectId, docId } = await params
  return <DocumentPage projectId={projectId} docId={docId} mode="edit" />
}
