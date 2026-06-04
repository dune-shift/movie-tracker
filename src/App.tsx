import { useCallback, useMemo, useState } from 'react'
import type { CollectionItem, Movie } from './types'
import { searchMovies } from './services/tmdb'
import { SearchBar } from './components/SearchBar'
import { SearchResults } from './components/SearchResults'
import { CollectionGrid } from './components/CollectionGrid'

function App() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Movie[]>([])
  const [collection, setCollection] = useState<CollectionItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const collectionIds = useMemo(
    () => new Set(collection.map((item) => item.id)),
    [collection],
  )

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim()
    if (!trimmed) return

    setIsLoading(true)
    setError(null)

    try {
      const movies = await searchMovies(trimmed)
      setResults(movies)
    } catch (err) {
      setResults([])
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setIsLoading(false)
    }
  }, [query])

  function addToCollection(movie: Movie) {
    if (collectionIds.has(movie.id)) return

    setCollection((prev) => [
      ...prev,
      {
        ...movie,
        format: '',
        edition: '',
      },
    ])
  }

  function updateCollectionItem(
    id: number,
    updates: Partial<Pick<CollectionItem, 'format' | 'edition'>>,
  ) {
    setCollection((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    )
  }

  function removeFromCollection(id: number) {
    setCollection((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-10 border-b border-border pb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Shelf Stable Movie Tracker
        </h1>
        <p className="mt-2 text-sm text-muted">
          Search TMDB and build your personal physical media collection.
        </p>
      </header>

      <section className="mb-12">
        <SearchBar
          value={query}
          onChange={setQuery}
          onSubmit={handleSearch}
          isLoading={isLoading}
        />

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}

        <SearchResults
          results={results}
          collectionIds={collectionIds}
          onSelect={addToCollection}
        />
      </section>

      <section>
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-lg font-medium text-white">My Collection</h2>
          <span className="text-sm text-muted">
            {collection.length} {collection.length === 1 ? 'title' : 'titles'}
          </span>
        </div>

        <CollectionGrid
          items={collection}
          onUpdate={updateCollectionItem}
          onRemove={removeFromCollection}
        />
      </section>
    </div>
  )
}

export default App
