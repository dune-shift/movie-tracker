import { useEffect, useMemo, useRef, useState } from 'react'
import type { Release, LinkedFilm, Film } from '../types'
import { LABEL_OPTIONS } from '../types'
import { getPosterUrl, getReleaseYear, searchFilms } from '../services/tmdb'
import { uploadCoverImage } from '../services/storage'
import { BarcodeScanner } from './BarcodeScanner'
import { LinkedFilmEditor } from './LinkedFilmEditor'

// ── Label combobox ────────────────────────────────────────────────────────────

interface LabelComboboxProps {
  value: string
  onChange: (v: string) => void
}

function LabelCombobox({ value, onChange }: LabelComboboxProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = useMemo(() => {
    const q = value.toLowerCase()
    if (!q) return LABEL_OPTIONS as unknown as string[]
    return (LABEL_OPTIONS as unknown as string[]).filter((l) =>
      l.toLowerCase().includes(q),
    )
  }, [value])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  function commit(val: string) {
    onChange(val)
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
        setActiveIndex(0)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && filtered[activeIndex]) {
        commit(filtered[activeIndex])
      } else {
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        placeholder="e.g. Vinegar Syndrome"
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
      />
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-border bg-surface-raised py-1 shadow-xl"
        >
          {filtered.map((labelOption, i) => (
            <li
              key={labelOption}
              onMouseDown={(e) => {
                e.preventDefault()
                commit(labelOption)
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`cursor-pointer px-3 py-1.5 text-sm transition ${
                i === activeIndex
                  ? 'bg-accent/20 text-white'
                  : 'text-muted hover:bg-surface-overlay hover:text-white'
              }`}
            >
              {labelOption}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface AddReleaseModalProps {
  userId: string
  onSave: (release: Release) => void
  onClose: () => void
}

export function AddReleaseModal({ userId, onSave, onClose }: AddReleaseModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [isSaving, setIsSaving] = useState(false)

  // ── Step 1 fields ────────────────────────────────────────
  const [title, setTitle] = useState('')
  const [label, setLabel] = useState('')
  const [releaseYear, setReleaseYear] = useState<number | ''>('')
  const [spineNumber, setSpineNumber] = useState('')
  const [discCount, setDiscCount] = useState<number | ''>('')
  const [barcode, setBarcode] = useState('')
  const [notes, setNotes] = useState('')
  const [coverUrl, setCoverUrl] = useState('')        // preview URL (data URL or pasted URL)
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null) // compressed blob for upload
  const [coverUrlInput, setCoverUrlInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  // ── Step 2 fields ────────────────────────────────────────
  const [films, setFilms] = useState<LinkedFilm[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Film[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
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

      // Store compressed blob for Storage upload; use toDataURL only for preview
      canvas.toBlob(
        (blob) => {
          if (!blob) return
          setCoverBlob(blob)
          setCoverUrl(URL.createObjectURL(blob))
          setCoverUrlInput('')
        },
        'image/jpeg',
        0.8,
      )
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
    setCoverBlob(null)
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
      const results = await searchFilms(q)
      setSearchResults(results.slice(0, 10))
    } catch {
      setSearchError('Search failed. Check your API key.')
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  function addFilm(film: Film) {
    if (filmIds.has(film.id)) return
    setFilms((prev) => [
      ...prev,
      {
        tmdbId: film.id,
        title: film.title,
        year: getReleaseYear(film.release_date),
        posterPath: film.poster_path,
        format: '',
        genres: [],
        tags: [],
      },
    ])
    setSearchQuery('')
    setSearchResults([])
  }

  function removeFilm(tmdbId: number) {
    setFilms((prev) => prev.filter((f) => f.tmdbId !== tmdbId))
  }

  /** Called by LinkedFilmEditor when the user saves a film card. */
  function updateFilm(updated: LinkedFilm) {
    setFilms((prev) => prev.map((f) => (f.tmdbId === updated.tmdbId ? updated : f)))
  }

  // ── Save ────────────────────────────────────────────────
  async function handleSave() {
    if (!title.trim() || isSaving) return
    setIsSaving(true)

    let finalCoverUrl = coverUrl

    // If a file was uploaded, push it to Supabase Storage first
    if (coverBlob) {
      const releaseId = crypto.randomUUID()
      try {
        finalCoverUrl = await uploadCoverImage(userId, releaseId, new File([coverBlob], `${releaseId}.jpg`, { type: 'image/jpeg' }))
      } catch (err) {
        console.error('[AddReleaseModal] cover upload failed, continuing without cover', err)
        finalCoverUrl = ''
      }
      onSave({
        id: releaseId,
        title: title.trim(),
        label,
        releaseYear,
        spineNumber,
        discCount,
        barcode,
        notes,
        coverUrl: finalCoverUrl,
        films,
        specialFeatures: [],
        addedAt: new Date().toISOString(),
      })
    } else {
      onSave({
        id: crypto.randomUUID(),
        title: title.trim(),
        label,
        releaseYear,
        spineNumber,
        discCount,
        barcode,
        notes,
        coverUrl: finalCoverUrl,
        films,
        specialFeatures: [],
        addedAt: new Date().toISOString(),
      })
    }

    setIsSaving(false)
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
                  className={`relative aspect-[5/6] max-h-48 sm:max-h-none overflow-hidden rounded-lg border-2 transition ${
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
                      className="h-full w-full object-contain"
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
                <div>
                  <span className="mb-1.5 block text-xs text-muted">Label</span>
                  <LabelCombobox value={label} onChange={setLabel} />
                </div>

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
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  if (!e.target.value) setSearchResults([])
                }}
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
                {searchResults.map((film) => {
                  const added = filmIds.has(film.id)
                  const posterUrl = getPosterUrl(film.poster_path)
                  return (
                    <li key={film.id} className="border-b border-border last:border-0">
                      <div className="flex w-full items-center gap-3 px-3 py-2">
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
                            {film.title}
                          </p>
                          <p className="text-xs text-muted">
                            {getReleaseYear(film.release_date)}
                          </p>
                        </div>
                        {added ? (
                          <span className="flex-shrink-0 rounded-md bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
                            ✓ Added
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addFilm(film)}
                            className="flex-shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover"
                          >
                            Add to Release
                          </button>
                        )}
                      </div>
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
                  {films.map((film) => (
                    <li key={film.tmdbId}>
                      <LinkedFilmEditor
                        film={film}
                        autoSave
                        onSave={updateFilm}
                        onRemove={() => removeFilm(film.tmdbId)}
                      />
                    </li>
                  ))}
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
                  disabled={isSaving}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:bg-surface-overlay hover:text-white disabled:opacity-40"
                >
                  {isSaving ? 'Saving…' : 'Skip & Save'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={films.length === 0 || isSaving}
                  className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSaving ? 'Saving…' : 'Save Release'}
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
