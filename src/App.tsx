import { BrowserRouter, Route, Routes } from 'react-router-dom'
import type { Release } from './types'
import { HomePage } from './pages/HomePage'
import { ReleasePage } from './pages/ReleasePage'
import { useLocalStorage } from './hooks/useLocalStorage'

const STORAGE_KEY = 'kinobin-releases'
const LEGACY_KEY = 'fizpedia-releases'

// One-time migration: carry data forward from the old 'fizpedia-releases' key.
// Runs once on load; harmless if the old key doesn't exist.
;(function migrateStorage() {
  try {
    const legacy = window.localStorage.getItem(LEGACY_KEY)
    if (legacy && !window.localStorage.getItem(STORAGE_KEY)) {
      window.localStorage.setItem(STORAGE_KEY, legacy)
      window.localStorage.removeItem(LEGACY_KEY)
    }
  } catch {
    // Ignore — storage may be unavailable in some environments.
  }
})()

function App() {
  const [releases, setReleases] = useLocalStorage<Release[]>(STORAGE_KEY, [])

  function addRelease(release: Release) {
    setReleases((prev) => [...prev, release])
  }

  function updateRelease(id: string, updates: Partial<Release>) {
    setReleases((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    )
  }

  function removeRelease(id: string) {
    setReleases((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <BrowserRouter>
      <div className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-10 border-b border-border pb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Kinobin
          </h1>
          <p className="mt-2 text-sm text-muted">
            Your personal physical media collection.
          </p>
        </header>

        <Routes>
          <Route
            path="/"
            element={
              <HomePage releases={releases} onAddRelease={addRelease} />
            }
          />
          <Route
            path="/release/:id"
            element={
              <ReleasePage
                releases={releases}
                onUpdate={updateRelease}
                onRemove={removeRelease}
              />
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
