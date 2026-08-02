import { useMemo } from 'react'
import type { Release } from '../types'

interface StatsPageProps {
  releases: Release[]
  loading: boolean
}

// ── Aggregation helpers ─────────────────────────────────────

/** Count occurrences of a key derived from each item. Falsy keys are skipped. */
function countBy<T>(
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
function topEntries(map: Map<string, number>, limit?: number): [string, number][] {
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1])
  return limit ? entries.slice(0, limit) : entries
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
})

function monthKey(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return MONTH_FORMATTER.format(new Date(year, month - 1, 1))
}

// ── Presentational bits ──────────────────────────────────────

function StatCard({
  value,
  label,
  sublabel,
}: {
  value: string | number
  label: string
  sublabel?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-4">
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
      {sublabel && <p className="mt-0.5 text-[11px] text-muted/60">{sublabel}</p>}
    </div>
  )
}

function BarList({
  items,
  emptyLabel = 'No data yet',
}: {
  items: { label: string; count: number }[]
  emptyLabel?: string
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted/60">{emptyLabel}</p>
  }
  const max = Math.max(...items.map((i) => i.count))
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span
            className="w-28 flex-shrink-0 truncate text-xs text-muted sm:w-36"
            title={item.label}
          >
            {item.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-overlay">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="w-8 flex-shrink-0 text-right text-xs font-medium text-white">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-4">
      <h3 className="mb-3 text-sm font-medium text-white">{title}</h3>
      {children}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function StatsPage({ releases, loading }: StatsPageProps) {
  const stats = useMemo(() => {
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
  }, [releases])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-32 animate-pulse rounded-md bg-surface-overlay" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-overlay" />
          ))}
        </div>
      </div>
    )
  }

  if (releases.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-raised/50 px-6 py-20 text-center">
        <p className="text-sm text-muted">No stats yet.</p>
        <p className="mt-1 text-xs text-muted/60">
          Add some releases to your collection to see stats here.
        </p>
      </div>
    )
  }

  const watchedRate =
    stats.totalFilms > 0 ? Math.round((stats.watchedFilms / stats.totalFilms) * 100) : 0
  const blindBuyRate =
    stats.totalFilms > 0 ? Math.round((stats.blindBuyFilms / stats.totalFilms) * 100) : 0
  const blindBuyWatchedRate =
    stats.blindBuyFilms > 0
      ? Math.round((stats.blindBuyWatched / stats.blindBuyFilms) * 100)
      : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-white">Collection Stats</h2>
        <p className="mt-0.5 text-sm text-muted">
          A look at what you've been collecting.
        </p>
      </div>

      {/* ── Overview cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard value={stats.totalReleases} label="Releases" />
        <StatCard value={stats.totalFilms} label="Films" />
        <StatCard
          value={`${watchedRate}%`}
          label="Watched"
          sublabel={`${stats.watchedFilms} of ${stats.totalFilms} films · ${stats.unwatchedFilms} unwatched`}
        />
        <StatCard
          value={`${blindBuyRate}%`}
          label="Blind buys"
          sublabel={
            stats.blindBuyFilms > 0
              ? `${blindBuyWatchedRate}% of blind buys watched since`
              : undefined
          }
        />
      </div>

      {/* ── Breakdowns ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="By Label">
          <BarList
            items={topEntries(stats.labelCounts, 10).map(([label, count]) => ({
              label,
              count,
            }))}
          />
        </Section>

        <Section title="By Format">
          <BarList
            items={topEntries(stats.formatCounts).map(([label, count]) => ({
              label,
              count,
            }))}
          />
        </Section>

        <Section title="By Genre">
          <BarList
            items={topEntries(stats.genreCounts, 10).map(([label, count]) => ({
              label,
              count,
            }))}
          />
        </Section>

        <Section title="Top Tags">
          <BarList
            items={topEntries(stats.tagCounts, 10).map(([label, count]) => ({
              label,
              count,
            }))}
            emptyLabel="No tags added yet"
          />
        </Section>
      </div>

      {/* ── Timeline ── */}
      <Section title="Added Over Time">
        <BarList items={stats.timeline} />
      </Section>
    </div>
  )
}
