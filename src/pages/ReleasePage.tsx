import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type {
  LinkedFilm,
  Film,
  FilmDetails,
  Release,
  SpecialFeature,
  SpecialFeatureCategory,
  WatchProviderData,
} from '../types'
import { SPECIAL_FEATURE_CATEGORIES } from '../types'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { fetchLabels } from '../services/db'
import { BoxBackScanner } from '../components/BoxBackScanner'
import { LinkedFilmEditor } from '../components/LinkedFilmEditor'
import { ConfirmRemoveButton } from '../components/ConfirmRemoveButton'

import { guessCategory } from '../services/ocrParser'
import { normalizeWatchProviders, toLinkedFilm } from '../queries/collection'
import { FilmSearchPanel } from '../components/FilmSearchPanel'
import {
  formatRuntime,
  getFilmDetails,
  getPosterUrl,
  getProviderLogoUrl,
  getWatchProviders,
} from '../services/tmdb'

interface ReleasePageProps {
  releases: Release[]
  userId: string
  onUpdate: (id: string, updates: Partial<Release>) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onRateFeature: (releaseId: string, featureId: string, rating: 1 | -1 | null) => Promise<void>
}

export function ReleasePage({ releases, onUpdate, onRemove, onRateFeature }: ReleasePageProps) {
  const { id } = useParams()
  const navigate = useNavigate()

  const release = releases.find((r) => r.id === id)

  const [filmDetails, setFilmDetails] = useState<Record<number, FilmDetails>>(
    {},
  )
  const [filmProviders, setFilmProviders] = useState<
    Record<number, WatchProviderData | null>
  >({})
  const fetchedFilmIds = useRef<Set<number>>(new Set())

  // ── Add-film search state ────────────────────────────────
  const [showFilmSearch, setShowFilmSearch] = useState(false)

  // ── Label suggestions ────────────────────────────────────
  const [labelSuggestions, setLabelSuggestions] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    fetchLabels()
      .then((labels) => {
        if (!cancelled) setLabelSuggestions(labels)
      })
      .catch((err) => {
        console.error('[ReleasePage] failed to fetch labels', err)
      })
    return () => { cancelled = true }
  }, [])

  // ── Special features state ───────────────────────────────
  const [showBoxScanner, setShowBoxScanner] = useState(false)
  const [showAddFeatureRow, setShowAddFeatureRow] = useState(false)
  const [newFeatureName, setNewFeatureName] = useState('')
  const [newFeatureCategory, setNewFeatureCategory] = useState<SpecialFeatureCategory | ''>('')

  useEffect(() => {
    if (!release) {
      navigate('/', { replace: true })
      return
    }

    for (const film of release.films) {
      if (fetchedFilmIds.current.has(film.tmdbId)) continue
      fetchedFilmIds.current.add(film.tmdbId)

      getFilmDetails(film.tmdbId)
        .then((data) =>
          setFilmDetails((prev) => ({ ...prev, [film.tmdbId]: data })),
        )
        .catch(() => {})

      getWatchProviders(film.tmdbId)
        .then((data) =>
          setFilmProviders((prev) => ({ ...prev, [film.tmdbId]: data })),
        )
        .catch(() => {})
    }
  }, [release, navigate])

  function addFilmToRelease(film: Film) {
    if (!release) return
    if (release.films.some((f) => f.tmdbId === film.id)) return
    onUpdate(release.id, { films: [...release.films, toLinkedFilm(film)] })
    setShowFilmSearch(false)
  }

  function removeFilmFromRelease(tmdbId: number) {
    if (!release) return
    onUpdate(release.id, {
      films: release.films.filter((f) => f.tmdbId !== tmdbId),
    })
  }

  /** Called by LinkedFilmEditor when the user saves a film card. */
  function handleFilmSave(updated: LinkedFilm) {
    if (!release) return
    onUpdate(release.id, {
      films: release.films.map((f) => (f.tmdbId === updated.tmdbId ? updated : f)),
    })
  }

  // ── Special features helpers ─────────────────────────────
  function addSpecialFeatures(incoming: SpecialFeature[]) {
    if (!release) return
    const existing = release.specialFeatures ?? []
    onUpdate(release.id, { specialFeatures: [...existing, ...incoming] })
  }

  function addSingleFeature() {
    const name = newFeatureName.trim()
    if (!name) return
    addSpecialFeatures([{
      id: crypto.randomUUID(),
      name,
      category: newFeatureCategory || undefined,
    }])
    setNewFeatureName('')
    setNewFeatureCategory('')
    setShowAddFeatureRow(false)
  }

  function removeSpecialFeature(featureId: string) {
    if (!release) return
    onUpdate(release.id, {
      specialFeatures: (release.specialFeatures ?? []).filter((f) => f.id !== featureId),
    })
  }

  function handleRateFeature(featureId: string, direction: 1 | -1) {
    if (!release) return
    const feature = release.specialFeatures.find((f) => f.id === featureId)
    const current = feature?.userRating
    // Toggle: same vote removes it, different vote changes it
    const next = current === direction ? null : direction
    onRateFeature(release.id, featureId, next)
  }

  if (!release) return null

  const coverSrc =
    release.coverUrl ||
    (release.films[0]?.posterPath
      ? getPosterUrl(release.films[0].posterPath)
      : null)

  function handleRemove() {
    onRemove(release!.id)
    navigate('/')
  }

  function field(
    label: string,
    value: string | number | '',
    key: keyof Release,
    type: 'text' | 'number' = 'text',
  ) {
    return (
      <label key={key}>
        <span className="mb-1.5 block text-xs text-muted">{label}</span>
        <input
          type={type}
          value={String(value)}
          onChange={(e) => {
            const raw = e.target.value
            onUpdate(release!.id, {
              [key]: type === 'number' ? (raw === '' ? '' : Number(raw)) : raw,
            })
          }}
          className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white outline-none focus:border-accent"
        />
      </label>
    )
  }

  return (
    <div>
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted transition hover:text-white"
      >
        ← Back to collection
      </Link>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr] xl:grid-cols-[280px_1fr]">

        {/* ── Cover ── */}
        <div className="mx-auto w-full max-w-[280px] lg:max-w-none">
          <div className="aspect-[5/6] overflow-hidden rounded-xl border border-border">
            {coverSrc ? (
              <img
                src={coverSrc}
                alt={`${release.title} cover`}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-surface-overlay text-sm text-muted">
                No cover
              </div>
            )}
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="space-y-8">

          {/* Header */}
          <header>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">
              {release.title}
            </h1>
            {(release.label || release.releaseYear) && (
              <p className="mt-2 text-muted">
                {[release.label, release.releaseYear].filter(Boolean).join(' · ')}
              </p>
            )}
          </header>

          {/* Release metadata */}
          {(release.spineNumber || release.discCount || release.barcode) && (
            <dl className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {release.spineNumber && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted">
                    Spine / Catalog #
                  </dt>
                  <dd className="mt-1 text-sm text-white">{release.spineNumber}</dd>
                </div>
              )}
              {release.discCount && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted">
                    Discs
                  </dt>
                  <dd className="mt-1 text-sm text-white">{release.discCount}</dd>
                </div>
              )}
              {release.barcode && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted">
                    Barcode / UPC
                  </dt>
                  <dd className="mt-1 font-mono text-sm text-white">
                    {release.barcode}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {release.notes && (
            <div className="rounded-xl border border-border bg-surface-raised px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                Notes
              </p>
              <p className="mt-1 text-sm text-white">{release.notes}</p>
            </div>
          )}

          {/* ── Films ── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">
                Films in this Release{' '}
                <span className="font-normal text-muted">
                  ({release.films.length})
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setShowFilmSearch((v) => !v)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:bg-surface-overlay hover:text-white"
              >
                {showFilmSearch ? '✕ Cancel' : '+ Add Film'}
              </button>
            </div>

            {/* Search panel */}
            {showFilmSearch && (
              <div className="mb-4 rounded-xl border border-border bg-surface-raised p-4">
                <FilmSearchPanel
                  onSelect={addFilmToRelease}
                  disabledFilmIds={new Set(release.films.map((f) => f.tmdbId))}
                />
              </div>
            )}

            {release.films.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted">
                No films linked yet. Use the "Add Film" button above to link films.
              </div>
            ) : (
              <div className="space-y-3">
                {release.films.map((film) => {
                  const details = filmDetails[film.tmdbId]
                  const { streaming: streamingProviders, purchase: purchaseProviders } =
                    normalizeWatchProviders(filmProviders[film.tmdbId])
                  const posterUrl = getPosterUrl(
                    details?.poster_path ?? film.posterPath ?? null,
                  )

                  return (
                    <div
                      key={film.tmdbId}
                      className="rounded-xl border border-border bg-surface-raised p-4"
                    >
                      {/* ── TMDB display ── */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="h-24 w-16 overflow-hidden rounded-lg border border-border bg-surface-overlay">
                            {posterUrl ? (
                              <img
                                src={posterUrl}
                                alt={film.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full" />
                            )}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white">{film.title}</p>
                          <p className="text-xs text-muted">{film.year}</p>

                          {details && (
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                              {details.director && (
                                <span>Dir. {details.director}</span>
                              )}
                              {details.runtime && (
                                <span>{formatRuntime(details.runtime)}</span>
                              )}
                            </div>
                          )}

                          {film.tmdbId in filmProviders &&
                            (streamingProviders.length > 0 ||
                              purchaseProviders.length > 0) && (
                              <div className="mt-3 space-y-2">
                                {streamingProviders.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
                                      Stream
                                    </span>
                                    <div className="flex gap-1">
                                      {streamingProviders.map((p) => (
                                        <img
                                          key={p.provider_id}
                                          src={getProviderLogoUrl(p.logo_path)}
                                          alt={p.provider_name}
                                          title={p.provider_name}
                                          className="h-5 w-5 rounded-sm object-cover"
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {purchaseProviders.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
                                      Buy
                                    </span>
                                    <div className="flex gap-1">
                                      {purchaseProviders.map((p) => (
                                        <img
                                          key={p.provider_id}
                                          src={getProviderLogoUrl(p.logo_path)}
                                          alt={p.provider_name}
                                          title={p.provider_name}
                                          className="h-5 w-5 rounded-sm object-cover"
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                        </div>
                      </div>

                      {/* ── Editable fields (format · genres · tags · save) ── */}
                      <div className="mt-3 border-t border-border pt-3">
                        <LinkedFilmEditor
                          film={film}
                          showFilmHeader={false}
                          autoSave
                          onSave={handleFilmSave}
                          onRemove={() => removeFilmFromRelease(film.tmdbId)}
                        />
                      </div>

                      {/* ── Crew / Cast ── */}
                      {details &&
                        (details.topCrew.length > 0 ||
                          details.topCast.length > 0) && (
                          <div className="mt-3 space-y-2 border-t border-border pt-3">
                            {details.topCrew.length > 0 && (
                              <CollapsibleSection
                                title="Crew"
                                count={details.topCrew.length}
                              >
                                <ul className="space-y-1.5">
                                  {details.topCrew.map((m) => (
                                    <li
                                      key={`${m.job}-${m.name}`}
                                      className="flex flex-wrap gap-x-2 text-sm"
                                    >
                                      <span className="text-muted">{m.job}</span>
                                      <span className="text-white">{m.name}</span>
                                    </li>
                                  ))}
                                </ul>
                              </CollapsibleSection>
                            )}
                            {details.topCast.length > 0 && (
                              <CollapsibleSection
                                title="Cast"
                                count={details.topCast.length}
                              >
                                <ul className="space-y-1.5">
                                  {details.topCast.map((m) => (
                                    <li
                                      key={`${m.name}-${m.character}`}
                                      className="flex flex-wrap gap-x-2 text-sm"
                                    >
                                      <span className="text-white">{m.name}</span>
                                      <span className="text-muted">
                                        as {m.character}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </CollapsibleSection>
                            )}
                          </div>
                        )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Special Features ── */}
          {(() => {
            const features = release.specialFeatures ?? []

            // Build groups: keyed by category (or '' for uncategorised)
            const grouped = new Map<string, SpecialFeature[]>()
            for (const f of features) {
              const key = f.category || ''
              if (!grouped.has(key)) grouped.set(key, [])
              grouped.get(key)!.push(f)
            }
            // Sort: named categories alphabetically, uncategorised last
            const groupKeys = [...grouped.keys()].sort((a, b) => {
              if (!a && b) return 1
              if (a && !b) return -1
              return a.localeCompare(b)
            })

            return (
              <section>
                {/* Section header */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-white">
                    Special Features{' '}
                    <span className="font-normal text-muted">({features.length})</span>
                  </h2>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBoxScanner(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:bg-surface-overlay hover:text-white"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className="h-3.5 w-3.5"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                      </svg>
                      Import Features
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddFeatureRow((v) => !v)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:bg-surface-overlay hover:text-white"
                    >
                      {showAddFeatureRow ? '✕ Cancel' : '+ Add Feature'}
                    </button>
                  </div>
                </div>

                {/* Inline quick-add row */}
                {showAddFeatureRow && (
                  <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-border bg-surface-raised p-3">
                    <input
                      type="text"
                      placeholder="Feature name…"
                      value={newFeatureName}
                      onChange={(e) => {
                        const val = e.target.value
                        setNewFeatureName(val)
                        // Auto-detect category from name as the user types
                        const detected = guessCategory(val)
                        if (detected) setNewFeatureCategory(detected)
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && addSingleFeature()}
                      autoFocus
                      className="flex-1 min-w-[180px] rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
                    />
                    <select
                      value={newFeatureCategory}
                      onChange={(e) =>
                        setNewFeatureCategory(e.target.value as SpecialFeatureCategory | '')
                      }
                      className="rounded-lg border border-border bg-surface-overlay px-2 py-2 text-sm text-white outline-none focus:border-accent"
                    >
                      <option value="">Category…</option>
                      {SPECIAL_FEATURE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addSingleFeature}
                      disabled={!newFeatureName.trim()}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                )}

                {/* Feature list */}
                {features.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted">
                    No special features logged yet. Use "Import Features" to add a batch from a photo or pasted text, or "Add Feature" to add one at a time.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groupKeys.map((groupKey) => {
                      const groupItems = grouped.get(groupKey)!
                      return (
                        <div key={groupKey || '__none__'}>
                          {/* Group header (only shown when there's a category) */}
                          {groupKey && (
                            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                              {groupKey}
                            </p>
                          )}
                          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                            {groupItems.map((feat) => (
                              <li
                                key={feat.id}
                                className="flex items-center gap-3 bg-surface-raised px-4 py-2.5"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="text-sm text-white">{feat.name}</span>
                                  {feat.disc && (
                                    <span className="ml-2 text-[11px] text-muted">
                                      Disc {feat.disc}
                                    </span>
                                  )}
                                  {!groupKey && feat.category && (
                                    <span className="ml-2 rounded-md bg-surface-overlay px-1.5 py-0.5 text-[10px] text-muted">
                                      {feat.category}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleRateFeature(feat.id, 1)}
                                    className={`rounded p-1 transition ${
                                      feat.userRating === 1
                                        ? 'text-green-400'
                                        : 'text-muted hover:text-white'
                                    }`}
                                    aria-label={`Thumbs up ${feat.name}`}
                                    title="Thumbs up"
                                  >
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                      <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM11 3a1 1 0 00-1 1v7.268a2 2 0 01.623 1.338l.166 1.456c.04.346.237.646.487.876.24.221.536.324.724.324.1 0 .19-.027.274-.072a2.09 2.09 0 00.794-1.128l.6-2.67c.028-.131.102-.248.21-.338A1.998 1.998 0 0015.5 10V6a1 1 0 00-1-1h-3.5z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRateFeature(feat.id, -1)}
                                    className={`rounded p-1 transition ${
                                      feat.userRating === -1
                                        ? 'text-red-400'
                                        : 'text-muted hover:text-white'
                                    }`}
                                    aria-label={`Thumbs down ${feat.name}`}
                                    title="Thumbs down"
                                  >
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                      <path d="M18.905 12.75a1.25 1.25 0 11-2.5 0v-7.5a1.25 1.25 0 112.5 0v7.5zM8.905 17v-1.992a2 2 0 01-.602-1.291l-.233-1.444a.86.86 0 00-.375-.648c-.234-.173-.537-.26-.837-.26a1.033 1.033 0 00-.353.071 2.07 2.07 0 00-.855 1.153l-.651 2.695a.52.52 0 01-.211.315A2 2 0 004.5 17v4a1 1 0 001 1h3.5a1 1 0 001-1v-4z" />
                                    </svg>
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeSpecialFeature(feat.id)}
                                  className="flex-shrink-0 rounded p-1 text-muted transition hover:bg-surface-overlay hover:text-white"
                                  aria-label={`Remove ${feat.name}`}
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                  </svg>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })()}

          {/* ── Edit Release ── */}
          <section className="rounded-xl border border-border bg-surface-raised p-5">
            <h2 className="mb-4 text-sm font-medium text-white">Edit Release</h2>

            {/* Cover art */}
            <div className="mb-4">
              <p className="mb-1.5 text-xs text-muted">Cover Art URL</p>
              <input
                type="url"
                value={release.coverUrl}
                onChange={(e) => onUpdate(release.id, { coverUrl: e.target.value })}
                placeholder="https://… or leave blank to use TMDB poster"
                className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {field('Title', release.title, 'title')}

              {/* Label */}
              <label>
                <span className="mb-1.5 block text-xs text-muted">Label</span>
                <input
                  type="text"
                  list="edit-label-options"
                  value={release.label}
                  onChange={(e) => onUpdate(release.id, { label: e.target.value })}
                  className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
                <datalist id="edit-label-options">
                  {labelSuggestions.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </label>

              {field('Release Year', release.releaseYear, 'releaseYear', 'number')}
              {field('Spine / Catalog #', release.spineNumber, 'spineNumber')}
              {field('Disc Count', release.discCount, 'discCount', 'number')}
              {field('Barcode / UPC', release.barcode, 'barcode')}
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs text-muted">Notes</span>
              <textarea
                value={release.notes}
                onChange={(e) => onUpdate(release.id, { notes: e.target.value })}
                rows={2}
                className="w-full resize-none rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-white outline-none focus:border-accent"
              />
            </label>

            <div className="mt-5">
              <ConfirmRemoveButton
                onConfirm={handleRemove}
                label="Remove Release"
                confirmLabel="Confirm remove release?"
                ariaLabel={`Remove ${release.title} from collection`}
              />
            </div>

          </section>
        </div>
      </div>

      {/* ── Box Back Scanner modal ── */}
      {showBoxScanner && (
        <BoxBackScanner
          onSave={(features) => {
            addSpecialFeatures(features)
            setShowBoxScanner(false)
          }}
          onClose={() => setShowBoxScanner(false)}
        />
      )}
    </div>
  )
}
