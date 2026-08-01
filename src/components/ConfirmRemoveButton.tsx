import { useEffect, useRef, useState } from 'react'

interface ConfirmRemoveButtonProps {
  /** Called when the user confirms the removal (second click). */
  onConfirm: () => void
  /** Label shown before the user clicks. Defaults to "Remove". */
  label?: string
  /** Label shown on the confirm button after the first click. */
  confirmLabel?: string
  /** Accessible label — falls back to `label` if not provided. */
  ariaLabel?: string
  /** Use the compact (smaller/inline) sizing — for use inside dense rows. */
  compact?: boolean
  className?: string
}

/**
 * A destructive action button that requires two clicks to actually fire:
 * the first click swaps the button into a "Confirm remove? / Cancel" state,
 * and only the second click (on "Confirm remove?") calls `onConfirm`.
 *
 * The confirm state auto-reverts after a few seconds of inactivity, or
 * immediately if the user clicks anywhere outside the control — so an
 * accidental first click never leaves a lingering "armed" delete button.
 *
 * Used for both film-level and release-level removal so the interaction
 * feels identical wherever a "Remove" action appears.
 */
export function ConfirmRemoveButton({
  onConfirm,
  label = 'Remove',
  confirmLabel = 'Confirm remove?',
  ariaLabel,
  compact = false,
  className = '',
}: ConfirmRemoveButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-revert after a few seconds of inactivity
  useEffect(() => {
    if (!confirming) return
    timeoutRef.current = setTimeout(() => setConfirming(false), 4000)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [confirming])

  // Revert immediately on any click outside the control
  useEffect(() => {
    if (!confirming) return
    function handleOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setConfirming(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [confirming])

  const sizeClasses = compact
    ? 'px-2 py-1 text-[11px]'
    : 'px-4 py-2 text-sm'

  if (confirming) {
    return (
      <div ref={containerRef} className={`flex items-center gap-2 ${className}`}>
        <button
          type="button"
          onClick={() => {
            setConfirming(false)
            onConfirm()
          }}
          className={`rounded-lg bg-red-500 font-medium text-white transition hover:bg-red-400 ${sizeClasses}`}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className={`text-muted transition hover:text-white ${compact ? 'text-[11px]' : 'text-sm'}`}
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={className}>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={ariaLabel ?? label}
        className={`rounded-lg border border-red-500/30 bg-red-500/10 font-medium text-red-400 transition hover:bg-red-500/20 ${sizeClasses}`}
      >
        {label}
      </button>
    </div>
  )
}
