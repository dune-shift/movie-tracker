import { useState } from 'react'
import type { Film } from '../types'
import { getPosterUrl, getReleaseYear } from '../services/tmdb'

interface FilmSearchPanelProps {
  onSelect: (film: Film) => void
  disabledFilmIds?: Set<number>
}

export function FilmSearchPanel({ onSelect, disabledFilmIds }: FilmSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Film[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch() {
    const q = query.trim()
    if (!q) return
    setIsSearching(true)
    setError(null)
    try {
      const { searchFilms } = await import('../services/tmdb')
      const data = await searchFilms(q)
      setResults(data.slice(0, 10))
    } catch {
      setError('Search failed. Check your API key.')
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setResults([])
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search for a film on TMDB…"
          autoFocus
          className="flex-1 rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className="rounded-lg border border-border bg-surface-overlay px-4 py-2 text-sm text-muted transition hover:bg-surface-raised hover:text-white disabled:opacity-40"
        >
          {isSearching ? '…' : 'Search'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface-overlay">
          {results.map((film) => {
            const alreadyAdded = disabledFilmIds?.has(film.id)
            const posterUrl = getPosterUrl(film.poster_path)
            return (
              <li key={film.id} className="border-b border-border last:border-0">
                <button
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => {
                    onSelect(film)
                    setQuery('')
                    setResults([])
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-surface-raised disabled:opacity-40"
                >
                  <div className="h-12 w-8 flex-shrink-0 overflow-hidden rounded border border-border bg-surface-raised">
                    {posterUrl ? (
                      <img src={posterUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full bg-surface-overlay" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{film.title}</p>
                    <p className="text-xs text-muted">{getReleaseYear(film.release_date)}</p>
                  </div>
                  {alreadyAdded && (
                    <span className="flex-shrink-0 rounded-md bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
                      ✓ Added
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}