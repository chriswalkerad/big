import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Select, type SelectOption } from './select'

afterEach(cleanup)

type Fruit = 'apple' | 'banana' | 'cherry'

const options: SelectOption<Fruit>[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana', disabled: true },
  { value: 'cherry', label: 'Cherry' },
]

describe('Select', () => {
  it('renders the selected option label in the trigger', () => {
    render(<Select value="cherry" onChange={() => {}} options={options} ariaLabel="Fruit" />)
    expect(screen.getByRole('button', { name: 'Fruit' })).toHaveTextContent('Cherry')
  })

  it('renders the muted placeholder when value is null', () => {
    render(
      <Select value={null} onChange={() => {}} options={options} placeholder="Pick one" ariaLabel="Fruit" />,
    )
    const placeholder = screen.getByText('Pick one')
    expect(placeholder).toBeInTheDocument()
    expect(placeholder).toHaveClass('text-text-tertiary')
  })

  it('fires onChange with the option value when an option is clicked', () => {
    const onChange = vi.fn()
    render(<Select value="apple" onChange={onChange} options={options} ariaLabel="Fruit" />)
    fireEvent.click(screen.getByRole('button', { name: 'Fruit' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cherry' }))
    expect(onChange).toHaveBeenCalledWith('cherry')
  })

  it('does not fire onChange when a disabled option is clicked', () => {
    const onChange = vi.fn()
    render(<Select value="apple" onChange={onChange} options={options} ariaLabel="Fruit" />)
    fireEvent.click(screen.getByRole('button', { name: 'Fruit' }))
    const disabled = screen.getByRole('menuitem', { name: 'Banana' })
    expect(disabled).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(disabled)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('exposes menu a11y roles when open', () => {
    render(<Select value="apple" onChange={() => {}} options={options} ariaLabel="Fruit" />)
    const trigger = screen.getByRole('button', { name: 'Fruit' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    fireEvent.click(trigger)
    expect(screen.getByRole('menu', { name: 'Fruit' })).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(options.length)
  })

  it('renders the bordered variant with a border', () => {
    render(<Select value="apple" onChange={() => {}} options={options} variant="bordered" ariaLabel="Fruit" />)
    expect(screen.getByRole('button', { name: 'Fruit' })).toHaveClass('border-border')
  })

  it('renders the bare variant without a border or background', () => {
    render(<Select value="apple" onChange={() => {}} options={options} variant="bare" ariaLabel="Fruit" />)
    const trigger = screen.getByRole('button', { name: 'Fruit' })
    expect(trigger).toHaveClass('border-transparent')
    expect(trigger).toHaveClass('bg-transparent')
  })
})
