import type { Movie } from '../types'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

interface TmdbSearchResponse {
  results: Movie[]
}

export function getPosterUrl(posterPath: string | null): string | null {
  if (!posterPath) return null
  return `${TMDB_IMAGE_BASE}${posterPath}`
}

export function getReleaseYear(releaseDate: string): string {
  if (!releaseDate) return '—'
  return releaseDate.slice(0, 4)
}

export async function searchMovies(query: string): Promise<Movie[]> {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY

  if (!apiKey || apiKey === 'your_tmdb_api_key_here') {
    throw new Error(
      'TMDB API key is missing. Add VITE_TMDB_API_KEY to your .env file.',
    )
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    query: query.trim(),
    include_adult: 'false',
  })

  const response = await fetch(`${TMDB_BASE}/search/movie?${params}`)

  if (!response.ok) {
    throw new Error(`TMDB request failed (${response.status})`)
  }

  const data: TmdbSearchResponse = await response.json()
  return data.results
}
