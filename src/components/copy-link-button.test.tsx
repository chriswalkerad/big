import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CopyLinkButton } from './copy-link-button'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('CopyLinkButton — accessible name follows the visible state', () => {
  it('has no static aria-label; the visible text is the accessible name', () => {
    render(<CopyLinkButton url="/p/x/d/y/review" />)
    // The button is named by its visible text, so a state change ("Copied") is announced.
    const button = screen.getByRole('button', { name: 'Copy link' })
    expect(button).not.toHaveAttribute('aria-label')
  })

  it('announces "Copied" via a polite status region on success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<CopyLinkButton url="https://example.com/share" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    })
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent('Link copied to clipboard')
  })

  it('surfaces a clipboard failure rather than failing silently', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<CopyLinkButton url="https://example.com/share" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/copy failed/i)
    })
  })
})
