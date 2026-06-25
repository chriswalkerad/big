import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RollCamera } from './roll-camera'

describe('RollCamera', () => {
  it('renders nothing when not shown', () => {
    render(<RollCamera show={false} onDone={() => {}} title="My Doc" />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(/Submitted/i)).toBeNull()
  })

  it('renders the slate and announces it for screen readers when shown', () => {
    render(<RollCamera show onDone={() => {}} title="My Doc" />)
    // "SCENE" appears on the slate; the dialog renders the visible content.
    expect(screen.getAllByText(/SCENE/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Submitted/).length).toBeGreaterThan(0)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/take one/i)
    expect(status).toHaveTextContent('My Doc')
  })

  it('dismisses on click', () => {
    const onDone = vi.fn()
    render(<RollCamera show onDone={onDone} title="My Doc" />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
