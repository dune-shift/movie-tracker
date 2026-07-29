import { useState } from 'react'

interface AuthPageProps {
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>
  onSignUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>
}

// ── Feature block illustrations ───────────────────────────────────────────────

/** A clamshell/disc-case standing upright — evokes the physical release object */
function CaseIllustration() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-12"
      aria-hidden="true"
    >
      {/* Case body */}
      <rect x="8" y="6" width="34" height="52" rx="3" stroke="#6366f1" strokeWidth="2" />
      {/* Spine stripe */}
      <rect x="8" y="6" width="8" height="52" rx="2" fill="#6366f1" fillOpacity="0.18" stroke="#6366f1" strokeWidth="2" />
      {/* Cover art placeholder lines */}
      <line x1="20" y1="18" x2="38" y2="18" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="23" x2="34" y2="23" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      {/* Disc peek at bottom */}
      <ellipse cx="46" cy="46" rx="10" ry="10" fill="#1a1d27" stroke="#6366f1" strokeWidth="2" />
      <circle cx="46" cy="46" r="3" fill="#6366f1" fillOpacity="0.4" stroke="#6366f1" strokeWidth="1.5" />
      {/* Disc shine arc */}
      <path d="M 38 42 A 10 10 0 0 1 50 40" stroke="#818cf8" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

/** Two disc circles side-by-side — 4K + Blu-ray — evokes a multi-format release */
function DiscsIllustration() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-12"
      aria-hidden="true"
    >
      {/* Back disc (Blu-ray) */}
      <circle cx="30" cy="34" r="16" fill="#1a1d27" stroke="#6366f1" strokeWidth="2" />
      <circle cx="30" cy="34" r="5" fill="#6366f1" fillOpacity="0.3" stroke="#6366f1" strokeWidth="1.5" />
      <path d="M 16 28 A 16 16 0 0 1 36 18" stroke="#818cf8" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      {/* "BD" label */}
      <text x="30" y="51" textAnchor="middle" fontSize="6" fill="#8b93a7" fontFamily="system-ui, sans-serif" fontWeight="600">BD</text>

      {/* Front disc (4K) — slightly offset and on top */}
      <circle cx="40" cy="26" r="16" fill="#0f1117" stroke="#818cf8" strokeWidth="2" />
      <circle cx="40" cy="26" r="5" fill="#818cf8" fillOpacity="0.3" stroke="#818cf8" strokeWidth="1.5" />
      <path d="M 26 20 A 16 16 0 0 1 46 10" stroke="#c7d2fe" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      {/* "4K" label */}
      <text x="40" y="11" textAnchor="middle" fontSize="6" fill="#818cf8" fontFamily="system-ui, sans-serif" fontWeight="700">4K</text>
    </svg>
  )
}

/** A tag + a small bar chart — evokes tagging and data analysis */
function AnalyzeIllustration() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-12"
      aria-hidden="true"
    >
      {/* Tag shape */}
      <path
        d="M 8 8 L 30 8 L 46 24 L 30 40 L 8 40 Z"
        stroke="#6366f1"
        strokeWidth="2"
        fill="#6366f1"
        fillOpacity="0.12"
      />
      {/* Tag hole */}
      <circle cx="16" cy="24" r="3" stroke="#6366f1" strokeWidth="1.5" />
      {/* Tag text lines */}
      <line x1="22" y1="20" x2="36" y2="20" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="28" x2="32" y2="28" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

      {/* Bar chart */}
      <rect x="20" y="48" width="6" height="10" rx="1" fill="#6366f1" fillOpacity="0.4" />
      <rect x="30" y="42" width="6" height="16" rx="1" fill="#6366f1" fillOpacity="0.65" />
      <rect x="40" y="44" width="6" height="14" rx="1" fill="#818cf8" fillOpacity="0.85" />
      <rect x="50" y="38" width="6" height="20" rx="1" fill="#818cf8" />
    </svg>
  )
}

// ── Feature blocks ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    key: 'releases',
    illustration: <CaseIllustration />,
    heading: 'Add your releases',
    body: 'Log every new addition to your shelf.',
  },
  {
    key: 'films',
    illustration: <DiscsIllustration />,
    heading: 'Track every film and special feature',
    body: 'Add every film and special feature included in the releases.',
  },
  {
    key: 'analyze',
    illustration: <AnalyzeIllustration />,
    heading: 'Obsess over your collection',
    body: 'Tag, filter, and analyze what you own like never before.',
  },
]

// ── Main component ────────────────────────────────────────────────────────────

export function AuthPage({ onSignIn, onSignUp }: AuthPageProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return

    setIsSubmitting(true)
    setError(null)

    if (mode === 'signin') {
      const { error: err } = await onSignIn(email.trim(), password)
      if (err) setError(err)
    } else {
      const { error: err, needsConfirmation } = await onSignUp(email.trim(), password)
      if (err) {
        setError(err)
      } else if (needsConfirmation) {
        setConfirmationSent(true)
      }
      // If no error and no confirmation needed, the auth state change will
      // redirect automatically.
    }

    setIsSubmitting(false)
  }

  if (confirmationSent) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="mb-4 text-4xl">📬</div>
          <h2 className="text-lg font-semibold text-white">Check your email</h2>
          <p className="mt-2 text-sm text-muted">
            We sent a confirmation link to <span className="text-white">{email}</span>.
            Click it to activate your account, then come back to sign in.
          </p>
          <button
            type="button"
            onClick={() => {
              setConfirmationSent(false)
              setMode('signin')
            }}
            className="mt-6 text-sm text-accent transition hover:text-accent-hover"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-12">

      {/* ── Feature blocks ── */}
      <div className="w-full max-w-3xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.key}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-raised p-6"
            >
              <div className="flex items-center justify-center rounded-xl bg-surface-overlay p-4 w-fit">
                {f.illustration}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{f.heading}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Auth form ── */}
      <div className="w-full max-w-sm">
        {/* Mode tabs */}
        <div className="mb-6 flex rounded-xl border border-border bg-surface-overlay p-1">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null) }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                mode === m
                  ? 'bg-accent text-white'
                  : 'text-muted hover:text-white'
              }`}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-surface p-8 space-y-4"
        >
          <h2 className="text-base font-semibold text-white">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              {error}
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
              className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
              placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting || !email.trim() || !password.trim()}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting
              ? mode === 'signin' ? 'Signing in…' : 'Creating account…'
              : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>

    </div>
  )
}
