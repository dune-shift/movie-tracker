import { useEffect, useRef, useState } from 'react'
import type { Format, Genre, LinkedFilm } from '../types'
import { FORMAT_OPTIONS, GENRE_OPTIONS } from '../types'
import { getPosterUrl } from '../services/tmdb'
import { ConfirmRemoveButton } from './ConfirmRemoveButton'


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
  /**
   * When false, the "Mark as watched" toggle is hidden. Use this in flows
   * where you're initially adding a film to a release (e.g. AddReleaseModal) —
   * marking something watched doesn't make sense until after you've actually
   * received/purchased it. Defaults to true.
   */
  showWatchedToggle?: boolean
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
export function LinkedFilmEditor({ film, onSave, onRemove, showFilmHeader = true, autoSave = false, showWatchedToggle = true }: LinkedFilmEditorProps) {

  const [draft, setDraft] = useState<LinkedFilm>(film)
  const [isDirty, setIsDirty] = useState(false)
  const [formatPanelOpen, setFormatPanelOpen] = useState(false)
  const [genrePanelOpen, setGenrePanelOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [blindBuyInfoOpen, setBlindBuyInfoOpen] = useState(false)
  const [blindBuyInfoPos, setBlindBuyInfoPos] = useState({ top: 0, left: 0 })
  const blindBuyInfoRef = useRef<HTMLDivElement>(null)
  const blindBuyBtnRef = useRef<HTMLButtonElement>(null)

  // Position the tooltip relative to the viewport (not the card) so the
  // card's `overflow-hidden` (used to clip the poster thumbnail) never
  // clips the tooltip text.
  function openBlindBuyInfo() {
    const rect = blindBuyBtnRef.current?.getBoundingClientRect()
    if (rect) {
      setBlindBuyInfoPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 })
    }
    setBlindBuyInfoOpen(true)
  }

  // Close the blind-buy info tooltip when tapping/clicking outside of it.
  useEffect(() => {
    if (!blindBuyInfoOpen) return
    function handleOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node
      if (
        !blindBuyInfoRef.current?.contains(target) &&
        !blindBuyBtnRef.current?.contains(target)
      ) {
        setBlindBuyInfoOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [blindBuyInfoOpen])

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

  function toggleFormat(format: Format) {
    const current = draft.formats ?? []
    update({
      formats: current.includes(format)
        ? current.filter((f) => f !== format)
        : [...current, format],
    })
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
    setFormatPanelOpen(false)
  }

  const posterUrl = getPosterUrl(draft.posterPath ?? null)
  const selectedFormats = draft.formats ?? []
  const selectedGenres = draft.genres ?? []
  const filmTags = draft.tags ?? []

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-overlay">

      {/* ── Full header: thumbnail · title · remove ── */}
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

          {/* Remove button */}
          {onRemove && (
            <ConfirmRemoveButton
              onConfirm={onRemove}
              label="Remove"
              ariaLabel={`Remove ${draft.title}`}
              compact
            />
          )}
        </div>
      )}

      {/* ── Compact strip (no header): remove ── */}
      {!showFilmHeader && onRemove && (
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex-1" />
          <ConfirmRemoveButton
            onConfirm={onRemove}
            label="Remove"
            ariaLabel={`Remove ${draft.title}`}
            compact
          />
        </div>
      )}


      {/* ── Formats + Genres + Tags ── */}
      <div className="border-t border-border/40 px-3 pb-2.5 pt-2 space-y-2">

        {/* Format toggle + selected pills */}
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFormatPanelOpen((v) => !v)}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                formatPanelOpen
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted hover:border-accent/50 hover:text-white'
              }`}
            >
              {selectedFormats.length === 0
                ? '+ Formats'
                : `Formats (${selectedFormats.length})`}
            </button>
            {selectedFormats.map((f) => (
              <span
                key={f}
                className="flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-hover"
              >
                {f}
                <button
                  type="button"
                  onClick={() => toggleFormat(f)}
                  className="ml-0.5 text-accent-hover/60 hover:text-accent-hover"
                  aria-label={`Remove ${f}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          {/* Expandable format checkbox grid */}
          {formatPanelOpen && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-border bg-surface p-3 sm:grid-cols-3">
              {FORMAT_OPTIONS.map((f) => (
                <label
                  key={f}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-surface-overlay"
                >
                  <input
                    type="checkbox"
                    checked={selectedFormats.includes(f)}
                    onChange={() => toggleFormat(f)}
                    className="accent-accent h-3.5 w-3.5 flex-shrink-0"
                  />
                  <span className="text-[11px] text-white">{f}</span>
                </label>
              ))}
            </div>
          )}
        </div>

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

      {/* ── Watch History ── */}
      {showWatchedToggle && (
        <div className="border-t border-border/40 px-3 pb-2.5 pt-2 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">
            Watch History
          </p>

          {/* Mark as watched */}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={!!draft.watchedAt}
              onChange={(e) =>
                update({ watchedAt: e.target.checked ? new Date().toISOString() : null })
              }
              className="accent-accent h-3.5 w-3.5 flex-shrink-0"
            />
            <span className="text-[11px] text-muted">
              {draft.watchedAt
                ? `Watched · ${new Date(draft.watchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Mark as watched'}
            </span>
          </label>
        </div>
      )}

      {/* ── Purchase History ── */}
      <div className="border-t border-border/40 px-3 pb-2.5 pt-2 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">
          Purchase History
        </p>

        {/* Blind buy */}
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={draft.blindBuy ?? false}
              onChange={(e) => update({ blindBuy: e.target.checked })}
              className="accent-accent h-3.5 w-3.5 flex-shrink-0"
            />
            <span className="text-[11px] text-muted">Blind buy</span>
          </label>

          <button
            ref={blindBuyBtnRef}
            type="button"
            onClick={() => (blindBuyInfoOpen ? setBlindBuyInfoOpen(false) : openBlindBuyInfo())}
            onMouseEnter={openBlindBuyInfo}
            onMouseLeave={() => setBlindBuyInfoOpen(false)}
            aria-label="What is a blind buy?"
            className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border border-border text-[9px] font-semibold text-muted transition hover:border-accent/50 hover:text-white"
          >
            i
          </button>

          {blindBuyInfoOpen && (
            <div
              ref={blindBuyInfoRef}
              style={{ top: blindBuyInfoPos.top, left: blindBuyInfoPos.left }}
              className="fixed z-50 w-48 -translate-x-1/2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] text-muted shadow-lg"
            >
              Bought without having seen the film
            </div>
          )}

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
