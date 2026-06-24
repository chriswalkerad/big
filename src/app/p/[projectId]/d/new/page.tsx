// New-document route. Unwraps the async params and renders the client redirector that
// creates an empty draft in StorageRepository on mount, then routes to its edit page.

import { NewDocumentRedirect } from '@/components/new-document-redirect'

interface RouteParams {
  projectId: string
}

export default async function NewDocumentPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { projectId } = await params
  return <NewDocumentRedirect projectId={projectId} />
}
