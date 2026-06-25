import { describe, it, expect } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { SignalBar } from './signal-bar'

afterEach(cleanup)

describe('SignalBar — color maps to threshold', () => {
  it('renders the pass tone when score >= threshold', () => {
    const { container } = render(<SignalBar score={90} threshold={70} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('data-tone')).toBe('pass')
    expect(container.querySelector('.bg-pass')).toBeTruthy()
  })

  it('renders the pass tone exactly at the threshold (boundary)', () => {
    const { container } = render(<SignalBar score={70} threshold={70} />)
    expect(container.querySelector('[role="meter"]')?.getAttribute('data-tone')).toBe('pass')
  })

  it('renders the minor tone when up to 20 below threshold', () => {
    const { container } = render(<SignalBar score={50} threshold={70} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('data-tone')).toBe('minor')
    expect(container.querySelector('.bg-minor')).toBeTruthy()
  })

  it('renders the risk tone when more than 20 below threshold', () => {
    const { container } = render(<SignalBar score={20} threshold={70} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('data-tone')).toBe('risk')
    expect(container.querySelector('.bg-risk')).toBeTruthy()
  })

  it('sets a proportional fill width', () => {
    const { container } = render(<SignalBar score={50} threshold={70} />)
    const fill = container.querySelector<HTMLElement>('.bg-minor')
    expect(fill?.style.width).toBe('50%')
  })

  it('exposes the score via aria meter attributes', () => {
    const { container } = render(<SignalBar score={60} threshold={60} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuenow')).toBe('60')
    expect(meter?.getAttribute('aria-valuemax')).toBe('100')
  })
})
