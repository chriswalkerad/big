'use client'

import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { RoutingDestination, SubmissionStatus } from '@/types'
import { cn } from '@/lib/utils'
import { STATUS_LABELS } from '@/components/status-chip'
import { Menu, MenuItem } from '@/components/menu'
import { DestinationPicker } from '@/components/destination-picker'
import { REVIEWER_STATUSES, canTransition } from '@/lib/doc-page'

interface ReviewerStatusControlProps {
  status: SubmissionStatus
  routing?: RoutingDestination
  /** Change to a non-approved status (legal transitions only). */
  onStatusChange: (status: SubmissionStatus) => void
  /** Approve with a chosen routing destination. */
  onApprove: (routing: RoutingDestination) => void
}

/**
 * Read-mode reviewer status control: a menu offering In Review / Changes Requested /
 * Approved. Choosing Approved opens the destination picker; confirming there sets the
 * status to approved and records the routing in one step. Only legal transitions from
 * the current status are enabled.
 */
export function ReviewerStatusControl({
  status,
  routing,
  onStatusChange,
  onApprove,
}: ReviewerStatusControlProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <>
      <Menu
        ariaLabel="Change review status"
        triggerClassName={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 text-label-sm text-text-secondary',
          'transition-colors hover:bg-panel hover:text-text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
        label={
          <>
            <span className="size-1.5 rounded-pill bg-text-tertiary" aria-hidden="true" />
            <span className="text-text-primary">{STATUS_LABELS[status]}</span>
            <ChevronDown className="size-3.5 text-text-tertiary" aria-hidden="true" />
          </>
        }
      >
        {(close) => (
          <>
            {REVIEWER_STATUSES.map((option) => {
              const selected = option === status
              const allowed = selected || canTransition(status, option)
              const isApprove = option === 'approved'
              return (
                <MenuItem
                  key={option}
                  selected={selected}
                  disabled={!allowed}
                  onClick={() => {
                    if (isApprove) {
                      close()
                      setPickerOpen(true)
                      return
                    }
                    onStatusChange(option)
                    close()
                  }}
                >
                  <span>{STATUS_LABELS[option]}</span>
                  {selected ? <Check className="size-3.5" aria-hidden="true" /> : null}
                </MenuItem>
              )
            })}
          </>
        )}
      </Menu>

      <DestinationPicker
        open={pickerOpen}
        current={routing}
        onClose={() => setPickerOpen(false)}
        onConfirm={(destination) => {
          onApprove(destination)
          setPickerOpen(false)
        }}
      />
    </>
  )
}
