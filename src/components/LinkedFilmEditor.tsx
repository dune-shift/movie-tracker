import { useEffect, useState } from 'react'
import type { Format, Genre, LinkedFilm } from '../types'
import { FORMAT_OPTIONS, GENRE_OPTIONS } from '../types'
import { getPosterUrl } from '../services/tmdb'

interface LinkedFilmEditorProps {
  film: LinkedFilm
  /** Called when the user saves (or, in autoSave mode, on every change). */
  onSave: (updated: LinkedFilm) => void
  /** If provided, a Remove button is shown. */
  onRemove?: () => void
  /**
   * When false the thumbnail/title/year row is hidden — use this when the
   * parent already renders a richer film display (e.g. ReleasePage).
   * Defaults to true.
   */
  showFilmHeader?: boolean
  /**
   * When true, every change is written through to onSave immediately and
   * the explicit Save button is hidden. Use on edit pages where the rest
   * of the UI already auto-saves on every change.
   */
  autoSave?: boolean
}

/**
 * A self-contained card for editing one linked film.
 *
 * Holds its own draft state — changes don't propagate to the parent until the
 * user clicks "Save". This keeps the editing experience explicit and consistent
 * whether the card is inside the "Add Release" modal (where the parent saves
 * everything at the end) or on the Release detail page (where saving writes
 * directly to the database).
 */
export function LinkedFilmEditor({ film, onSave, onRemove, showFilmHeader = true, autoSave = false }: LinkedFilmEditorProps) {
  const [draft, setDraft] = useState<LinkedFilm>(film)
  const [isDirty, setIsDirty] = useState(false)
  const [genrePanelOpen, setGenrePanelOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')

  // Keep draft in sync with the film prop whenever the parent updates it
  // (e.g. after a save propagates through the DB), but only when there are
  // no unsaved local changes so we don't clobber an in-progress edit.
  useEffect(() => {
    if (!isDirty) {
      setDraft(film)
    }
  }, [film, isDirty])

  function update(partial: Partial<LinkedFilm>) {
    const newDraft = { ...draft, ...partial }
    setDraft(newDraft)
    if (autoSave) {
      onSave(newDraft)
      // Don't mark dirty — the prop will update from the parent and the
      // useEffect sync guard won't block it since isDirty stays false.
    } else {
      setIsDirty(true)
    }
  }

  function toggleGenre(genre: Genre) {
    const current = draft.genres ?? []
    update({
      genres: current.includes(genre)
        ? current.filter((g) => g !== genre)
        : [...current, genre],
    })
  }

  function commitTag(raw: string) {
    const tag = raw.trim().toLowerCase()
    setTagInput('')
    if (!tag) return
    const current = draft.tags ?? []
    if (current.includes(tag)) return
    update({ tags: [...current, tag] })
  }

  function removeTag(tag: string) {
    update({ tags: (draft.tags ?? []).filter((t) => t !== tag) })
  }

  function handleSave() {
    onSave(draft)
    setIsDirty(false)
    setGenrePanelOpen(false)
  }

  const posterUrl = getPosterUrl(draft.posterPath ?? null)
  const selectedGenres = draft.genres ?? []
  const filmTags = draft.tags ?? []

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-overlay">

      {/* ── Full header: thumbnail · title · format · remove ── */}
      {showFilmHeader && (
        <div className="flex items-center gap-3 px-3 py-2">
          {/* Poster thumbnail */}
          <div className="h-12 w-8 flex-shrink-0 overflow-hidden rounded border border-border bg-surface-raised">
            {posterUrl ? (
              <img src={posterUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full bg-surface-raised" />
            )}
          </div>

          {/* Title + year */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{draft.title}</p>
            <p className="text-xs text-muted">{draft.year}</p>
          </div>

          {/* Format select */}
          <select
            value={draft.format ?? ''}
            onChange={(e) => update({ format: e.target.value as Format | '' })}
            className="flex-shrink-0 rounded-md border border-border bg-surface-overlay px-2 py-1 text-xs text-white outline-none focus:border-accent"
          >
            <option value="">Format…</option>
            {FORMAT_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          {/* Remove button */}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded p-1.5 text-muted transition hover:bg-surface-raised hover:text-white"
              aria-label={`Remove ${draft.title}`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* ── Compact strip (no header): format · remove ── */}
      {!showFilmHeader && (
        <div className="flex items-center gap-2 px-3 py-2">
          <select
            value={draft.format ?? ''}
            onChange={(e) => update({ format: e.target.value as Format | '' })}
            className="rounded-md border border-border bg-surface-overlay px-2 py-1 text-xs text-white outline-none focus:border-accent"
          >
            <option value="">Set format…</option>
            {FORMAT_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <div className="flex-1" />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded p-1.5 text-muted transition hover:bg-surface-raised hover:text-white"
              aria-label={`Remove ${draft.title}`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* ── Genres + Tags ── */}
      <div className="border-t border-border/40 px-3 pb-2.5 pt-2 space-y-2">

        {/* Genre toggle + selected pills */}
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setGenrePanelOpen((v) => !v)}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                genrePanelOpen
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted hover:border-accent/50 hover:text-white'
              }`}
            >
              {selectedGenres.length === 0
                ? '+ Genres'
                : `Genres (${selectedGenres.length})`}
            </button>
            {selectedGenres.map((g) => (
              <span
                key={g}
                className="flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-hover"
              >
                {g}
                <button
                  type="button"
                  onClick={() => toggleGenre(g)}
                  className="ml-0.5 text-accent-hover/60 hover:text-accent-hover"
                  aria-label={`Remove ${g}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          {/* Expandable genre checkbox grid */}
          {genrePanelOpen && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-border bg-surface p-3 sm:grid-cols-3">
              {GENRE_OPTIONS.map((g) => (
                <label
                  key={g}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-surface-overlay"
                >
                  <input
                    type="checkbox"
                    checked={selectedGenres.includes(g)}
                    onChange={() => toggleGenre(g)}
                    className="accent-accent h-3.5 w-3.5 flex-shrink-0"
                  />
                  <span className="text-[11px] text-white">{g}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {filmTags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:text-white"
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                commitTag(tagInput)
              }
            }}
            onBlur={() => commitTag(tagInput)}
            placeholder="Add tag, press Enter…"
            className="min-w-[140px] flex-1 rounded-md border border-border bg-transparent px-2 py-0.5 text-[11px] text-white placeholder-muted/40 outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* ── Footer: Save button (only shown when there are unsaved changes) ── */}
      {isDirty && (
        <div className="border-t border-border/40 flex justify-end px-3 py-2">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover"
          >
            Save
          </button>
        </div>
      )}
    </div>
  )
}
