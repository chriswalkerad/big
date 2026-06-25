import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TheRunaway } from './the-runaway'

describe('TheRunaway', () => {
  it('renders nothing when not shown', () => {
    render(<TheRunaway show={false} onDone={() => {}} title="My Doc" />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Submitted!')).toBeNull()
  })

  it('plays the celebration and announces it for screen readers when shown', () => {
    render(<TheRunaway show onDone={() => {}} title="My Doc" />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Submitted!')).toBeInTheDocument()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/Big Shot now/i)
    expect(status).toHaveTextContent('My Doc')
  })

  it('dismisses on click', () => {
    const onDone = vi.fn()
    render(<TheRunaway show onDone={onDone} title="My Doc" />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('dismisses on Escape', () => {
    const onDone = vi.fn()
    render(<TheRunaway show onDone={onDone} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDone).toHaveBeenCalled()
  })
})
