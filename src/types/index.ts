export const FORMAT_OPTIONS = [
  '4K Ultra HD Blu-ray',
  'Standard Blu-ray',
  'DVD',
  'HD DVD',
  'LaserDisc',
  'VHS',
  'Betamax',
  'UMD',
] as const

export const LABEL_OPTIONS = [
  'Major Studio',
  'Criterion Collection',
  'Arrow Video',
  'Vinegar Syndrome',
  'Kino Lorber',
  'Shout! Factory',
  'Scream Factory',
  'Severin Films',
  'Eureka / Masters of Cinema',
  'Second Sight',
  'Indicator',
  'Imprint',
  '88 Films',
  'Code Red',
  'MVD Rewind',
  'Warner Archive',
  'Mill Creek',
  'AGFA',
  'DiabolikDVD',
  'Other',
] as const

export type Format = (typeof FORMAT_OPTIONS)[number]
export type Label = (typeof LABEL_OPTIONS)[number]

// A single film linked to a physical release via TMDB
export interface LinkedFilm {
  tmdbId: number
  title: string
  year: string
  posterPath: string | null
}

// The primary entity — a physical release on your shelf
export interface Release {
  id: string
  title: string
  label: string
  format: Format | ''
  releaseYear: string
  spineNumber: string
  discCount: string
  barcode: string
  notes: string
  coverUrl: string // base64 data URL or external image URL
  films: LinkedFilm[]
  addedAt: string
}

// ── TMDB types ─────────────────────────────────────────────

export interface WatchProvider {
  provider_id: number
  provider_name: string
  logo_path: string
  display_priority: number
}

export interface WatchProviderData {
  flatrate?: WatchProvider[]
  buy?: WatchProvider[]
  rent?: WatchProvider[]
  free?: WatchProvider[]
  ads?: WatchProvider[]
  link?: string
}

export interface Movie {
  id: number
  title: string
  release_date: string
  poster_path: string | null
}

export interface MovieCastMember {
  name: string
  character: string
}

export interface MovieCrewMember {
  name: string
  job: string
}

export interface MovieDetails {
  id: number
  title: string
  release_date: string
  poster_path: string | null
  runtime: number | null
  director: string | null
  topCrew: MovieCrewMember[]
  topCast: MovieCastMember[]
}
