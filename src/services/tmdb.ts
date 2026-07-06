import type {
  Movie,
  MovieCastMember,
  MovieCrewMember,
  MovieDetails,
  WatchProvider,
  WatchProviderData,
} from '../types'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

const TOP_CREW_JOBS = [
  'Screenplay',
  'Writer',
  'Story',
  'Producer',
  'Executive Producer',
  'Director of Photography',
  'Original Music Composer',
  'Editor',
] as const

interface TmdbSearchResponse {
  results: Movie[]
}

interface TmdbCredits {
  cast: { name: string; character: string; order: number }[]
  crew: { name: string; job: string }[]
}

interface TmdbWatchProvidersResponse {
  results: {
    US?: {
      flatrate?: WatchProvider[]
      buy?: WatchProvider[]
      rent?: WatchProvider[]
      free?: WatchProvider[]
      ads?: WatchProvider[]
      link?: string
    }
  }
}

interface TmdbMovieDetailsResponse {
  id: number
  title: string
  release_date: string
  poster_path: string | null
  runtime: number | null
  credits: TmdbCredits
}

function getApiKey(): string {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY

  if (!apiKey || apiKey === 'your_tmdb_api_key_here') {
    throw new Error(
      'TMDB API key is missing. Add VITE_TMDB_API_KEY to your .env file.',
    )
  }

  return apiKey
}

/**
 * Thin fetch wrapper that authenticates via Bearer token header rather than
 * embedding the API key in the URL (which would expose it in server logs,
 * browser history, and network-tab request URLs).
 */
async function tmdbFetch(path: string, params?: Record<string, string>): Promise<Response> {
  const url = new URL(`${TMDB_BASE}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
  })
  return response
}

export function getPosterUrl(posterPath: string | null): string | null {
  if (!posterPath) return null
  return `${TMDB_IMAGE_BASE}${posterPath}`
}

export function getReleaseYear(releaseDate: string): string {
  if (!releaseDate) return '—'
  return releaseDate.slice(0, 4)
}

export function formatRuntime(minutes: number | null): string {
  if (!minutes) return '—'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function getDirector(crew: TmdbCredits['crew']): string | null {
  return crew.find((member) => member.job === 'Director')?.name ?? null
}

function getTopCrew(crew: TmdbCredits['crew']): MovieCrewMember[] {
  const seen = new Set<string>()
  const topCrew: MovieCrewMember[] = []

  for (const job of TOP_CREW_JOBS) {
    const member = crew.find((person) => person.job === job)
    if (!member || seen.has(`${member.job}:${member.name}`)) continue
    seen.add(`${member.job}:${member.name}`)
    topCrew.push({ name: member.name, job: member.job })
  }

  return topCrew
}

function getTopCast(cast: TmdbCredits['cast'], limit = 8): MovieCastMember[] {
  return [...cast]
    .sort((a, b) => a.order - b.order)
    .slice(0, limit)
    .map(({ name, character }) => ({ name, character }))
}

export async function searchMovies(query: string): Promise<Movie[]> {
  const response = await tmdbFetch('/search/movie', {
    query: query.trim(),
    include_adult: 'false',
  })

  if (!response.ok) {
    throw new Error(`TMDB request failed (${response.status})`)
  }

  const data: TmdbSearchResponse = await response.json()
  return data.results
}

export async function getWatchProviders(
  id: number,
): Promise<WatchProviderData | null> {
  try {
    const response = await tmdbFetch(`/movie/${id}/watch/providers`)
    if (!response.ok) return null
    const data: TmdbWatchProvidersResponse = await response.json()
    return data.results?.US ?? null
  } catch {
    return null
  }
}

export function getProviderLogoUrl(logoPath: string): string {
  return `https://image.tmdb.org/t/p/w45${logoPath}`
}

export async function getMovieDetails(id: number): Promise<MovieDetails> {
  const response = await tmdbFetch(`/movie/${id}`, {
    append_to_response: 'credits',
  })

  if (!response.ok) {
    throw new Error(`TMDB request failed (${response.status})`)
  }

  const data: TmdbMovieDetailsResponse = await response.json()

  return {
    id: data.id,
    title: data.title,
    release_date: data.release_date,
    poster_path: data.poster_path,
    runtime: data.runtime,
    director: getDirector(data.credits.crew),
    topCrew: getTopCrew(data.credits.crew),
    topCast: getTopCast(data.credits.cast),
  }
}
