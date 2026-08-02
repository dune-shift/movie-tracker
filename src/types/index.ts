export const SPECIAL_FEATURE_CATEGORIES = [
  'Audio Commentary',
  'Featurette',
  'Interview',
  'Documentary',
  'Short Film',
  'Deleted Scenes',
  'Outtakes / Bloopers',
  'Trailer',
  'Teaser',
  'TV Spot',
  'Image Gallery',
  'Music Video',
  'Essay / Video Essay',
  'Introduction',
  'Q&A',
  'Other',
] as const

export type SpecialFeatureCategory = (typeof SPECIAL_FEATURE_CATEGORIES)[number]

export interface SpecialFeature {
  id: string
  name: string
  category?: SpecialFeatureCategory | ''
  disc?: number | ''
}

export const GENRE_OPTIONS = [
  'Action',
  'Adventure',
  'Animation',
  'Biography',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'Film-Noir',
  'History',
  'Holiday',
  'Horror',
  'Musical',
  'Music Videos & Concerts',
  'Mystery',
  'Romance',
  'Science Fiction',
  'Thriller',
  'War',
  'Western',
] as const

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
  '101 Films',
  '20th Century Studios',
  '88 Films',
  'A24',
  'AGFA',
  'Anchor Bay Entertainment',
  'Arrow Video',
  'Blue Underground',
  'Cauldron Films',
  'Cinema Guild',
  'ClassicFlix',
  'Code Red',
  'Cohen Media Group',
  'The Criterion Collection',
  'Deaf Crocodile',
  'DiabolikDVD',
  'Disney / Buena Vista',
  'Eureka Classics',
  'Flicker Alley',
  'Full Moon Features',
  'Grasshopper Film',
  'Imprint',
  'Kino Lorber',
  'Lionsgate Films',
  'MGM',
  'Mill Creek',
  'MVD Rewind',
  'New Line Cinema',
  'Olive Films',
  'Oscilloscope Laboratories',
  'Paramount Pictures',
  'powerhouse/Indicator',
  'Radiance Films',
  'Raro Video',
  'Sandpiper Pictures',
  'Scream Factory',
  'Second Run',
  'Second Sight',
  'Severin Films',
  'Shout! Factory',
  'Sony Pictures',
  'StudioCanal',
  'Synapse Films',
  'Terror Vision',
  'Troma Entertainment',
  'Umbrella Entertainment',
  'Unearthed Films',
  'Universal Pictures',
  'Vinegar Syndrome',
  'Warner Archive',
  'Warner Bros',
] as const

export type Format = (typeof FORMAT_OPTIONS)[number]
export type Label = (typeof LABEL_OPTIONS)[number]
export type Genre = (typeof GENRE_OPTIONS)[number]

// A single film linked to a physical release via TMDB
export interface LinkedFilm {
  tmdbId: number
  title: string
  year: string
  posterPath: string | null
  formats?: Format[]      // physical formats this film is present on (supports e.g. 4K + standard Blu-ray combo packs)
  genres?: Genre[]        // controlled genre taxonomy
  tags?: string[]         // free-form user-defined micro-genre tags
  blindBuy?: boolean      // true if the film was unseen at time of purchase
  watchedAt?: string | null // ISO timestamp of first watch; null/undefined = unwatched
}


// The primary entity — a physical release on your shelf
export interface Release {
  id: string
  title: string
  label: string
  /** Physical release year, e.g. 2023. Empty string means "not set". */
  releaseYear: number | ''
  spineNumber: string
  /** Number of discs in the set. Empty string means "not set". */
  discCount: number | ''
  barcode: string
  notes: string
  coverUrl: string // base64 data URL or external image URL
  films: LinkedFilm[]
  specialFeatures: SpecialFeature[]
  addedAt: string
}

// ── Derived / computed types ────────────────────────────────

// One film with all the physical releases that contain it
export interface FilmGroup {
  key: string             // tmdbId as string, or title-slug for unlinked releases
  tmdbId: number | null
  title: string
  posterPath: string | null
  genres: Genre[]         // aggregated from all linked film instances
  releases: Release[]
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

export interface Film {
  id: number
  title: string
  release_date: string
  poster_path: string | null
}

export interface FilmCastMember {
  name: string
  character: string
}

export interface FilmCrewMember {
  name: string
  job: string
}

export interface FilmDetails {
  id: number
  title: string
  release_date: string
  poster_path: string | null
  runtime: number | null
  director: string | null
  topCrew: FilmCrewMember[]
  topCast: FilmCastMember[]
}
