import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Format, MovieGroup } from '../types'
import { getPosterUrl } from '../services/tmdb'

interface MovieGroupCardProps {
  group: MovieGroup
}

// Shorten long format names to compact badge labels
function shortFormat(format: string): string {
  if (format === '4K Ultra HD Blu-ray') return '4K'
  if (format === 'Standard Blu-ray') return 'Blu-ray'
  if (format === 'HD DVD') return 'HD DVD'
  return format
}

export function MovieGroupCard({ group }: MovieGroupCardProps) {
  const [expanded, setExpanded] = useState(false)

  const coverSrc =
    group.releases[0]?.coverUrl ||
    (group.posterPath ? getPosterUrl(group.posterPath) : null)

  const copyCount = group.releases.length

  // Collect unique formats across all films in all releases in this group
  const formats = [
    ...new Set(
      group.releases
        .flatMap((r) => r.films.map((f) => f.format))
        .filter((f): f is Format => !!f),
    ),
  ]

  return (
    <li>
      <div
        className={`flex h-full flex-col overflow-hidden rounded-xl border bg-surface-raised transition ${
          expanded
            ? 'border-accent/60 shadow-lg shadow-accent/5'
            : 'border-border hover:border-accent/60 hover:shadow-lg hover:shadow-accent/5'
        }`}
      >
        {/* ── Card top (clickable to expand) ── */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="group flex h-full flex-col text-left"
        >
          {/* Cover */}
          <div className="aspect-[2/3] overflow-hidden bg-surface-overlay">
            {coverSrc ? (
              <img
                src={coverSrc}
                alt={`${group.title} cover`}
                className="h-full w-full object-cover transition group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted">
                No cover
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col space-y-2 p-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-medium leading-snug text-white">
                {group.title}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {/* Format badge per copy */}
              {formats.map((fmt, i) => (
                <span
                  key={i}
                  className="rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent-hover"
                >
                  {shortFormat(fmt)}
                </span>
              ))}

              {/* Copy count badge */}
              {copyCount > 1 && (
                <span className="rounded-md bg-surface-overlay px-2 py-0.5 text-[10px] font-medium text-muted">
                  {copyCount} copies
                </span>
              )}
            </div>
          </div>
        </button>

        {/* ── Expanded release list ── */}
        {expanded && (
          <div className="border-t border-border bg-surface-overlay px-3 py-2">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">
              Your copies
            </p>
            <ul className="space-y-1">
              {group.releases.map((release) => (
                <li key={release.id}>
                  <Link
                    to={`/release/${release.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition hover:bg-surface-raised"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white">
                        {release.title}
                      </p>
                      {(release.label || release.releaseYear) && (
                        <p className="truncate text-[10px] text-muted">
                          {[release.label, release.releaseYear]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                    {release.films
                      .map((f) => f.format)
                      .filter((f): f is Format => !!f)
                      .filter((f, i, arr) => arr.indexOf(f) === i)
                      .map((fmt) => (
                        <span
                          key={fmt}
                          className="flex-shrink-0 rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-hover"
                        >
                          {shortFormat(fmt)}
                        </span>
                      ))}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </li>
  )
}
