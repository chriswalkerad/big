import { test, expect, type Page } from '@playwright/test'
import { LIBRARY_URL } from './helpers'

/**
 * Drive the theme to a target and assert it sticks. The toggle is only interactive
 * after hydration (before that it renders an aria-hidden placeholder with no label),
 * and next-themes applies the `.dark` class asynchronously, so we wait for the
 * labelled button and let the class assertion auto-retry.
 */
async function setTheme(page: Page, target: 'dark' | 'light') {
  const html = page.locator('html')
  const button = page.getByRole('button', {
    name: target === 'dark' ? 'Switch to dark theme' : 'Switch to light theme',
  })
  // Already in the target theme → the opposite-direction button is showing instead.
  if (await button.isVisible().catch(() => false)) {
    await button.click()
  }
  if (target === 'dark') {
    await expect(html).toHaveClass(/dark/)
  } else {
    await expect(html).not.toHaveClass(/dark/)
  }
}

test.describe('Theme toggle', () => {
  test('light/dark toggle persists across reload', async ({ page }) => {
    await page.goto(LIBRARY_URL)
    const html = page.locator('html')

    // Wait for hydration: the labelled toggle button only exists after mount.
    await expect(
      page.getByRole('button', { name: /Switch to (light|dark) theme/ }),
    ).toBeVisible()

    // Force dark and confirm it persists across a reload.
    await setTheme(page, 'dark')
    await page.reload()
    await expect(html).toHaveClass(/dark/)
    await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible()

    // Switch back to light and confirm that persists too.
    await setTheme(page, 'light')
    await page.reload()
    await expect(html).not.toHaveClass(/dark/)
    await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible()
  })
})
