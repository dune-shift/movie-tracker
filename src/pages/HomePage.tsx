import { useMemo, useState } from 'react'
import type { Genre, FilmGroup, Release } from '../types'
import { FORMAT_OPTIONS, GENRE_OPTIONS } from '../types'
import { CollectionGrid } from '../components/CollectionGrid'
import { AddReleaseModal } from '../components/AddReleaseModal'

interface HomePageProps {
  releases: Release[]
  loading: boolean
  userId: string
  onAddRelease: (release: Release) => Promise<void>
  onUpdateRelease: (id: string, updates: Partial<Release>) => Promise<void>
}


type ViewMode = 'releases' | 'films'

// Build a de-duplicated list of FilmGroups from a flat releases array.
// Each linked film in a release gets its own FilmGroup entry. Releases that
// share the same film (same tmdbId) collapse into one group with multiple
// copies. Releases with no linked films fall back to a title-keyed group.
function buildFilmGroups(releases: Release[]): FilmGroup[] {
  const map = new Map<string, FilmGroup>()

  for (const release of releases) {
    if (release.films.length === 0) {
      // No linked films — skip in Films view (still shown in Releases view)
      continue
    } else {
      // Create (or contribute to) a group for every film in this release
      for (const film of release.films) {
        const key = `tmdb-${film.tmdbId}`
        if (map.has(key)) {
          const group = map.get(key)!
          // Avoid adding the same release more than once to a group
          if (!group.releases.some((r) => r.id === release.id)) {
            group.releases.push(release)
            // Merge any new genres from this film instance
            for (const g of (film.genres ?? [])) {
              if (!group.genres.includes(g)) group.genres.push(g)
            }
          }
        } else {
          map.set(key, {
            key,
            tmdbId: film.tmdbId,
            title: film.title,
            posterPath: film.posterPath,
            genres: [...(film.genres ?? [])],
            releases: [release],
          })
        }
      }
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

export function HomePage({ releases, loading, userId, onAddRelease, onUpdateRelease }: HomePageProps) {

  const [showModal, setShowModal] = useState(false)
  const [filterLabel, setFilterLabel] = useState('')
  const [filterFormat, setFilterFormat] = useState('')
  const [filterGenre, setFilterGenre] = useState<Genre | ''>('')
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
      releases.some((r) => r.films.some((film) => film.formats?.includes(f))),
    )
  }, [releases])

  // Only show genre options actually used in the collection
  const availableGenres = useMemo(() => {
    return GENRE_OPTIONS.filter((g) =>
      releases.some((r) => r.films.some((f) => f.genres?.includes(g))),
    )
  }, [releases])

  const filteredReleases = useMemo(() => {
    return releases.filter((r) => {
      if (filterLabel && r.label !== filterLabel) return false
      if (filterFormat && !r.films.some((f) => f.formats?.includes(filterFormat as typeof FORMAT_OPTIONS[number]))) return false
      if (filterGenre && !r.films.some((f) => f.genres?.includes(filterGenre as Genre))) return false
      return true
    })
  }, [releases, filterLabel, filterFormat, filterGenre])

  // Groups for the full (unfiltered) collection — used for the total count.
  // Memoised separately so countLabel doesn't trigger a second full traversal.
  const allFilmGroups = useMemo(
    () => buildFilmGroups(releases),
    [releases],
  )

  const filmGroups = useMemo(
    () => buildFilmGroups(filteredReleases),
    [filteredReleases],
  )

  const hasActiveFilter = filterLabel !== '' || filterFormat !== '' || filterGenre !== ''

  // Count label for the subtitle — varies by view mode
  const countLabel = useMemo(() => {
    if (releases.length === 0) return 'No releases yet'
    if (viewMode === 'films') {
      const total = allFilmGroups.length
      const shown = filmGroups.length
      if (hasActiveFilter) {
        return `${shown} of ${total} ${total === 1 ? 'film' : 'films'}`
      }
      return `${total} ${total === 1 ? 'film' : 'films'}`
    }
    if (hasActiveFilter) {
      return `${filteredReleases.length} of ${releases.length} ${releases.length === 1 ? 'release' : 'releases'}`
    }
    return `${releases.length} ${releases.length === 1 ? 'release' : 'releases'}`
  }, [releases, filteredReleases, allFilmGroups, filmGroups, viewMode, hasActiveFilter])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="h-5 w-32 animate-pulse rounded-md bg-surface-overlay" />
            <div className="mt-1.5 h-4 w-20 animate-pulse rounded-md bg-surface-overlay" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-surface-overlay" />
          ))}
        </div>
      </div>
    )
  }

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
                onClick={() => setViewMode('films')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  viewMode === 'films'
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-white'
                }`}
              >
                Films
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
            <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted">
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </div>

          {/* Genre filter — only shown when genres exist in the collection */}
          {availableGenres.length > 0 && (
            <div className="relative">
              <select
                value={filterGenre}
                onChange={(e) => setFilterGenre(e.target.value as Genre | '')}
                className={`appearance-none rounded-lg border px-3 py-1.5 pr-7 text-sm outline-none transition focus:border-accent ${
                  filterGenre
                    ? 'border-accent bg-accent/10 text-white'
                    : 'border-border bg-surface-overlay text-muted hover:border-accent/50 hover:text-white'
                }`}
              >
                <option value="">All Genres</option>
                {availableGenres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted">
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </div>
          )}

          {/* Clear filters button */}
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setFilterLabel('')
                setFilterFormat('')
                setFilterGenre('')
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
        filmGroups={filmGroups}
        onUpdateRelease={onUpdateRelease}
      />


      {showModal && (
        <AddReleaseModal
          userId={userId}
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
