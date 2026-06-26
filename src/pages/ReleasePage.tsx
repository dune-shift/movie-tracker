import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type {
  Format,
  LinkedFilm,
  Movie,
  MovieDetails,
  Release,
  WatchProviderData,
} from '../types'
import { FORMAT_OPTIONS, LABEL_OPTIONS } from '../types'
import { CollapsibleSection } from '../components/CollapsibleSection'
import {
  formatRuntime,
  getMovieDetails,
  getPosterUrl,
  getProviderLogoUrl,
  getReleaseYear,
  getWatchProviders,
  searchMovies,
} from '../services/tmdb'

interface ReleasePageProps {
  releases: Release[]
  onUpdate: (id: string, updates: Partial<Release>) => void
  onRemove: (id: string) => void
}

export function ReleasePage({ releases, onUpdate, onRemove }: ReleasePageProps) {
  const { id } = useParams()
  const navigate = useNavigate()

  const release = releases.find((r) => r.id === id)

  const [filmDetails, setFilmDetails] = useState<Record<number, MovieDetails>>(
    {},
  )
  const [filmProviders, setFilmProviders] = useState<
    Record<number, WatchProviderData | null>
  >({})
  const fetchedFilmIds = useRef<Set<number>>(new Set())

  // ── Add-film search state ────────────────────────────────
  const [showFilmSearch, setShowFilmSearch] = useState(false)
  const [filmSearchQuery, setFilmSearchQuery] = useState('')
  const [filmSearchResults, setFilmSearchResults] = useState<Movie[]>([])
  const [isFilmSearching, setIsFilmSearching] = useState(false)
  const [filmSearchError, setFilmSearchError] = useState<string | null>(null)

  useEffect(() => {
    if (!release) {
      navigate('/', { replace: true })
      return
    }

    for (const film of release.films) {
      if (fetchedFilmIds.current.has(film.tmdbId)) continue
      fetchedFilmIds.current.add(film.tmdbId)

      getMovieDetails(film.tmdbId)
        .then((data) =>
          setFilmDetails((prev) => ({ ...prev, [film.tmdbId]: data })),
        )
        .catch(() => {})

      getWatchProviders(film.tmdbId)
        .then((data) =>
          setFilmProviders((prev) => ({ ...prev, [film.tmdbId]: data })),
        )
        .catch(() => {})
    }
  }, [release, navigate])

  async function handleFilmSearch() {
    const q = filmSearchQuery.trim()
    if (!q) return
    setIsFilmSearching(true)
    setFilmSearchError(null)
    try {
      const results = await searchMovies(q)
      setFilmSearchResults(results.slice(0, 10))
    } catch {
      setFilmSearchError('Search failed. Check your API key.')
      setFilmSearchResults([])
    } finally {
      setIsFilmSearching(false)
    }
  }

  function addFilmToRelease(movie: Movie) {
    if (!release) return
    if (release.films.some((f) => f.tmdbId === movie.id)) return
    const newFilm: LinkedFilm = {
      tmdbId: movie.id,
      title: movie.title,
      year: getReleaseYear(movie.release_date),
      posterPath: movie.poster_path,
      format: '',
    }
    onUpdate(release.id, { films: [...release.films, newFilm] })
  }

  function removeFilmFromRelease(tmdbId: number) {
    if (!release) return
    onUpdate(release.id, {
      films: release.films.filter((f) => f.tmdbId !== tmdbId),
    })
  }

  function updateFilmFormat(tmdbId: number, fmt: Format | '') {
    if (!release) return
    onUpdate(release.id, {
      films: release.films.map((f) =>
        f.tmdbId === tmdbId ? { ...f, format: fmt } : f,
      ),
    })
  }

  if (!release) return null

  const coverSrc =
    release.coverUrl ||
    (release.films[0]?.posterPath
      ? getPosterUrl(release.films[0].posterPath)
      : null)

  function handleRemove() {
    onRemove(release!.id)
    navigate('/')
  }

  function field(
    label: string,
    value: string,
    key: keyof Release,
    type: 'text' | 'number' = 'text',
  ) {
    return (
      <label key={key}>
        <span className="mb-1.5 block text-xs text-muted">{label}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onUpdate(release!.id, { [key]: e.target.value })}
          className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white outline-none focus:border-accent"
        />
      </label>
    )
  }

  return (
    <div>
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted transition hover:text-white"
      >
        ← Back to collection
      </Link>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr] xl:grid-cols-[280px_1fr]">

        {/* ── Cover ── */}
        <div className="mx-auto w-full max-w-[280px] lg:max-w-none">
          <div className="aspect-[2/3] overflow-hidden rounded-xl border border-border bg-surface-overlay">
            {coverSrc ? (
              <img
                src={coverSrc}
                alt={`${release.title} cover`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted">
                No cover
              </div>
            )}
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="space-y-8">

          {/* Header */}
          <header>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">
              {release.title}
            </h1>
            {(release.label || release.releaseYear) && (
              <p className="mt-2 text-muted">
                {[release.label, release.releaseYear].filter(Boolean).join(' · ')}
              </p>
            )}
          </header>

          {/* Release metadata */}
          {(release.spineNumber || release.discCount || release.barcode) && (
            <dl className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {release.spineNumber && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted">
                    Spine / Catalog #
                  </dt>
                  <dd className="mt-1 text-sm text-white">{release.spineNumber}</dd>
                </div>
              )}
              {release.discCount && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted">
                    Discs
                  </dt>
                  <dd className="mt-1 text-sm text-white">{release.discCount}</dd>
                </div>
              )}
              {release.barcode && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted">
                    Barcode / UPC
                  </dt>
                  <dd className="mt-1 font-mono text-sm text-white">
                    {release.barcode}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {release.notes && (
            <div className="rounded-xl border border-border bg-surface-raised px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                Notes
              </p>
              <p className="mt-1 text-sm text-white">{release.notes}</p>
            </div>
          )}

          {/* ── Films ── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">
                Films in this Release{' '}
                <span className="font-normal text-muted">
                  ({release.films.length})
                </span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowFilmSearch((v) => !v)
                  setFilmSearchQuery('')
                  setFilmSearchResults([])
                  setFilmSearchError(null)
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:bg-surface-overlay hover:text-white"
              >
                {showFilmSearch ? '✕ Cancel' : '+ Add Film'}
              </button>
            </div>

            {/* Search panel */}
            {showFilmSearch && (
              <div className="mb-4 rounded-xl border border-border bg-surface-raised p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={filmSearchQuery}
                    onChange={(e) => setFilmSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFilmSearch()}
                    placeholder="Search TMDB for a film…"
                    autoFocus
                    className="flex-1 rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={handleFilmSearch}
                    disabled={isFilmSearching || !filmSearchQuery.trim()}
                    className="rounded-lg border border-border bg-surface-overlay px-4 py-2 text-sm text-muted transition hover:bg-surface-raised hover:text-white disabled:opacity-40"
                  >
                    {isFilmSearching ? '…' : 'Search'}
                  </button>
                </div>

                {filmSearchError && (
                  <p className="mt-2 text-xs text-red-400">{filmSearchError}</p>
                )}

                {filmSearchResults.length > 0 && (
                  <ul className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-border bg-surface-overlay">
                    {filmSearchResults.map((movie) => {
                      const alreadyAdded = release.films.some(
                        (f) => f.tmdbId === movie.id,
                      )
                      const posterUrl = getPosterUrl(movie.poster_path)
                      return (
                        <li
                          key={movie.id}
                          className="border-b border-border last:border-0"
                        >
                          <button
                            type="button"
                            onClick={() => addFilmToRelease(movie)}
                            disabled={alreadyAdded}
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
                              className={`flex-shrink-0 text-xs ${alreadyAdded ? 'text-accent' : 'text-muted'}`}
                            >
                              {alreadyAdded ? '✓ Added' : '+ Add'}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}

            {release.films.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted">
                No films linked yet. Use the "Add Film" button above to link films.
              </div>
            ) : (
              <div className="space-y-3">
                {release.films.map((film) => {
                  const details = filmDetails[film.tmdbId]
                  const providers = filmProviders[film.tmdbId]
                  const posterUrl = getPosterUrl(
                    details?.poster_path ?? film.posterPath ?? null,
                  )

                  const streamingProviders = [
                    ...(providers?.flatrate ?? []),
                    ...(providers?.free ?? []),
                    ...(providers?.ads ?? []),
                  ]
                    .filter(
                      (p, i, a) =>
                        a.findIndex((q) => q.provider_id === p.provider_id) ===
                        i,
                    )
                    .sort((a, b) => a.display_priority - b.display_priority)
                    .slice(0, 6)

                  const purchaseProviders = [
                    ...(providers?.buy ?? []),
                    ...(providers?.rent ?? []),
                  ]
                    .filter(
                      (p, i, a) =>
                        a.findIndex((q) => q.provider_id === p.provider_id) ===
                        i,
                    )
                    .sort((a, b) => a.display_priority - b.display_priority)
                    .slice(0, 6)

                  return (
                    <div
                      key={film.tmdbId}
                      className="relative rounded-xl border border-border bg-surface-raised p-4"
                    >
                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => removeFilmFromRelease(film.tmdbId)}
                        className="absolute right-3 top-3 rounded-full p-1 text-muted transition hover:bg-surface-overlay hover:text-white"
                        aria-label={`Remove ${film.title}`}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>

                      <div className="flex gap-4">
                        {/* Poster */}
                        <div className="flex-shrink-0">
                          <div className="h-24 w-16 overflow-hidden rounded-lg border border-border bg-surface-overlay">
                            {posterUrl ? (
                              <img
                                src={posterUrl}
                                alt={film.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full" />
                            )}
                          </div>
                        </div>

                        {/* Film info */}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white">{film.title}</p>
                          <p className="text-xs text-muted">{film.year}</p>

                          {/* Per-film format selector */}
                          <select
                            value={film.format ?? ''}
                            onChange={(e) =>
                              updateFilmFormat(film.tmdbId, e.target.value as Format | '')
                            }
                            className="mt-1.5 rounded-md border border-border bg-surface-overlay px-2 py-1 text-xs text-white outline-none focus:border-accent"
                          >
                            <option value="">Set format…</option>
                            {FORMAT_OPTIONS.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>

                          {details && (
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                              {details.director && (
                                <span>Dir. {details.director}</span>
                              )}
                              {details.runtime && (
                                <span>{formatRuntime(details.runtime)}</span>
                              )}
                            </div>
                          )}

                          {/* Watch providers */}
                          {film.tmdbId in filmProviders &&
                            (streamingProviders.length > 0 ||
                              purchaseProviders.length > 0) && (
                              <div className="mt-3 space-y-2">
                                {streamingProviders.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
                                      Stream
                                    </span>
                                    <div className="flex gap-1">
                                      {streamingProviders.map((p) => (
                                        <img
                                          key={p.provider_id}
                                          src={getProviderLogoUrl(p.logo_path)}
                                          alt={p.provider_name}
                                          title={p.provider_name}
                                          className="h-5 w-5 rounded-sm object-cover"
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {purchaseProviders.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
                                      Buy
                                    </span>
                                    <div className="flex gap-1">
                                      {purchaseProviders.map((p) => (
                                        <img
                                          key={p.provider_id}
                                          src={getProviderLogoUrl(p.logo_path)}
                                          alt={p.provider_name}
                                          title={p.provider_name}
                                          className="h-5 w-5 rounded-sm object-cover"
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                        </div>
                      </div>

                      {/* Crew / Cast */}
                      {details &&
                        (details.topCrew.length > 0 ||
                          details.topCast.length > 0) && (
                          <div className="mt-3 space-y-2 border-t border-border pt-3">
                            {details.topCrew.length > 0 && (
                              <CollapsibleSection
                                title="Crew"
                                count={details.topCrew.length}
                              >
                                <ul className="space-y-1.5">
                                  {details.topCrew.map((m) => (
                                    <li
                                      key={`${m.job}-${m.name}`}
                                      className="flex flex-wrap gap-x-2 text-sm"
                                    >
                                      <span className="text-muted">{m.job}</span>
                                      <span className="text-white">{m.name}</span>
                                    </li>
                                  ))}
                                </ul>
                              </CollapsibleSection>
                            )}
                            {details.topCast.length > 0 && (
                              <CollapsibleSection
                                title="Cast"
                                count={details.topCast.length}
                              >
                                <ul className="space-y-1.5">
                                  {details.topCast.map((m) => (
                                    <li
                                      key={`${m.name}-${m.character}`}
                                      className="flex flex-wrap gap-x-2 text-sm"
                                    >
                                      <span className="text-white">{m.name}</span>
                                      <span className="text-muted">
                                        as {m.character}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </CollapsibleSection>
                            )}
                          </div>
                        )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Edit Release ── */}
          <section className="rounded-xl border border-border bg-surface-raised p-5">
            <h2 className="mb-4 text-sm font-medium text-white">Edit Release</h2>

            {/* Cover art */}
            <div className="mb-4">
              <p className="mb-1.5 text-xs text-muted">Cover Art URL</p>
              <input
                type="url"
                value={release.coverUrl}
                onChange={(e) => onUpdate(release.id, { coverUrl: e.target.value })}
                placeholder="https://… or leave blank to use TMDB poster"
                className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {field('Title', release.title, 'title')}

              {/* Label */}
              <label>
                <span className="mb-1.5 block text-xs text-muted">Label</span>
                <input
                  type="text"
                  list="edit-label-options"
                  value={release.label}
                  onChange={(e) => onUpdate(release.id, { label: e.target.value })}
                  className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
                <datalist id="edit-label-options">
                  {LABEL_OPTIONS.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </label>

              {field('Release Year', release.releaseYear, 'releaseYear', 'number')}
              {field('Spine / Catalog #', release.spineNumber, 'spineNumber')}
              {field('Disc Count', release.discCount, 'discCount', 'number')}
              {field('Barcode / UPC', release.barcode, 'barcode')}
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs text-muted">Notes</span>
              <textarea
                value={release.notes}
                onChange={(e) => onUpdate(release.id, { notes: e.target.value })}
                rows={2}
                className="w-full resize-none rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white outline-none focus:border-accent"
              />
            </label>

            <button
              type="button"
              onClick={handleRemove}
              className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
            >
              Remove from collection
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
