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
 * Open the inline review DETAIL panel. The panel is collapsed by default (the slim
 * review strip is the minimal surface), so until it is opened it is `aria-hidden` and
 * absent from the a11y tree — `resultsPanel(page)` won't resolve. The far-right meta-row
 * toggle ("Show review panel") opens it; we wait for the region to become visible.
 * Idempotent-ish: if the panel is already open this is a no-op (the toggle reads
 * "Hide review panel"), so callers gate on visibility rather than always toggling.
 */
export async function openReviewPanel(page: Page) {
  if (await resultsPanel(page).isVisible().catch(() => false)) return
  await page.getByRole('button', { name: 'Show review panel' }).click()
  await expect(resultsPanel(page)).toBeVisible()
}

/**
 * Drive the second half of the submit flow against an open review preview. The
 * preview's "Confirm submission" no longer commits directly: it opens an in-panel
 * choose-reviewer view (see `reviewer-choice.tsx`) where a reviewer is REQUIRED.
 * This clicks Confirm, then commits with the pre-selected reviewer via
 * "Submit for review". Pass the same `resultsPanel(page)` the caller is asserting on.
 */
export async function confirmSubmission(page: Page) {
  const panel = resultsPanel(page)
  await panel.getByRole('button', { name: 'Confirm submission' }).click()

  // The in-panel choose-reviewer view replaces the signal rows. A reviewer is
  // pre-selected (the prior choice or the first roster member), so we can submit
  // straight away.
  const choose = panel.getByRole('region', { name: 'Choose a reviewer' })
  await expect(choose).toBeVisible()
  await choose.getByRole('button', { name: 'Submit for review' }).click()

  await expect(page.getByText('Submitted', { exact: true })).toBeVisible()
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
