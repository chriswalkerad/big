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
    expect(screen.getByRole('button', { name: /fruit/i })).toHaveTextContent('Cherry')
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
    fireEvent.click(screen.getByRole('button', { name: /fruit/i }))
    fireEvent.click(screen.getByRole('option', { name: 'Cherry' }))
    expect(onChange).toHaveBeenCalledWith('cherry')
  })

  it('does not fire onChange when a disabled option is clicked', () => {
    const onChange = vi.fn()
    render(<Select value="apple" onChange={onChange} options={options} ariaLabel="Fruit" />)
    fireEvent.click(screen.getByRole('button', { name: /fruit/i }))
    const disabled = screen.getByRole('option', { name: 'Banana' })
    expect(disabled).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(disabled)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('exposes listbox a11y roles and the selected value when open (WCAG 4.1.2)', () => {
    render(<Select value="apple" onChange={() => {}} options={options} ariaLabel="Fruit" />)
    const trigger = screen.getByRole('button', { name: /fruit/i })
    // The trigger advertises a value picker and its name carries the selection.
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAccessibleName(/fruit\s+apple/i)

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    const opts = screen.getAllByRole('option')
    expect(opts).toHaveLength(options.length)
    // Selection is exposed via aria-selected on the option rows.
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'Cherry' })).toHaveAttribute('aria-selected', 'false')
  })

  it('uses the placeholder as the value when nothing is selected', () => {
    render(
      <Select value={null} onChange={() => {}} options={options} placeholder="Pick one" ariaLabel="Fruit" />,
    )
    expect(screen.getByRole('button', { name: /fruit/i })).toHaveAccessibleName(/fruit\s+pick one/i)
  })

  it('forwards aria-invalid / aria-describedby / aria-labelledby to the trigger', () => {
    render(
      <>
        <span id="ext-label">External</span>
        <Select
          value="apple"
          onChange={() => {}}
          options={options}
          aria-labelledby="ext-label"
          aria-invalid
          aria-describedby="ext-error"
        />
      </>,
    )
    const trigger = screen.getByRole('button')
    expect(trigger).toHaveAttribute('aria-invalid', 'true')
    expect(trigger).toHaveAttribute('aria-describedby', 'ext-error')
    // Name is composed from the external label plus the current value.
    expect(trigger).toHaveAccessibleName(/external\s+apple/i)
  })

  it('returns focus to the trigger after picking an option (WCAG 2.4.3)', () => {
    const onChange = vi.fn()
    render(<Select value="apple" onChange={onChange} options={options} ariaLabel="Fruit" />)
    const trigger = screen.getByRole('button', { name: /fruit/i })
    fireEvent.click(trigger)
    const cherry = screen.getByRole('option', { name: 'Cherry' })
    cherry.focus()
    fireEvent.click(cherry)
    expect(onChange).toHaveBeenCalledWith('cherry')
    expect(trigger).toHaveFocus()
  })

  it('renders the bordered variant with a border', () => {
    render(<Select value="apple" onChange={() => {}} options={options} variant="bordered" ariaLabel="Fruit" />)
    expect(screen.getByRole('button', { name: /fruit/i })).toHaveClass('border-border')
  })

  it('renders the bare variant without a border or background', () => {
    render(<Select value="apple" onChange={() => {}} options={options} variant="bare" ariaLabel="Fruit" />)
    const trigger = screen.getByRole('button', { name: /fruit/i })
    expect(trigger).toHaveClass('border-transparent')
    expect(trigger).toHaveClass('bg-transparent')
  })
})
