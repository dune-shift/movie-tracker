import type { Film, FilmGroup, Genre, LinkedFilm, Release, WatchProviderData, WatchProvider } from '../types'
import { FORMAT_OPTIONS, GENRE_OPTIONS } from '../types'

export function toLinkedFilm(film: Film): LinkedFilm {
  return {
    tmdbId: film.id,
    title: film.title,
    year: film.release_date ? film.release_date.slice(0, 4) : '—',
    posterPath: film.poster_path,
    formats: [],
    genres: [],
    tags: [],
  }
}

// ── Film groups ───────────────────────────────────────────────────────────────

/**
 * Build a de-duplicated list of FilmGroups from a flat releases array.
 * Each linked film in a release gets its own FilmGroup entry. Releases that
 * share the same film (same tmdbId) collapse into one group with multiple
 * copies. Releases with no linked films are skipped (they are shown in the
 * Releases view, not the Films view).
 */
export function buildFilmGroups(releases: Release[]): FilmGroup[] {
  const map = new Map<string, FilmGroup>()

  for (const release of releases) {
    if (release.films.length === 0) {
      continue
    }
    for (const film of release.films) {
      const key = `tmdb-${film.tmdbId}`
      if (map.has(key)) {
        const group = map.get(key)!
        if (!group.releases.some((r) => r.id === release.id)) {
          group.releases.push(release)
          for (const g of film.genres ?? []) {
            if (!group.genres.includes(g)) group.genres.push(g)
          }
        }
      } else {
        map.set(key, {
          key,
          tmdbId: film.tmdbId,
          title: film.title,
          posterPath: film.posterPath,
          genres: [...(film.genres ?? [])],
          releases: [release],
        })
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    if (b.releases.length !== a.releases.length) {
      return b.releases.length - a.releases.length
    }
    return a.title.localeCompare(b.title)
  })
}

// ── Filter predicates ─────────────────────────────────────────────────────────

export interface FilterCriteria {
  label?: string
  format?: string
  genre?: Genre
}

export function filterReleases(releases: Release[], criteria: FilterCriteria): Release[] {
  return releases.filter((r) => {
    if (criteria.label && r.label !== criteria.label) return false
    if (criteria.format && !r.films.some((f) => f.formats?.includes(criteria.format as typeof FORMAT_OPTIONS[number]))) return false
    if (criteria.genre && !r.films.some((f) => f.genres?.includes(criteria.genre as Genre))) return false
    return true
  })
}

export function availableLabels(releases: Release[]): string[] {
  const labels = releases
    .map((r) => r.label)
    .filter((l) => l.trim() !== '')
  return [...new Set(labels)].sort()
}

export function availableFormats(releases: Release[]): string[] {
  return FORMAT_OPTIONS.filter((f) =>
    releases.some((r) => r.films.some((film) => film.formats?.includes(f))),
  )
}

export function availableGenres(releases: Release[]): Genre[] {
  return GENRE_OPTIONS.filter((g) =>
    releases.some((r) => r.films.some((f) => f.genres?.includes(g))),
  )
}

// ── Count label ───────────────────────────────────────────────────────────────

export type ViewMode = 'releases' | 'films'

export function countLabel(
  totalReleases: number,
  totalFilmGroups: number,
  shownReleases: number,
  shownFilmGroups: number,
  viewMode: ViewMode,
  hasActiveFilter: boolean,
): string {
  if (totalReleases === 0) return 'No releases yet'

  if (viewMode === 'films') {
    if (hasActiveFilter) {
      return `${shownFilmGroups} of ${totalFilmGroups} ${totalFilmGroups === 1 ? 'film' : 'films'}`
    }
    return `${totalFilmGroups} ${totalFilmGroups === 1 ? 'film' : 'films'}`
  }

  if (hasActiveFilter) {
    return `${shownReleases} of ${totalReleases} ${totalReleases === 1 ? 'release' : 'releases'}`
  }
  return `${totalReleases} ${totalReleases === 1 ? 'release' : 'releases'}`
}

// ── Stats aggregation ─────────────────────────────────────────────────────────

/** Count occurrences of a key derived from each item. Falsy keys are skipped. */
export function countBy<T>(
  items: T[],
  keyFn: (item: T) => string | null | undefined,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item)
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

/** Sort entries by count, descending; optionally cap the list length. */
export function topEntries(map: Map<string, number>, limit?: number): [string, number][] {
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1])
  return limit ? entries.slice(0, limit) : entries
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
})

export function monthKey(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return MONTH_FORMATTER.format(new Date(year, month - 1, 1))
}

export interface CollectionStats {
  totalReleases: number
  totalFilms: number
  watchedFilms: number
  unwatchedFilms: number
  blindBuyFilms: number
  blindBuyWatched: number
  labelCounts: Map<string, number>
  formatCounts: Map<string, number>
  genreCounts: Map<string, number>
  tagCounts: Map<string, number>
  timeline: { label: string; count: number }[]
}

export function computeStats(releases: Release[]): CollectionStats {
  const allFilms = releases.flatMap((r) => r.films)
  const totalFilms = allFilms.length

  const watchedFilms = allFilms.filter((f) => !!f.watchedAt).length
  const unwatchedFilms = totalFilms - watchedFilms

  const blindBuyFilms = allFilms.filter((f) => f.blindBuy).length
  const blindBuyWatched = allFilms.filter((f) => f.blindBuy && f.watchedAt).length

  const labelCounts = countBy(releases, (r) => r.label.trim() || null)
  const formatCounts = countBy(
    allFilms.flatMap((f) => f.formats ?? []),
    (f) => f,
  )
  const genreCounts = countBy(
    allFilms.flatMap((f) => f.genres ?? []),
    (g) => g,
  )
  const tagCounts = countBy(
    allFilms.flatMap((f) => f.tags ?? []),
    (t) => t,
  )

  const monthCounts = countBy(releases, (r) => monthKey(r.addedAt))
  const timeline = [...monthCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ label: monthLabel(key), count }))

  return {
    totalReleases: releases.length,
    totalFilms,
    watchedFilms,
    unwatchedFilms,
    blindBuyFilms,
    blindBuyWatched,
    labelCounts,
    formatCounts,
    genreCounts,
    tagCounts,
    timeline,
  }
}

// ── Watch provider helpers ────────────────────────────────────────────────────

export interface NormalizedProviders {
  streaming: WatchProvider[]
  purchase: WatchProvider[]
}

export function normalizeWatchProviders(data: WatchProviderData | null): NormalizedProviders {
  const streaming = [
    ...(data?.flatrate ?? []),
    ...(data?.free ?? []),
    ...(data?.ads ?? []),
  ]
    .filter(
      (p, i, a) =>
        a.findIndex((q) => q.provider_id === p.provider_id) === i,
    )
    .sort((a, b) => a.display_priority - b.display_priority)
    .slice(0, 6)

  const purchase = [
    ...(data?.buy ?? []),
    ...(data?.rent ?? []),
  ]
    .filter(
      (p, i, a) =>
        a.findIndex((q) => q.provider_id === p.provider_id) === i,
    )
    .sort((a, b) => a.display_priority - b.display_priority)
    .slice(0, 6)

  return { streaming, purchase }
}