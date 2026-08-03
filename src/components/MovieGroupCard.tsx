import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { FilmGroup, LinkedFilm, Release } from '../types'
import { getPosterUrl } from '../services/tmdb'

interface FilmGroupCardProps {
  group: FilmGroup
  onUpdateRelease: (id: string, updates: Partial<Release>) => Promise<void>
}

// Shorten long format names to compact badge labels
function shortFormat(format: string): string {
  if (format === '4K Ultra HD Blu-ray') return '4K'
  if (format === 'Standard Blu-ray') return 'Blu-ray'
  if (format === 'HD DVD') return 'HD DVD'
  return format
}

export function FilmGroupCard({ group, onUpdateRelease }: FilmGroupCardProps) {
  const [expanded, setExpanded] = useState(false)

  /** Toggle watch state for a specific format of a film in a release. */
  function toggleFormatWatched(release: FilmGroup['releases'][number], film: LinkedFilm, fmt: string) {
    const isWatched = (film.watchedByFormat as Record<string, string> | undefined)?.[fmt] !== undefined
    const nextWatchedByFormat: Record<string, string> = { ...(film.watchedByFormat ?? {}) }

    if (isWatched) {
      delete nextWatchedByFormat[fmt]
    } else {
      nextWatchedByFormat[fmt] = new Date().toISOString()
    }

    const updatedFilms = release.films.map((f) =>
      f.tmdbId === film.tmdbId
        ? { ...f, watchedByFormat: nextWatchedByFormat }
        : f,
    )
    onUpdateRelease(release.id, { films: updatedFilms })
  }

  /** Toggle the watched state at the film level (for releases with no formats specified). */
  function toggleWatched(release: FilmGroup['releases'][number], film: LinkedFilm) {
    const updatedFilms = release.films.map((f) =>
      f.tmdbId === film.tmdbId
        ? { ...f, watchedAt: f.watchedAt ? null : new Date().toISOString() }
        : f,
    )
    onUpdateRelease(release.id, { films: updatedFilms })
  }

  // In the Films view, individual TMDB film posters take priority.
  // Only fall back to the release's custom cover art if there's no TMDB poster.
  const coverSrc =
    (group.posterPath ? getPosterUrl(group.posterPath) : null) ||
    group.releases[0]?.coverUrl ||
    null

  // Build a flat list of format copies across all releases for this film
  const formatCopies = group.releases.flatMap((release) => {
    const film = release.films.find((f) => f.tmdbId === group.tmdbId)
    if (!film) return []
    const formats = film.formats?.length ? film.formats : [null]
    return formats.map((fmt) => ({ release, film, format: fmt }))
  })

  const copyCount = formatCopies.length

  const watchedCount = formatCopies.filter(({ film, format }) =>
    format ? (film.watchedByFormat as Record<string, string> | undefined)?.[format] !== undefined : (!film.watchedByFormat && !!film.watchedAt)
  ).length

  // Single-copy films get a direct one-click toggle on the collapsed card.
  const singleCopy = copyCount === 1 ? formatCopies[0] : null
  const singleCopyWatched = singleCopy
    ? (singleCopy.format
        ? !!singleCopy.film.watchedByFormat?.[singleCopy.format]
        : !!singleCopy.film.watchedAt)
    : false

  return (
    <li>
      <div
        className={`flex h-full flex-col overflow-hidden rounded-xl border bg-surface-raised transition ${
          expanded
            ? 'border-accent/60 shadow-lg shadow-accent/5'
            : 'border-border hover:border-accent/60 hover:shadow-lg hover:shadow-accent/5'
        }`}
      >
        {/* ── Card top (clickable to expand) ── */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="group flex h-full flex-col text-left"
        >
          {/* Cover */}
          <div className="aspect-[2/3] overflow-hidden bg-surface-overlay">
            {coverSrc ? (
              <img
                src={coverSrc}
                alt={`${group.title} cover`}
                className="h-full w-full object-cover transition group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted">
                No cover
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col space-y-2 p-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-medium leading-snug text-white">
                {group.title}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Copy count annotation */}
              <span className="rounded-md bg-surface-overlay px-2 py-0.5 text-[10px] font-medium text-muted">
                {copyCount} {copyCount === 1 ? 'copy' : 'copies'}
              </span>

              {/* Watched status — single copy gets a direct toggle; multi-copy gets a progress summary */}
              {singleCopy ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (singleCopy.format && singleCopy.film) {
                      toggleFormatWatched(singleCopy.release, singleCopy.film, singleCopy.format)
                    } else if (singleCopy.film) {
                      toggleWatched(singleCopy.release, singleCopy.film)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      if (singleCopy.format && singleCopy.film) {
                        toggleFormatWatched(singleCopy.release, singleCopy.film, singleCopy.format)
                      } else if (singleCopy.film) {
                        toggleWatched(singleCopy.release, singleCopy.film)
                      }
                    }
                  }}
                  className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition ${
                    singleCopyWatched
                      ? 'bg-accent/15 text-accent-hover hover:bg-accent/25'
                      : 'border border-border text-muted hover:border-accent/50 hover:text-white'
                  }`}
                >
                  {singleCopyWatched ? '✓ Watched' : 'Mark watched'}
                </span>
              ) : (
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                    watchedCount === copyCount
                      ? 'bg-accent/15 text-accent-hover'
                      : 'bg-surface-overlay text-muted'
                  }`}
                >
                  {watchedCount} of {copyCount} watched
                </span>
              )}
            </div>
          </div>
        </button>

        {/* ── Expanded release list ── */}
        {expanded && (
          <div className="border-t border-border bg-surface-overlay px-3 py-2">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">
              Your copies
            </p>
            <ul className="space-y-1">
              {formatCopies.map(({ release, film, format }) => {
                const isWatched = format
                  ? (film.watchedByFormat as Record<string, string> | undefined)?.[format] !== undefined
                  : (!film.watchedByFormat && !!film.watchedAt)

                return (
                  <li key={`${release.id}-${format ?? 'default'}`}>
                    <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition hover:bg-surface-raised">
                      <Link
                        to={`/release/${release.id}`}
                        className="flex min-w-0 flex-1 items-center gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-white">
                            {release.title}
                          </p>
                          {(release.label || release.releaseYear) && (
                            <p className="truncate text-[10px] text-muted">
                              {[release.label, release.releaseYear]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                        {format && (
                          <span className="flex-shrink-0 rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-hover">
                            {shortFormat(format)}
                          </span>
                        )}
                      </Link>

                      {/* Quick "mark as watched" toggle for this copy */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (format) {
                            toggleFormatWatched(release, film, format)
                          } else {
                            toggleWatched(release, film)
                          }
                        }}
                        aria-label={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                        title={isWatched ? 'Watched' : 'Mark as watched'}
                        className={`flex-shrink-0 rounded-md border p-1 transition ${
                          isWatched
                            ? 'border-accent/40 bg-accent/15 text-accent'
                            : 'border-border text-muted hover:border-accent/50 hover:text-white'
                        }`}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                          {isWatched ? (
                            <path
                              fillRule="evenodd"
                              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                              clipRule="evenodd"
                            />
                          ) : (
                            <>
                              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                              <path
                                fillRule="evenodd"
                                d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                                clipRule="evenodd"
                              />
                            </>
                          )}
                        </svg>
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </li>
  )
}