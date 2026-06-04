import type { Movie } from '../types'
import { getPosterUrl, getReleaseYear } from '../services/tmdb'

interface SearchResultsProps {
  results: Movie[]
  collectionIds: Set<number>
  onSelect: (movie: Movie) => void
}

export function SearchResults({
  results,
  collectionIds,
  onSelect,
}: SearchResultsProps) {
  if (results.length === 0) return null

  return (
    <div className="mt-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted">
        Search Results
      </h2>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {results.map((movie) => {
          const inCollection = collectionIds.has(movie.id)
          const posterUrl = getPosterUrl(movie.poster_path)

          return (
            <li key={movie.id}>
              <button
                type="button"
                onClick={() => onSelect(movie)}
                disabled={inCollection}
                className="group w-full overflow-hidden rounded-xl border border-border bg-surface-raised text-left transition hover:border-accent/60 hover:shadow-lg hover:shadow-accent/5 disabled:cursor-default disabled:opacity-60"
              >
                <div className="aspect-[2/3] overflow-hidden bg-surface-overlay">
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={`${movie.title} poster`}
                      className="h-full w-full object-cover transition group-hover:scale-105 group-disabled:group-hover:scale-100"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted">
                      No poster
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-white">
                    {movie.title}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {getReleaseYear(movie.release_date)}
                  </p>
                  {inCollection && (
                    <p className="mt-2 text-xs font-medium text-accent">
                      In collection
                    </p>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
