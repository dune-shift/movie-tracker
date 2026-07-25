import { useCallback, useEffect, useRef, useState } from 'react'
import type { Release } from '../types'
import {
  fetchReleases,
  insertRelease,
  updateRelease as dbUpdate,
  deleteRelease,
} from '../services/db'

interface UseReleasesReturn {
  releases: Release[]
  loading: boolean
  error: string | null
  clearError: () => void
  addRelease: (release: Release) => Promise<void>
  updateRelease: (id: string, updates: Partial<Release>) => Promise<void>
  removeRelease: (id: string) => Promise<void>
}

export function useReleases(userId: string | null): UseReleasesReturn {
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Track latest userId so callbacks always have access to it
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  useEffect(() => {
    if (!userId) {
      setReleases([])
      setLoading(false)
      return
    }

    setLoading(true)
    fetchReleases()
      .then((data) => {
        setReleases(data)
        setError(null)
      })
      .catch((err) => {
        console.error('[useReleases] fetch error:', err)
        setError('Failed to load your collection. Check your connection and try again.')
      })
      .finally(() => setLoading(false))
  }, [userId])

  const addRelease = useCallback(async (release: Release) => {
    const uid = userIdRef.current
    if (!uid) return

    // Optimistic add
    setReleases((prev) => [release, ...prev])
    try {
      await insertRelease(release, uid)
    } catch (err) {
      console.error('[useReleases] insert error:', err)
      // Rollback
      setReleases((prev) => prev.filter((r) => r.id !== release.id))
      setError('Failed to save release. Please try again.')
    }
  }, [])

  const updateRelease = useCallback(async (id: string, updates: Partial<Release>) => {
    // Optimistic update
    setReleases((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    )
    try {
      await dbUpdate(id, updates)
    } catch (err) {
      console.error('[useReleases] update error:', err)
      setError('Failed to save changes. Please try again.')
      // Re-fetch to restore truthful state
      fetchReleases().then(setReleases).catch(console.error)
    }
  }, [])

  const removeRelease = useCallback(async (id: string) => {
    // Optimistic remove
    setReleases((prev) => prev.filter((r) => r.id !== id))
    try {
      await deleteRelease(id)
    } catch (err) {
      console.error('[useReleases] delete error:', err)
      setError('Failed to remove release. Please try again.')
      fetchReleases().then(setReleases).catch(console.error)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { releases, loading, error, clearError, addRelease, updateRelease, removeRelease }
}
