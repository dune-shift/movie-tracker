import { useState, useEffect, useCallback } from 'react'

// ── Internal write helper ────────────────────────────────────────────────────

function writeToStorage(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    // QuotaExceededError — most likely caused by too many large base64 cover
    // images. Surface a visible alert so the user knows their changes weren't
    // saved, rather than silently swallowing the error.
    const isQuota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED')

    if (isQuota) {
      console.error(
        `[useLocalStorage] Storage quota exceeded for key "${key}". Your changes could not be saved.`,
        err,
      )
        window.alert(
          'Storage full: your changes could not be saved.\n\n' +
            'Kinobin stores cover images in your browser. Try removing a release with a large custom cover image to free up space.',
        )
    } else {
      console.warn(`[useLocalStorage] Failed to write key "${key}":`, err)
    }
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * A drop-in replacement for useState that persists the value to localStorage.
 *
 * Improvements over a naïve effect-based approach:
 *
 * 1. **Synchronous writes** — the setter writes to localStorage immediately
 *    inside the state updater rather than in a `useEffect`. This prevents the
 *    stale-key bug: if `key` changed at runtime an effect-based write would
 *    fire with the old value and clobber the new key's existing data.
 *
 * 2. **Cross-tab sync** — a `storage` event listener keeps state in sync when
 *    another tab writes to the same key. The event only fires in tabs *other*
 *    than the writer, so there is no risk of an infinite update loop.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch (err) {
      console.warn(`[useLocalStorage] Failed to read key "${key}":`, err)
      return initialValue
    }
  })

  // Wrapped setter: writes to localStorage synchronously so the in-memory
  // state and persisted state are always updated together.
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next =
          typeof value === 'function'
            ? (value as (p: T) => T)(prev)
            : value
        writeToStorage(key, next)
        return next
      })
    },
    [key],
  )

  // Cross-tab sync: when another tab mutates the same key, pull in the new value.
  useEffect(() => {
    function onStorageEvent(e: StorageEvent) {
      if (e.key !== key) return
      if (e.newValue === null) return
      try {
        setStoredValue(JSON.parse(e.newValue) as T)
      } catch {
        console.warn(
          `[useLocalStorage] Failed to parse storage event for key "${key}"`,
        )
      }
    }
    window.addEventListener('storage', onStorageEvent)
    return () => window.removeEventListener('storage', onStorageEvent)
  }, [key])

  return [storedValue, setValue] as const
}
