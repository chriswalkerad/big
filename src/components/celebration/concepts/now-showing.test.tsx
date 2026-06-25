import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NowShowing } from './now-showing'

describe('NowShowing', () => {
  it('renders nothing when not shown', () => {
    render(<NowShowing show={false} onDone={() => {}} title="My Doc" />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(/Now Showing/i)).toBeNull()
  })

  it('renders the marquee and announces it for screen readers when shown', () => {
    render(<NowShowing show onDone={() => {}} title="My Doc" />)
    expect(screen.getAllByText(/Now Showing/i).length).toBeGreaterThan(0)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/now showing/i)
    expect(status).toHaveTextContent('My Doc')
  })

  it('dismisses on click', () => {
    const onDone = vi.fn()
    render(<NowShowing show onDone={onDone} title="My Doc" />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
