import { useMemo, useState } from 'react'
import type { Genre, Release } from '../types'
import { CollectionGrid } from '../components/CollectionGrid'
import { AddReleaseModal } from '../components/AddReleaseModal'
import {
  buildFilmGroups,
  filterReleases,
  availableLabels,
  availableFormats,
  availableGenres,
  countLabel,
  type ViewMode,
} from '../queries/collection'

interface HomePageProps {
  releases: Release[]
  loading: boolean
  userId: string
  onAddRelease: (release: Release) => Promise<void>
  onUpdateRelease: (id: string, updates: Partial<Release>) => Promise<void>
}

export function HomePage({ releases, loading, userId, onAddRelease, onUpdateRelease }: HomePageProps) {
  const [showModal, setShowModal] = useState(false)
  const [filterLabel, setFilterLabel] = useState('')
  const [filterFormat, setFilterFormat] = useState('')
  const [filterGenre, setFilterGenre] = useState<Genre | ''>('')
  const [viewMode, setViewMode] = useState<ViewMode>('releases')

  const labels = useMemo(() => availableLabels(releases), [releases])
  const formats = useMemo(() => availableFormats(releases), [releases])
  const genres = useMemo(() => availableGenres(releases), [releases])

  const filtered = useMemo(
    () => filterReleases(releases, { label: filterLabel || undefined, format: filterFormat || undefined, genre: filterGenre || undefined }),
    [releases, filterLabel, filterFormat, filterGenre],
  )

  const allFilmGroups = useMemo(() => buildFilmGroups(releases), [releases])
  const filmGroups = useMemo(() => buildFilmGroups(filtered), [filtered])

  const hasActiveFilter = filterLabel !== '' || filterFormat !== '' || filterGenre !== ''

  const subtitle = useMemo(
    () => countLabel(releases.length, allFilmGroups.length, filtered.length, filmGroups.length, viewMode, hasActiveFilter),
    [releases.length, allFilmGroups.length, filtered.length, filmGroups.length, viewMode, hasActiveFilter],
  )

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
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
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
              {labels.map((l) => (
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
              {formats.map((f) => (
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
          {genres.length > 0 && (
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
                {genres.map((g) => (
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
        releases={filtered}
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