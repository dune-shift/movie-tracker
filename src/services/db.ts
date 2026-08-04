/**
 * Supabase data access layer — all DB reads/writes go through here.
 * Components never import `supabase` directly; they call these functions.
 */
import { supabase } from './supabase'
import type { Release, LinkedFilm, SpecialFeature } from '../types'

// ── Label helpers ─────────────────────────────────────────────────────────────

function normalizeLabel(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

export async function fetchLabels(query?: string): Promise<string[]> {
  let q = supabase
    .from('labels')
    .select('name')
    .order('usage_count', { ascending: false })

  if (query) {
    q = q.ilike('name', `%${query}%`)
  }

  const { data, error } = await q.limit(50)
  if (error) throw error
  return (data ?? []).map((row) => row.name)
}

export async function upsertLabel(name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return

  const normalized = normalizeLabel(trimmed)

  const { error } = await supabase.from('labels').upsert(
    {
      name: trimmed,
      normalized,
      usage_count: 0, // trigger will handle increment if you add one, otherwise we bump manually
    },
    { onConflict: 'normalized', ignoreDuplicates: true },
  )

  if (error) throw error
}

/** Increment the usage count for a label. Call after successfully saving a release. */
export async function bumpLabelUsage(name: string): Promise<void> {
  const normalized = normalizeLabel(name)
  const { data } = await supabase
    .from('labels')
    .select('usage_count')
    .eq('normalized', normalized)
    .single()
  const current = data?.usage_count ?? 0
  const { error } = await supabase
    .from('labels')
    .update({ usage_count: current + 1 })
    .eq('normalized', normalized)
  if (error) throw error
}

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

export async function fetchReleases(userId: string): Promise<Release[]> {
  const { data, error } = await supabase
    .from('releases')
    .select('*, films(*), special_features(*)')
    .eq('user_id', userId)
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

  // 4. Ensure label exists in the global pool
  if (release.label.trim()) {
    await upsertLabel(release.label)
    await bumpLabelUsage(release.label)
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

  // Upsert special features: delete removed, insert new, update changed
  if (specialFeatures !== undefined) {
    const keptIds = specialFeatures.map((sf) => sf.id)

    let q = supabase.from('special_features').delete().eq('release_id', id)
    if (keptIds.length > 0) {
      q = q.not('id', 'in', `(${keptIds.map((x) => `'${x}'`).join(',')})`)
    }
    const { error: delErr } = await q
    if (delErr) throw delErr

    if (specialFeatures.length > 0) {
      const { error: upsErr } = await supabase
        .from('special_features')
        .upsert(
          specialFeatures.map((sf, i) => ({
            id: sf.id,
            release_id: id,
            name: sf.name,
            category: sf.category ?? '',
            disc: sf.disc !== undefined && sf.disc !== '' ? sf.disc : null,
            sort_order: i,
          })),
          { onConflict: 'id' },
        )
      if (upsErr) throw upsErr
    }
  }

  // Ensure label exists in the global pool if it changed
  if (scalar.label !== undefined && scalar.label.trim()) {
    await upsertLabel(scalar.label)
    await bumpLabelUsage(scalar.label)
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteRelease(id: string): Promise<void> {
  const { error } = await supabase.from('releases').delete().eq('id', id)
  if (error) throw error
}

// ── Special Feature Ratings ───────────────────────────────────────────────────

export async function rateSpecialFeature(
  releaseId: string,
  specialFeatureId: string,
  userId: string,
  rating: 1 | -1 | null,
): Promise<void> {
  if (rating === null) {
    const { error } = await supabase
      .from('special_feature_ratings')
      .delete()
      .eq('user_id', userId)
      .eq('special_feature_id', specialFeatureId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('special_feature_ratings')
      .upsert(
        {
          user_id: userId,
          release_id: releaseId,
          special_feature_id: specialFeatureId,
          rating,
        },
        { onConflict: 'user_id, special_feature_id' },
      )
    if (error) throw error
  }
}

export async function fetchUserFeatureRatings(
  releaseIds: string[],
  userId: string,
): Promise<Map<string, 1 | -1>> {
  if (releaseIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('special_feature_ratings')
    .select('special_feature_id, rating')
    .eq('user_id', userId)
    .in('release_id', releaseIds)

  if (error) throw error

  const map = new Map<string, 1 | -1>()
  for (const row of data ?? []) {
    map.set(row.special_feature_id, row.rating as 1 | -1)
  }
  return map
}
