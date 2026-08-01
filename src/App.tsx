import { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import type { Release } from './types'
import { HomePage } from './pages/HomePage'
import { ReleasePage } from './pages/ReleasePage'
import { StatsPage } from './pages/StatsPage'
import { AuthPage } from './pages/AuthPage'
import { useAuth } from './hooks/useAuth'
import { useReleases } from './hooks/useReleases'
import { insertRelease } from './services/db'

const LEGACY_KEY = 'kinobin-releases'

function App() {
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth()
  const {
    releases,
    loading: releasesLoading,
    error: releasesError,
    clearError,
    addRelease,
    updateRelease,
    removeRelease,
  } = useReleases(user?.id ?? null)

  // ── localStorage migration ────────────────────────────────
  const [legacyData, setLegacyData] = useState<Release[] | null>(null)
  const [isMigrating, setIsMigrating] = useState(false)

  useEffect(() => {
    if (!user) return
    try {
      const raw = window.localStorage.getItem(LEGACY_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Release[]
      if (Array.isArray(parsed) && parsed.length > 0) setLegacyData(parsed)
    } catch {
      // Corrupt data — ignore
    }
  }, [user])

  async function handleMigrate() {
    if (!legacyData || !user) return
    setIsMigrating(true)
    try {
      for (const r of legacyData) {
        await insertRelease(
          { ...r, specialFeatures: r.specialFeatures ?? [] },
          user.id,
        )
      }
      window.localStorage.removeItem(LEGACY_KEY)
      // Reload to re-fetch from Supabase cleanly
      window.location.reload()
    } catch (err) {
      console.error('[migration]', err)
      setIsMigrating(false)
    }
  }

  // ── Auth handlers (adapt to AuthPage's expected API) ─────
  async function handleSignIn(email: string, password: string) {
    const error = await signIn(email, password)
    return { error: error?.message ?? null }
  }

  async function handleSignUp(email: string, password: string) {
    const error = await signUp(email, password)
    // If signUp succeeds but email confirmation is required, Supabase returns
    // no error but also no session yet. Detect this via the null session.
    const needsConfirmation = !error
    return { error: error?.message ?? null, needsConfirmation }
  }

  // ── Render ───────────────────────────────────────────────

  // While we're waiting for the session cookie to hydrate, show nothing
  // (avoids a flash of the login screen on refresh).
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    )
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'border-accent text-white'
        : 'border-transparent text-muted hover:text-white'
    }`

  return (
    <BrowserRouter>
      <div className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <header className="mb-10 border-b border-border pb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Kinobin
              </h1>
              <p className="mt-2 text-sm text-muted">
                Physical media collecting for cinema obsessives.
              </p>
            </div>

            {user && (
              <div className="flex items-center gap-3">
                <span className="hidden text-xs text-muted sm:block truncate max-w-[200px]">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:bg-surface-overlay hover:text-white"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* ── Nav ── */}
          {user && (
            <nav className="mt-6 flex gap-1">
              <NavLink to="/" end className={navLinkClass}>
                Collection
              </NavLink>
              <NavLink to="/stats" className={navLinkClass}>
                Stats
              </NavLink>
            </nav>
          )}
        </header>

        {/* ── localStorage migration banner ── */}
        {legacyData && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-amber-300">
                Import your existing collection
              </p>
              <p className="mt-0.5 text-xs text-amber-200/70">
                We found {legacyData.length} release{legacyData.length !== 1 ? 's' : ''} stored locally. Import them into your Supabase account so they sync across devices.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  window.localStorage.removeItem(LEGACY_KEY)
                  setLegacyData(null)
                }}
                className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-300/70 transition hover:text-amber-300"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleMigrate}
                disabled={isMigrating}
                className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-medium text-black transition hover:bg-amber-400 disabled:opacity-50"
              >
                {isMigrating ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        )}

        {/* ── Global error toast ── */}
        {releasesError && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400">{releasesError}</p>
            <button
              type="button"
              onClick={clearError}
              className="text-red-400/60 transition hover:text-red-400"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Routes ── */}
        {!user ? (
          <AuthPage onSignIn={handleSignIn} onSignUp={handleSignUp} />
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                <HomePage
                  releases={releases}
                  loading={releasesLoading}
                  userId={user.id}
                  onAddRelease={addRelease}
                  onUpdateRelease={updateRelease}
                />

              }
            />
            <Route
              path="/release/:id"
              element={
                <ReleasePage
                  releases={releases}
                  userId={user.id}
                  onUpdate={updateRelease}
                  onRemove={removeRelease}
                />
              }
            />
            <Route
              path="/stats"
              element={<StatsPage releases={releases} loading={releasesLoading} />}
            />
          </Routes>
        )}
      </div>
    </BrowserRouter>
  )
}

export default App
