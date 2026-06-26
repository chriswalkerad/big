import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Menu, MenuItem } from './menu'

afterEach(cleanup)

describe('Menu', () => {
  it('exposes menu semantics by default', () => {
    render(
      <Menu label="Open" ariaLabel="Actions">
        {(close) => <MenuItem onClick={close}>Rename</MenuItem>}
      </Menu>,
    )
    const trigger = screen.getByRole('button', { name: 'Actions' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    fireEvent.click(trigger)
    expect(screen.getByRole('menu', { name: 'Actions' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument()
  })

  it('returns focus to the trigger after an item activates (WCAG 2.4.3)', () => {
    const onClick = vi.fn()
    render(
      <Menu label="Open" ariaLabel="Actions">
        {(close) => (
          <MenuItem
            onClick={() => {
              onClick()
              close()
            }}
          >
            Rename
          </MenuItem>
        )}
      </Menu>,
    )
    const trigger = screen.getByRole('button', { name: 'Actions' })
    fireEvent.click(trigger)
    const item = screen.getByRole('menuitem', { name: 'Rename' })
    item.focus()
    fireEvent.click(item)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveFocus()
  })

  it('returns focus to the trigger on Escape', () => {
    render(
      <Menu label="Open" ariaLabel="Actions">
        {(close) => <MenuItem onClick={close}>Rename</MenuItem>}
      </Menu>,
    )
    const trigger = screen.getByRole('button', { name: 'Actions' })
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('supports the listbox variant with option rows', () => {
    render(
      <Menu label="Pick" ariaLabel="Picker" variant="listbox">
        {() => (
          <MenuItem role="option" selected onClick={() => {}}>
            One
          </MenuItem>
        )}
      </Menu>,
    )
    const trigger = screen.getByRole('button', { name: 'Picker' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'One' })).toHaveAttribute('aria-selected', 'true')
  })
})
