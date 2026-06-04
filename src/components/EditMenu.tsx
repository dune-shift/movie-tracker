import { useEffect, useRef, useState } from 'react'
import {
  EDITION_OPTIONS,
  FORMAT_OPTIONS,
  type CollectionItem,
  type Edition,
  type Format,
} from '../types'

interface EditMenuProps {
  item: CollectionItem
  onUpdate: (id: number, updates: Partial<Pick<CollectionItem, 'format' | 'edition'>>) => void
  onRemove: (id: number) => void
}

export function EditMenu({ item, onUpdate, onRemove }: EditMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={`Edit ${item.title}`}
        className="rounded-lg border border-border bg-surface-overlay px-2.5 py-1 text-xs font-medium text-muted transition hover:border-accent/50 hover:text-white"
      >
        Edit
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-border bg-surface-overlay p-4 shadow-xl shadow-black/40">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Custom Fields
          </p>

          <label className="mb-3 block">
            <span className="mb-1 block text-xs text-muted">Format</span>
            <select
              value={item.format}
              onChange={(event) =>
                onUpdate(item.id, { format: event.target.value as Format | '' })
              }
              className="w-full rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-sm text-white outline-none focus:border-accent"
            >
              <option value="">Select format…</option>
              {FORMAT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="mb-4 block">
            <span className="mb-1 block text-xs text-muted">Edition / Source</span>
            <select
              value={item.edition}
              onChange={(event) =>
                onUpdate(item.id, { edition: event.target.value as Edition | '' })
              }
              className="w-full rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-sm text-white outline-none focus:border-accent"
            >
              <option value="">Select edition…</option>
              {EDITION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              onRemove(item.id)
              setOpen(false)
            }}
            className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
          >
            Remove from collection
          </button>
        </div>
      )}
    </div>
  )
}
