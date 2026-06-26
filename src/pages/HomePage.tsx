import { useMemo, useState } from 'react'
import type { MovieGroup, Release } from '../types'
import { FORMAT_OPTIONS } from '../types'
import { CollectionGrid } from '../components/CollectionGrid'
import { AddReleaseModal } from '../components/AddReleaseModal'

interface HomePageProps {
  releases: Release[]
  onAddRelease: (release: Release) => void
}

type ViewMode = 'releases' | 'movies'

// Build a de-duplicated list of MovieGroups from a flat releases array.
// Grouping key priority:
//   1. Primary linked film's tmdbId  (releases that share the same film collapse)
//   2. Release title                 (fallback for releases with no linked film)
function buildMovieGroups(releases: Release[]): MovieGroup[] {
  const map = new Map<string, MovieGroup>()

  for (const release of releases) {
    const primaryFilm = release.films[0] ?? null
    const key = primaryFilm ? `tmdb-${primaryFilm.tmdbId}` : `title-${release.title}`

    if (map.has(key)) {
      map.get(key)!.releases.push(release)
    } else {
      map.set(key, {
        key,
        tmdbId: primaryFilm?.tmdbId ?? null,
        title: primaryFilm?.title ?? release.title,
        posterPath: primaryFilm?.posterPath ?? null,
        releases: [release],
      })
    }
  }

  // Sort: groups with multiple copies first, then alphabetically
  return [...map.values()].sort((a, b) => {
    if (b.releases.length !== a.releases.length) {
      return b.releases.length - a.releases.length
    }
    return a.title.localeCompare(b.title)
  })
}

export function HomePage({ releases, onAddRelease }: HomePageProps) {
  const [showModal, setShowModal] = useState(false)
  const [filterLabel, setFilterLabel] = useState('')
  const [filterFormat, setFilterFormat] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('releases')

  // Derive unique labels present in the collection (sorted)
  const availableLabels = useMemo(() => {
    const labels = releases
      .map((r) => r.label)
      .filter((l) => l.trim() !== '')
    return [...new Set(labels)].sort()
  }, [releases])

  // Derive unique formats present in the collection (from per-film formats)
  const availableFormats = useMemo(() => {
    return FORMAT_OPTIONS.filter((f) =>
      releases.some((r) => r.films.some((film) => film.format === f)),
    )
  }, [releases])

  const filteredReleases = useMemo(() => {
    return releases.filter((r) => {
      if (filterLabel && r.label !== filterLabel) return false
      if (filterFormat && !r.films.some((f) => f.format === filterFormat))
        return false
      return true
    })
  }, [releases, filterLabel, filterFormat])

  const movieGroups = useMemo(
    () => buildMovieGroups(filteredReleases),
    [filteredReleases],
  )

  const hasActiveFilter = filterLabel !== '' || filterFormat !== ''

  // Count label for the subtitle — varies by view mode
  const countLabel = useMemo(() => {
    if (releases.length === 0) return 'No releases yet'
    if (viewMode === 'movies') {
      const total = buildMovieGroups(releases).length
      const shown = movieGroups.length
      if (hasActiveFilter) {
        return `${shown} of ${total} ${total === 1 ? 'film' : 'films'}`
      }
      return `${total} ${total === 1 ? 'film' : 'films'}`
    }
    if (hasActiveFilter) {
      return `${filteredReleases.length} of ${releases.length} ${releases.length === 1 ? 'release' : 'releases'}`
    }
    return `${releases.length} ${releases.length === 1 ? 'release' : 'releases'}`
  }, [releases, filteredReleases, movieGroups, viewMode, hasActiveFilter])

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-white">My Collection</h2>
          <p className="mt-0.5 text-sm text-muted">{countLabel}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* ── View mode toggle ── */}
          {releases.length > 0 && (
            <div className="flex rounded-lg border border-border bg-surface-overlay p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('releases')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  viewMode === 'releases'
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-white'
                }`}
              >
                Releases
              </button>
              <button
                type="button"
                onClick={() => setViewMode('movies')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  viewMode === 'movies'
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-white'
                }`}
              >
                Movies
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            + Add Release
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      {releases.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {/* Label filter */}
          <div className="relative">
            <select
              value={filterLabel}
              onChange={(e) => setFilterLabel(e.target.value)}
              className={`appearance-none rounded-lg border px-3 py-1.5 pr-7 text-sm outline-none transition focus:border-accent ${
                filterLabel
                  ? 'border-accent bg-accent/10 text-white'
                  : 'border-border bg-surface-overlay text-muted hover:border-accent/50 hover:text-white'
              }`}
            >
              <option value="">All Labels</option>
              {availableLabels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            {/* Chevron icon */}
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
            >
              <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          {/* Format filter */}
          <div className="relative">
            <select
              value={filterFormat}
              onChange={(e) => setFilterFormat(e.target.value)}
              className={`appearance-none rounded-lg border px-3 py-1.5 pr-7 text-sm outline-none transition focus:border-accent ${
                filterFormat
                  ? 'border-accent bg-accent/10 text-white'
                  : 'border-border bg-surface-overlay text-muted hover:border-accent/50 hover:text-white'
              }`}
            >
              <option value="">All Formats</option>
              {availableFormats.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            {/* Chevron icon */}
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
            >
              <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          {/* Clear filters button */}
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setFilterLabel('')
                setFilterFormat('')
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:border-accent/50 hover:text-white"
            >
              ✕ Clear
            </button>
          )}
        </div>
      )}

      <CollectionGrid
        releases={filteredReleases}
        viewMode={viewMode}
        movieGroups={movieGroups}
      />

      {showModal && (
        <AddReleaseModal
          onSave={(release) => {
            onAddRelease(release)
            setShowModal(false)
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
