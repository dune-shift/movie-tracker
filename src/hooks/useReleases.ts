import { useCallback, useEffect, useRef, useState } from 'react'
import type { Release } from '../types'
import {
  fetchReleases,
  insertRelease,
  updateRelease as dbUpdate,
  deleteRelease,
  rateSpecialFeature as dbRateSpecialFeature,
  fetchUserFeatureRatings,
} from '../services/db'

interface UseReleasesReturn {
  releases: Release[]
  loading: boolean
  error: string | null
  clearError: () => void
  addRelease: (release: Release) => Promise<void>
  updateRelease: (id: string, updates: Partial<Release>) => Promise<void>
  removeRelease: (id: string) => Promise<void>
  rateSpecialFeature: (releaseId: string, featureId: string, rating: 1 | -1 | null) => Promise<void>
}

export function useReleases(userId: string | null): UseReleasesReturn {
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Track latest userId so callbacks always have access to it
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  function mergeRatings(releasesData: Release[], ratings: Map<string, 1 | -1>): Release[] {
    return releasesData.map((r) => ({
      ...r,
      specialFeatures: r.specialFeatures.map((sf) => ({
        ...sf,
        userRating: ratings.get(sf.id) ?? null,
      })),
    }))
  }

  useEffect(() => {
    if (!userId) {
      setReleases([])
      setLoading(false)
      return
    }

    setLoading(true)
    fetchReleases(userId)
      .then(async (data) => {
        const releaseIds = data.map((r) => r.id)
        const ratings = await fetchUserFeatureRatings(releaseIds, userId)
        setReleases(mergeRatings(data, ratings))
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
      const uid = userIdRef.current
      if (uid) {
        fetchReleases(uid)
          .then(async (data) => {
            const ratings = await fetchUserFeatureRatings(data.map((r) => r.id), uid)
            setReleases(mergeRatings(data, ratings))
          })
          .catch(console.error)
      }
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
      const uid = userIdRef.current
      if (uid) {
        fetchReleases(uid)
          .then(async (data) => {
            const ratings = await fetchUserFeatureRatings(data.map((r) => r.id), uid)
            setReleases(mergeRatings(data, ratings))
          })
          .catch(console.error)
      }
    }
  }, [])

  const rateSpecialFeature = useCallback(
    async (releaseId: string, featureId: string, rating: 1 | -1 | null) => {
      const uid = userIdRef.current
      if (!uid) return

      // Optimistic update
      setReleases((prev) =>
        prev.map((r) => {
          if (r.id !== releaseId) return r
          return {
            ...r,
            specialFeatures: r.specialFeatures.map((sf) =>
              sf.id === featureId ? { ...sf, userRating: rating } : sf,
            ),
          }
        }),
      )

      try {
        await dbRateSpecialFeature(releaseId, featureId, uid, rating)
      } catch (err) {
        console.error('[useReleases] rating error:', err)
        setError('Failed to save rating. Please try again.')
        // Re-fetch to restore truthful state
        const uid2 = userIdRef.current
        if (uid2) {
          fetchReleases(uid2)
            .then(async (data) => {
              const ratings = await fetchUserFeatureRatings(
                data.map((r) => r.id),
                uid2,
              )
              setReleases(mergeRatings(data, ratings))
            })
            .catch(console.error)
        }
      }
    },
    [],
  )

  const clearError = useCallback(() => setError(null), [])

  return {
    releases,
    loading,
    error,
    clearError,
    addRelease,
    updateRelease,
    removeRelease,
    rateSpecialFeature,
  }
}
