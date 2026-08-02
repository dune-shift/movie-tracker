/**
 * Supabase data access layer — all DB reads/writes go through here.
 * Components never import `supabase` directly; they call these functions.
 */
import { supabase } from './supabase'
import type { Release, LinkedFilm, SpecialFeature } from '../types'

// ── DB row shapes (snake_case Postgres columns) ───────────────────────────────

interface ReleaseRow {
  id: string
  user_id: string
  title: string
  label: string
  release_year: number | null
  spine_number: string
  disc_count: number | null
  barcode: string
  notes: string
  cover_url: string
  added_at: string
  films?: FilmRow[]
  special_features?: SpecialFeatureRow[]
}

interface FilmRow {
  id: string
  release_id: string
  tmdb_id: number
  title: string
  year: string
  poster_path: string | null
  formats: string[]
  genres: string[]
  tags: string[]
  blind_buy: boolean
  watched_at: string | null
  sort_order: number
}

interface SpecialFeatureRow {
  id: string
  release_id: string
  name: string
  category: string
  disc: number | null
  sort_order: number
}

// ── Converters ────────────────────────────────────────────────────────────────

function rowToFilm(row: FilmRow): LinkedFilm {
  return {
    tmdbId: row.tmdb_id,
    title: row.title,
    year: row.year,
    posterPath: row.poster_path,
    formats: (row.formats ?? []) as LinkedFilm['formats'],
    genres: (row.genres ?? []) as LinkedFilm['genres'],
    tags: row.tags ?? [],
    blindBuy: row.blind_buy ?? false,
    watchedAt: row.watched_at ?? null,
  }
}

function rowToFeature(row: SpecialFeatureRow): SpecialFeature {
  return {
    id: row.id,
    name: row.name,
    category: (row.category || undefined) as SpecialFeature['category'],
    disc: row.disc ?? undefined,
  }
}

function rowToRelease(row: ReleaseRow): Release {
  return {
    id: row.id,
    title: row.title,
    label: row.label,
    releaseYear: row.release_year ?? '',
    spineNumber: row.spine_number,
    discCount: row.disc_count ?? '',
    barcode: row.barcode,
    notes: row.notes,
    coverUrl: row.cover_url,
    films: (row.films ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(rowToFilm),
    specialFeatures: (row.special_features ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(rowToFeature),
    addedAt: row.added_at,
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchReleases(): Promise<Release[]> {
  const { data, error } = await supabase
    .from('releases')
    .select('*, films(*), special_features(*)')
    .order('added_at', { ascending: false })

  if (error) throw error
  return (data as ReleaseRow[]).map(rowToRelease)
}

// ── Insert ────────────────────────────────────────────────────────────────────

export async function insertRelease(release: Release, userId: string): Promise<void> {
  // 1. releases row
  const { error: rErr } = await supabase.from('releases').insert({
    id: release.id,
    user_id: userId,
    title: release.title,
    label: release.label,
    release_year: release.releaseYear !== '' ? release.releaseYear : null,
    spine_number: release.spineNumber,
    disc_count: release.discCount !== '' ? release.discCount : null,
    barcode: release.barcode,
    notes: release.notes,
    cover_url: release.coverUrl,
    added_at: release.addedAt,
  })
  if (rErr) throw rErr

  // 2. films rows
  if (release.films.length > 0) {
    const { error: fErr } = await supabase.from('films').insert(
      release.films.map((f, i) => ({
        release_id: release.id,
        tmdb_id: f.tmdbId,
        title: f.title,
        year: f.year,
        poster_path: f.posterPath,
        formats: f.formats ?? [],
        genres: f.genres ?? [],
        tags: f.tags ?? [],
        blind_buy: f.blindBuy ?? false,
        watched_at: f.watchedAt ?? null,
        sort_order: i,
      })),
    )
    if (fErr) throw fErr
  }

  // 3. special_features rows
  if (release.specialFeatures.length > 0) {
    const { error: sfErr } = await supabase.from('special_features').insert(
      release.specialFeatures.map((sf, i) => ({
        id: sf.id,
        release_id: release.id,
        name: sf.name,
        category: sf.category ?? '',
        disc: sf.disc !== undefined && sf.disc !== '' ? sf.disc : null,
        sort_order: i,
      })),
    )
    if (sfErr) throw sfErr
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateRelease(
  id: string,
  updates: Partial<Release>,
): Promise<void> {
  const { films, specialFeatures, ...scalar } = updates

  // Scalar fields on the releases table
  if (Object.keys(scalar).length > 0) {
    const patch: Record<string, unknown> = {}
    if (scalar.title !== undefined) patch.title = scalar.title
    if (scalar.label !== undefined) patch.label = scalar.label
    if (scalar.releaseYear !== undefined)
      patch.release_year = scalar.releaseYear !== '' ? scalar.releaseYear : null
    if (scalar.spineNumber !== undefined) patch.spine_number = scalar.spineNumber
    if (scalar.discCount !== undefined)
      patch.disc_count = scalar.discCount !== '' ? scalar.discCount : null
    if (scalar.barcode !== undefined) patch.barcode = scalar.barcode
    if (scalar.notes !== undefined) patch.notes = scalar.notes
    if (scalar.coverUrl !== undefined) patch.cover_url = scalar.coverUrl

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('releases').update(patch).eq('id', id)
      if (error) throw error
    }
  }

  // Replace films (delete-then-reinsert)
  if (films !== undefined) {
    const { error: delErr } = await supabase
      .from('films')
      .delete()
      .eq('release_id', id)
    if (delErr) throw delErr

    if (films.length > 0) {
      const { error: insErr } = await supabase.from('films').insert(
        films.map((f, i) => ({
          release_id: id,
          tmdb_id: f.tmdbId,
          title: f.title,
          year: f.year,
          poster_path: f.posterPath,
          formats: f.formats ?? [],
          genres: f.genres ?? [],
          tags: f.tags ?? [],
          blind_buy: f.blindBuy ?? false,
          watched_at: f.watchedAt ?? null,
          sort_order: i,
        })),
      )
      if (insErr) throw insErr
    }
  }

  // Replace special features (delete-then-reinsert)
  if (specialFeatures !== undefined) {
    const { error: delErr } = await supabase
      .from('special_features')
      .delete()
      .eq('release_id', id)
    if (delErr) throw delErr

    if (specialFeatures.length > 0) {
      const { error: insErr } = await supabase.from('special_features').insert(
        specialFeatures.map((sf, i) => ({
          id: sf.id,
          release_id: id,
          name: sf.name,
          category: sf.category ?? '',
          disc: sf.disc !== undefined && sf.disc !== '' ? sf.disc : null,
          sort_order: i,
        })),
      )
      if (insErr) throw insErr
    }
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteRelease(id: string): Promise<void> {
  const { error } = await supabase.from('releases').delete().eq('id', id)
  if (error) throw error
}
