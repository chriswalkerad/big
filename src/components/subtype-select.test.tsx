import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SUBTYPE_LABELS, SUBTYPE_ORDER } from './subtype-chip'
import { SubtypeSelect } from './subtype-select'

afterEach(cleanup)

describe('SubtypeSelect', () => {
  it('offers all five subtypes', () => {
    render(<SubtypeSelect value="story_premise" onChange={() => {}} />)
    for (const subtype of SUBTYPE_ORDER) {
      expect(screen.getByRole('option', { name: SUBTYPE_LABELS[subtype] })).toBeInTheDocument()
    }
  })

  it('fires onChange with the selected subtype', () => {
    const onChange = vi.fn()
    render(<SubtypeSelect value="story_premise" onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Subtype' }), {
      target: { value: 'character_concept' },
    })
    expect(onChange).toHaveBeenCalledWith('character_concept')
  })
})
