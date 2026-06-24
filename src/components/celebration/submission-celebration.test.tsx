import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SubmissionCelebration } from './submission-celebration'

describe('SubmissionCelebration', () => {
  it('renders nothing when not shown', () => {
    render(<SubmissionCelebration show={false} onDone={() => {}} title="My Doc" />)
    expect(screen.queryByText('Greenlit.')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('plays the celebration and announces it for screen readers when shown', () => {
    render(<SubmissionCelebration show onDone={() => {}} title="My Doc" />)
    expect(screen.getByText('Greenlit.')).toBeInTheDocument()
    expect(screen.getByText(/You.?re a Big Shot now/i)).toBeInTheDocument()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/Greenlit and sent to review/i)
    expect(status).toHaveTextContent('My Doc')
  })

  it('dismisses on click', () => {
    const onDone = vi.fn()
    render(<SubmissionCelebration show onDone={onDone} title="My Doc" />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('dismisses on Escape', () => {
    const onDone = vi.fn()
    render(<SubmissionCelebration show onDone={onDone} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDone).toHaveBeenCalled()
  })
})
