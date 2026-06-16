import { BrowserRouter, Route, Routes } from 'react-router-dom'
import type { Release } from './types'
import { HomePage } from './pages/HomePage'
import { ReleasePage } from './pages/ReleasePage'
import { useLocalStorage } from './hooks/useLocalStorage'

const STORAGE_KEY = 'fizpedia-releases'

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
            Fizpedia
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
