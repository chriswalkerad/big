import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StarIsBorn } from './star-is-born'

describe('StarIsBorn', () => {
  it('renders nothing when not shown', () => {
    render(<StarIsBorn show={false} onDone={() => {}} title="Eloise" />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(/new name on the wall/i)).toBeNull()
  })

  it('renders the star and announces it for screen readers when shown', () => {
    render(<StarIsBorn show onDone={() => {}} title="Eloise" />)
    expect(screen.getAllByText(/new name on the wall/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Eloise').length).toBeGreaterThan(0)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/a star is born/i)
    expect(status).toHaveTextContent('Eloise')
  })

  it('falls back to YOUR NAME when no title is given', () => {
    render(<StarIsBorn show onDone={() => {}} />)
    expect(screen.getAllByText('YOUR NAME').length).toBeGreaterThan(0)
  })

  it('dismisses on click', () => {
    const onDone = vi.fn()
    render(<StarIsBorn show onDone={onDone} title="Eloise" />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
