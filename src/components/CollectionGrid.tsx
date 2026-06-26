import { Link } from 'react-router-dom'
import type { Format, MovieGroup, Release } from '../types'
import { getPosterUrl } from '../services/tmdb'
import { MovieGroupCard } from './MovieGroupCard'

interface CollectionGridProps {
  releases: Release[]
  viewMode: 'releases' | 'movies'
  movieGroups: MovieGroup[]
}

export function CollectionGrid({
  releases,
  viewMode,
  movieGroups,
}: CollectionGridProps) {
  if (releases.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-raised/50 px-6 py-20 text-center">
        <p className="text-sm text-muted">Your collection is empty.</p>
        <p className="mt-1 text-xs text-muted/60">
          Click "Add Release" to log your first physical release.
        </p>
      </div>
    )
  }

  // ── Movies view ──────────────────────────────────────────
  if (viewMode === 'movies') {
    return (
      <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {movieGroups.map((group) => (
          <MovieGroupCard key={group.key} group={group} />
        ))}
      </ul>
    )
  }

  // ── Releases view (default) ──────────────────────────────
  return (
    <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {releases.map((release) => {
        // Cover priority: custom cover → first linked film's TMDB poster → null
        const coverSrc =
          release.coverUrl ||
          (release.films[0]?.posterPath
            ? getPosterUrl(release.films[0].posterPath)
            : null)

        return (
          <li key={release.id}>
            <Link
              to={`/release/${release.id}`}
              className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface-raised transition hover:border-accent/60 hover:shadow-lg hover:shadow-accent/5"
            >
              {/* Cover */}
              <div className="aspect-[2/3] overflow-hidden bg-surface-overlay">
                {coverSrc ? (
                  <img
                    src={coverSrc}
                    alt={`${release.title} cover`}
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
                    {release.title}
                  </p>
                  {(release.label || release.releaseYear) && (
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {[release.label, release.releaseYear]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    ...new Set(
                      release.films
                        .map((f) => f.format)
                        .filter((f): f is Format => !!f),
                    ),
                  ].map((fmt) => (
                    <span
                      key={fmt}
                      className="rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent-hover"
                    >
                      {fmt === '4K Ultra HD Blu-ray'
                        ? '4K'
                        : fmt === 'Standard Blu-ray'
                          ? 'Blu-ray'
                          : fmt}
                    </span>
                  ))}
                  {Number(release.discCount) > 1 && (
                    <span className="rounded-md bg-surface-overlay px-2 py-0.5 text-[10px] font-medium text-muted">
                      {release.discCount} discs
                    </span>
                  )}
                  {release.films.length > 1 && (
                    <span className="rounded-md bg-surface-overlay px-2 py-0.5 text-[10px] font-medium text-muted">
                      {release.films.length} films
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
