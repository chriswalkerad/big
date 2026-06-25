import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThePremiere } from './the-premiere'

describe('ThePremiere', () => {
  it('renders nothing when not shown', () => {
    render(<ThePremiere show={false} onDone={() => {}} title="My Doc" />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Premiere')).toBeNull()
  })

  it('plays the celebration and announces it for screen readers when shown', () => {
    render(<ThePremiere show onDone={() => {}} title="My Doc" />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Premiere')).toBeInTheDocument()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/Premiere/i)
    expect(status).toHaveTextContent('My Doc')
  })

  it('dismisses on click', () => {
    const onDone = vi.fn()
    render(<ThePremiere show onDone={onDone} title="My Doc" />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('dismisses on Escape', () => {
    const onDone = vi.fn()
    render(<ThePremiere show onDone={onDone} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDone).toHaveBeenCalled()
  })
})
