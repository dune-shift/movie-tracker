import { useRef, useState } from 'react'
import type { Release, LinkedFilm, Movie, Format, Genre } from '../types'
import { FORMAT_OPTIONS, GENRE_OPTIONS, LABEL_OPTIONS } from '../types'
import { getPosterUrl, getReleaseYear, searchMovies } from '../services/tmdb'
import { BarcodeScanner } from './BarcodeScanner'

interface AddReleaseModalProps {
  onSave: (release: Release) => void
  onClose: () => void
}

export function AddReleaseModal({ onSave, onClose }: AddReleaseModalProps) {
  const [step, setStep] = useState<1 | 2>(1)

  // ── Step 1 fields ────────────────────────────────────────
  const [title, setTitle] = useState('')
  const [label, setLabel] = useState('')
  const [releaseYear, setReleaseYear] = useState<number | ''>('')
  const [spineNumber, setSpineNumber] = useState('')
  const [discCount, setDiscCount] = useState<number | ''>('')
  const [barcode, setBarcode] = useState('')
  const [notes, setNotes] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [coverUrlInput, setCoverUrlInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  // ── Step 2 fields ────────────────────────────────────────
  const [films, setFilms] = useState<LinkedFilm[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Movie[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  // Which film's genre panel is currently expanded (null = none)
  const [openGenrePanel, setOpenGenrePanel] = useState<number | null>(null)
  // In-progress tag text input per film (keyed by tmdbId)
  const [tagInputs, setTagInputs] = useState<Record<number, string>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)
  const filmIds = new Set(films.map((f) => f.tmdbId))

  // ── Cover art handlers ───────────────────────────────────
  /**
   * Compress the selected image via an offscreen canvas before storing it as
   * a base64 data URL. Without this, a single high-res scan can exceed 3–5 MB,
   * quickly blowing through localStorage's ~5 MB per-origin quota.
   *
   * Target: max 800 px on the longest side, JPEG at 80 % quality → ~50–150 KB.
   */
  function handleFileSelect(file: File) {
    if (!file.type.startsWith('image/')) return

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const MAX = 800
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width >= height) {
          height = Math.round((height * MAX) / width)
          width = MAX
        } else {
          width = Math.round((width * MAX) / height)
          height = MAX
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      const compressed = canvas.toDataURL('image/jpeg', 0.8)
      setCoverUrl(compressed)
      setCoverUrlInput('')
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
    }

    img.src = objectUrl
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  function handleUrlCommit(url: string) {
    const trimmed = url.trim()
    if (trimmed) {
      setCoverUrl(trimmed)
    } else {
      setCoverUrl('')
    }
  }

  function clearCover() {
    setCoverUrl('')
    setCoverUrlInput('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Film search handlers ─────────────────────────────────
  async function handleFilmSearch() {
    const q = searchQuery.trim()
    if (!q) return
    setIsSearching(true)
    setSearchError(null)
    try {
      const results = await searchMovies(q)
      setSearchResults(results.slice(0, 10))
    } catch {
      setSearchError('Search failed. Check your API key.')
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  function addFilm(movie: Movie) {
    if (filmIds.has(movie.id)) return
    setFilms((prev) => [
      ...prev,
      {
        tmdbId: movie.id,
        title: movie.title,
        year: getReleaseYear(movie.release_date),
        posterPath: movie.poster_path,
        format: '',
        genres: [],
        tags: [],
      },
    ])
  }

  function removeFilm(tmdbId: number) {
    setFilms((prev) => prev.filter((f) => f.tmdbId !== tmdbId))
  }

  function updateFilmFormat(tmdbId: number, fmt: Format | '') {
    setFilms((prev) =>
      prev.map((f) => (f.tmdbId === tmdbId ? { ...f, format: fmt } : f)),
    )
  }

  function toggleFilmGenre(tmdbId: number, genre: Genre) {
    setFilms((prev) =>
      prev.map((f) => {
        if (f.tmdbId !== tmdbId) return f
        const current = f.genres ?? []
        return {
          ...f,
          genres: current.includes(genre)
            ? current.filter((g) => g !== genre)
            : [...current, genre],
        }
      }),
    )
  }

  function addFilmTag(tmdbId: number, raw: string) {
    const tag = raw.trim().toLowerCase()
    if (!tag) return
    setFilms((prev) =>
      prev.map((f) => {
        if (f.tmdbId !== tmdbId) return f
        const current = f.tags ?? []
        if (current.includes(tag)) return f
        return { ...f, tags: [...current, tag] }
      }),
    )
    setTagInputs((prev) => ({ ...prev, [tmdbId]: '' }))
  }

  function removeFilmTag(tmdbId: number, tag: string) {
    setFilms((prev) =>
      prev.map((f) =>
        f.tmdbId === tmdbId
          ? { ...f, tags: (f.tags ?? []).filter((t) => t !== tag) }
          : f,
      ),
    )
  }

  // ── Save ────────────────────────────────────────────────
  function handleSave() {
    if (!title.trim()) return
    onSave({
      id: crypto.randomUUID(),
      title: title.trim(),
      label,
      releaseYear,
      spineNumber,
      discCount,
      barcode,
      notes,
      coverUrl,
      films,
      addedAt: new Date().toISOString(),
    })
  }

  const canAdvance = title.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-10 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-2xl border border-border bg-surface shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <div className="flex gap-1">
                {([1, 2] as const).map((s) => (
                  <div
                    key={s}
                    className={`h-1 w-8 rounded-full transition-colors ${s <= step ? 'bg-accent' : 'bg-surface-overlay'}`}
                  />
                ))}
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                Step {step} of 2
              </p>
            </div>
            <h2 className="text-base font-semibold text-white">
              {step === 1 ? 'Add Release' : 'Add Films to this Release'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface-overlay hover:text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* ── Step 1: Release Details ── */}
        {step === 1 && (
          <div className="p-6">
            <div className="grid gap-6 sm:grid-cols-[180px_1fr]">

              {/* Cover art */}
              <div>
                <p className="mb-2 text-xs text-muted">Cover Art</p>

                {/* Drop zone */}
                <div
                  role="button"
                  tabIndex={0}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => !coverUrl && fileInputRef.current?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && !coverUrl && fileInputRef.current?.click()}
                  className={`relative aspect-[2/3] max-h-48 sm:max-h-none overflow-hidden rounded-lg border-2 transition ${
                    isDragging
                      ? 'cursor-copy border-accent bg-accent/10'
                      : coverUrl
                        ? 'cursor-default border-border'
                        : 'cursor-pointer border-dashed border-border bg-surface-overlay hover:border-accent/60'
                  }`}
                >
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt="Cover preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className="h-8 w-8 text-muted"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                        />
                      </svg>
                      <p className="text-[11px] leading-snug text-muted">
                        Drop image or click to browse
                      </p>
                    </div>
                  )}

                  {/* Clear button */}
                  {coverUrl && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearCover() }}
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white backdrop-blur-sm transition hover:bg-black/80"
                      aria-label="Remove cover"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(file)
                  }}
                />

                {/* URL input */}
                <input
                  type="url"
                  placeholder="Or paste image URL…"
                  value={coverUrlInput}
                  onChange={(e) => setCoverUrlInput(e.target.value)}
                  onBlur={(e) => handleUrlCommit(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlCommit(coverUrlInput)}
                  className="mt-2 w-full rounded-lg border border-border bg-surface-overlay px-3 py-1.5 text-[11px] text-white placeholder-muted/50 outline-none focus:border-accent"
                />
              </div>

              {/* Form fields */}
              <div className="space-y-4">
                {/* Title */}
                <label>
                  <span className="mb-1.5 block text-xs text-muted">
                    Release Title <span className="text-red-400">*</span>
                  </span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Herzog: The Collection"
                    autoFocus
                    className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
                  />
                </label>

                {/* Label */}
                <label>
                  <span className="mb-1.5 block text-xs text-muted">Label</span>
                  <input
                    type="text"
                    list="add-label-options"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Shout! Factory"
                    className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
                  />
                  <datalist id="add-label-options">
                    {LABEL_OPTIONS.map((l) => (
                      <option key={l} value={l} />
                    ))}
                  </datalist>
                </label>

                {/* Release Year + Spine */}
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="mb-1.5 block text-xs text-muted">Release Year</span>
                    <input
                      type="number"
                      value={releaseYear}
                      onChange={(e) =>
                        setReleaseYear(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="2023"
                      min="1894"
                      max="2099"
                      className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs text-muted">Spine / Catalog #</span>
                    <input
                      type="text"
                      value={spineNumber}
                      onChange={(e) => setSpineNumber(e.target.value)}
                      placeholder="e.g. CC-123"
                      className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
                    />
                  </label>
                </div>

                {/* Disc Count + Barcode */}
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="mb-1.5 block text-xs text-muted">Disc Count</span>
                    <input
                      type="number"
                      value={discCount}
                      onChange={(e) =>
                        setDiscCount(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="1"
                      min="1"
                      className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
                    />
                  </label>
                  <div>
                    <span className="mb-1.5 block text-xs text-muted">Barcode / UPC</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        placeholder="826663190069"
                        className="flex-1 min-w-0 rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        className="flex-shrink-0 rounded-lg border border-border bg-surface-overlay px-3 py-2 text-muted transition hover:bg-surface-raised hover:text-white"
                        aria-label="Scan barcode with camera"
                        title="Scan barcode with camera"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="h-4 w-4"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <label>
                  <span className="mb-1.5 block text-xs text-muted">Notes</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Slipcover edition, factory sealed, limited print, etc."
                    rows={2}
                    className="w-full resize-none rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Add Films ── */}
        {step === 2 && (
          <div className="p-6">
            <p className="mb-5 text-sm text-muted">
              Search TMDB to link the films included in this release. This pulls
              in poster art, director, and runtime. Optional — you can skip or
              come back to this later.
            </p>

            {/* Search bar */}
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFilmSearch()}
                placeholder="Search for a film on TMDB…"
                autoFocus
                className="flex-1 rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={handleFilmSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="rounded-lg border border-border bg-surface-overlay px-4 py-2 text-sm text-muted transition hover:bg-surface-raised hover:text-white disabled:opacity-40"
              >
                {isSearching ? '…' : 'Search'}
              </button>
            </div>

            {searchError && (
              <p className="mt-2 text-xs text-red-400">{searchError}</p>
            )}

            {/* Search results */}
            {searchResults.length > 0 && (
              <ul className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-border bg-surface-overlay">
                {searchResults.map((movie) => {
                  const added = filmIds.has(movie.id)
                  const posterUrl = getPosterUrl(movie.poster_path)
                  return (
                    <li key={movie.id} className="border-b border-border last:border-0">
                      <button
                        type="button"
                        onClick={() => addFilm(movie)}
                        disabled={added}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-surface-raised disabled:opacity-50"
                      >
                        <div className="h-12 w-8 flex-shrink-0 overflow-hidden rounded border border-border bg-surface-raised">
                          {posterUrl ? (
                            <img
                              src={posterUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full bg-surface-overlay" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">
                            {movie.title}
                          </p>
                          <p className="text-xs text-muted">
                            {getReleaseYear(movie.release_date)}
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 text-xs ${added ? 'text-accent' : 'text-muted'}`}
                        >
                          {added ? '✓ Added' : '+ Add'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Linked films list */}
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
                Films in this release
                {films.length > 0 && (
                  <span className="ml-1.5 normal-case text-accent-hover">
                    ({films.length})
                  </span>
                )}
              </p>

              {films.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs text-muted">
                  No films linked yet. Use the search above to add films.
                </div>
              ) : (
                <ul className="space-y-2">
                  {films.map((film) => {
                    const posterUrl = getPosterUrl(film.posterPath)
                    const selectedGenres = film.genres ?? []
                    const filmTags = film.tags ?? []
                    const genrePanelOpen = openGenrePanel === film.tmdbId
                    return (
                      <li
                        key={film.tmdbId}
                        className="overflow-hidden rounded-lg border border-border bg-surface-overlay"
                      >
                        {/* ── Row 1: thumbnail · title · format · remove ── */}
                        <div className="flex items-center gap-3 px-3 py-2">
                          <div className="h-12 w-8 flex-shrink-0 overflow-hidden rounded border border-border bg-surface-raised">
                            {posterUrl ? (
                              <img
                                src={posterUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full bg-surface-raised" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">
                              {film.title}
                            </p>
                            <p className="text-xs text-muted">{film.year}</p>
                          </div>
                          <select
                            value={film.format ?? ''}
                            onChange={(e) =>
                              updateFilmFormat(film.tmdbId, e.target.value as Format | '')
                            }
                            className="flex-shrink-0 rounded-md border border-border bg-surface-overlay px-2 py-1 text-xs text-white outline-none focus:border-accent"
                          >
                            <option value="">Format…</option>
                            {FORMAT_OPTIONS.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeFilm(film.tmdbId)}
                            className="rounded p-1.5 text-muted transition hover:bg-surface-raised hover:text-white"
                            aria-label={`Remove ${film.title}`}
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                            </svg>
                          </button>
                        </div>

                        {/* ── Row 2: genres + tags ── */}
                        <div className="border-t border-border/40 px-3 pb-2.5 pt-2 space-y-2">
                          {/* Genre toggle button + selected pills */}
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenGenrePanel(genrePanelOpen ? null : film.tmdbId)
                                }
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
                                    onClick={() => toggleFilmGenre(film.tmdbId, g)}
                                    className="ml-0.5 text-accent-hover/60 hover:text-accent-hover"
                                    aria-label={`Remove ${g}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                            {/* Expandable checkbox grid */}
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
                                      onChange={() => toggleFilmGenre(film.tmdbId, g)}
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
                                  onClick={() => removeFilmTag(film.tmdbId, tag)}
                                  className="hover:text-white"
                                  aria-label={`Remove tag ${tag}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            <input
                              type="text"
                              value={tagInputs[film.tmdbId] ?? ''}
                              onChange={(e) =>
                                setTagInputs((prev) => ({
                                  ...prev,
                                  [film.tmdbId]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ',') {
                                  e.preventDefault()
                                  addFilmTag(film.tmdbId, tagInputs[film.tmdbId] ?? '')
                                }
                              }}
                              onBlur={() =>
                                addFilmTag(film.tmdbId, tagInputs[film.tmdbId] ?? '')
                              }
                              placeholder="Add tag, press Enter…"
                              className="min-w-[140px] flex-1 rounded-md border border-border bg-transparent px-2 py-0.5 text-[11px] text-white placeholder-muted/40 outline-none focus:border-accent"
                            />
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={step === 1 ? onClose : () => setStep(1)}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:bg-surface-overlay hover:text-white"
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>

          <div className="flex flex-wrap justify-end gap-2">
            {step === 1 ? (
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canAdvance}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next: Add Films →
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:bg-surface-overlay hover:text-white"
                >
                  Skip & Save
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={films.length === 0}
                  className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Save Release
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Barcode scanner overlay ── */}
      {showScanner && (
        <BarcodeScanner
          onScan={(code) => {
            setBarcode(code)
            setShowScanner(false)
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}
