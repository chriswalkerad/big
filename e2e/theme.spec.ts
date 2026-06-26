import { test, expect, type Page } from '@playwright/test'
import { LIBRARY_URL } from './helpers'

/**
 * The theme toggle now lives in the left-nav rail as a menu-style row, so it carries
 * `role="menuitem"` (not the bare button role) and its accessible name still flips
 * between "Switch to dark/light theme".
 */
function themeToggle(page: Page, target: 'dark' | 'light') {
  return page.getByRole('menuitem', {
    name: target === 'dark' ? 'Switch to dark theme' : 'Switch to light theme',
  })
}

/**
 * Drive the theme to a target and assert it sticks. The toggle is only interactive
 * after hydration (before that it renders an aria-hidden placeholder with no label),
 * and next-themes applies the `.dark` class asynchronously, so we wait for the
 * labelled control and let the class assertion auto-retry.
 */
async function setTheme(page: Page, target: 'dark' | 'light') {
  const html = page.locator('html')
  const control = themeToggle(page, target)
  // Already in the target theme → the opposite-direction control is showing instead.
  if (await control.isVisible().catch(() => false)) {
    await control.click()
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

    // Wait for hydration: the labelled toggle row only carries its name after mount.
    await expect(
      page.getByRole('menuitem', { name: /Switch to (light|dark) theme/ }),
    ).toBeVisible()

    // Force dark and confirm it persists across a reload.
    await setTheme(page, 'dark')
    await page.reload()
    await expect(html).toHaveClass(/dark/)
    await expect(themeToggle(page, 'light')).toBeVisible()

    // Switch back to light and confirm that persists too.
    await setTheme(page, 'light')
    await page.reload()
    await expect(html).not.toHaveClass(/dark/)
    await expect(themeToggle(page, 'dark')).toBeVisible()
  })
})
