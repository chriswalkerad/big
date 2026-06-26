import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { Project } from '@/types'
import { FranchiseDetail } from './franchise-detail'

afterEach(cleanup)

const PROJECT: Project = {
  id: 'proj-eloise',
  name: 'Eloise at The Plaza',
  audience: 'Kids 6-12 and their families',
  franchiseContext: 'Playful, witty, upscale-Manhattan whimsical.',
  tags: ['family', 'comedy'],
  owner: { id: 'person-maya-kambe', name: 'Maya Kambe', role: 'Animation Development & Production Executive' },
}

describe('FranchiseDetail', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<FranchiseDetail project={PROJECT} open={false} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the name, audience, context, and tags when open', () => {
    render(<FranchiseDetail project={PROJECT} open onClose={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Eloise at The Plaza' })).toBeInTheDocument()
    expect(screen.getByText(PROJECT.audience)).toBeInTheDocument()
    expect(screen.getByText(PROJECT.franchiseContext)).toBeInTheDocument()
    expect(screen.getByText('family')).toBeInTheDocument()
    expect(screen.getByText('comedy')).toBeInTheDocument()
  })

  it('wires aria-describedby to a real description element (#13)', () => {
    render(<FranchiseDetail project={PROJECT} open onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    const describedById = dialog.getAttribute('aria-describedby')
    expect(describedById).toBeTruthy()
    const description = document.getElementById(describedById as string)
    expect(description).not.toBeNull()
    expect(description).toHaveTextContent(PROJECT.audience)
  })

  it('calls onClose from the close button', () => {
    const onClose = vi.fn()
    render(<FranchiseDetail project={PROJECT} open onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})
