import { expect, type Page } from '@playwright/test'

/** The seeded project the app opens inside (see src/lib/seed-data.ts). */
export const PROJECT_ID = 'proj-eloise'
export const LIBRARY_URL = `/p/${PROJECT_ID}`

/** Seeded document ids (see src/lib/seed-data.ts). */
export const DOC = {
  midnight: 'doc-midnight-caper', // approved, looks_ready
  newFriend: 'doc-new-friend', // submitted, needs_work
  haunted: 'doc-haunted-elevator', // changes_requested, not_ready
  rooftop: 'doc-rooftop-stub', // draft, no snapshot
} as const

export function docUrl(docId: string): string {
  return `/p/${PROJECT_ID}/d/${docId}`
}

export function reviewUrl(docId: string): string {
  return `/p/${PROJECT_ID}/d/${docId}/review`
}

/** The inline review-results panel (right column on desktop, stacked on mobile). */
export function resultsPanel(page: Page) {
  return page.getByRole('region', { name: 'Review results' })
}

/**
 * Type text into the Tiptap canvas. The editor is contenteditable; we focus it,
 * move to the end, and type. Pass `replace` to select-all + overwrite first.
 */
export async function typeInBody(page: Page, text: string, replace = false) {
  const editor = page.locator('.document-canvas-prose')
  await editor.click()
  if (replace) {
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Delete')
  } else {
    // Move caret to the end so we append rather than insert mid-text.
    await page.keyboard.press('ControlOrMeta+End')
  }
  await page.keyboard.type(text)
}

/** Open a document from the library by clicking its title link. */
export async function openDocFromLibrary(page: Page, title: string) {
  await page.goto(LIBRARY_URL)
  await expect(page.getByRole('heading', { name: 'Eloise at The Plaza' })).toBeVisible()
  await page.getByRole('link', { name: title }).click()
}
