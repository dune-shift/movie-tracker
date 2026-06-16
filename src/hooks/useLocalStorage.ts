import { useState, useEffect } from 'react'

/**
 * A drop-in replacement for useState that persists the value to localStorage.
 * On first mount it reads from storage; on every change it writes back.
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

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue))
    } catch (err) {
      // Likely a QuotaExceededError (e.g. too many large base64 cover images).
      console.warn(`[useLocalStorage] Failed to write key "${key}":`, err)
    }
  }, [key, storedValue])

  return [storedValue, setStoredValue] as const
}
