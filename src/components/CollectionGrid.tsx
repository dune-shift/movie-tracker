import type { CollectionItem } from '../types'
import { getPosterUrl, getReleaseYear } from '../services/tmdb'
import { EditMenu } from './EditMenu'

interface CollectionGridProps {
  items: CollectionItem[]
  onUpdate: (
    id: number,
    updates: Partial<Pick<CollectionItem, 'format' | 'edition'>>,
  ) => void
  onRemove: (id: number) => void
}

export function CollectionGrid({ items, onUpdate, onRemove }: CollectionGridProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-raised/50 px-6 py-16 text-center">
        <p className="text-sm text-muted">
          Your collection is empty. Search for a film above and click a result to
          add it.
        </p>
      </div>
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => {
        const posterUrl = getPosterUrl(item.poster_path)

        return (
          <li
            key={item.id}
            className="overflow-hidden rounded-xl border border-border bg-surface-raised"
          >
            <div className="aspect-[2/3] overflow-hidden bg-surface-overlay">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={`${item.title} poster`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted">
                  No poster
                </div>
              )}
            </div>

            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-white">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {getReleaseYear(item.release_date)}
                  </p>
                </div>
                <EditMenu item={item} onUpdate={onUpdate} onRemove={onRemove} />
              </div>

              {(item.format || item.edition) && (
                <div className="flex flex-wrap gap-1.5">
                  {item.format && (
                    <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent-hover">
                      {item.format}
                    </span>
                  )}
                  {item.edition && (
                    <span className="rounded-md bg-surface-overlay px-2 py-0.5 text-[10px] font-medium text-muted">
                      {item.edition}
                    </span>
                  )}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
