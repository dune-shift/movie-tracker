import { useEffect, useState } from 'react'
import type { Movie } from '../types'
import { getPosterUrl, getReleaseYear } from '../services/tmdb'

const INITIAL_VISIBLE = 5

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
  const [expanded, setExpanded] = useState(false)

  // Collapse back to first row whenever a new search is run
  useEffect(() => {
    setExpanded(false)
  }, [results])

  if (results.length === 0) return null

  const hasMore = results.length > INITIAL_VISIBLE
  const visibleResults = expanded ? results : results.slice(0, INITIAL_VISIBLE)
  const hiddenCount = results.length - INITIAL_VISIBLE

  return (
    <div className="mt-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted">
        Search Results
      </h2>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {visibleResults.map((movie) => {
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

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2.5 text-sm text-muted transition hover:bg-surface-overlay hover:text-white"
        >
          {expanded ? (
            <>
              Show less
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className="h-4 w-4 rotate-180"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.25a.75.75 0 01-1.06 0l-4.24-4.25a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </>
          ) : (
            <>
              Show {hiddenCount} more result{hiddenCount !== 1 ? 's' : ''}
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.25a.75.75 0 01-1.06 0l-4.24-4.25a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  )
}
