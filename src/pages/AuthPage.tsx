import { useState } from 'react'

interface AuthPageProps {
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>
  onSignUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>
}

// ── Feature block illustrations ───────────────────────────────────────────────

/** Book + disc — evokes a physical release on your shelf */
function CaseIllustration() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <i className="fa-solid fa-book text-3xl" style={{ color: '#6366f1' }} />
      <i className="fa-solid fa-compact-disc text-3xl" style={{ color: '#818cf8' }} />
    </div>
  )
}

/** Film strip + coins — evokes films and their value */
function DiscsIllustration() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <i className="fa-solid fa-film text-3xl" style={{ color: '#6366f1' }} />
      <i className="fa-solid fa-coins text-3xl" style={{ color: '#818cf8' }} />
    </div>
  )
}

/** Tag + magnifying glass chart — evokes tagging and deep collection analysis */
function AnalyzeIllustration() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <i className="fa-solid fa-tag text-3xl" style={{ color: '#6366f1' }} />
      <i className="fa-solid fa-magnifying-glass-chart text-3xl" style={{ color: '#818cf8' }} />
    </div>
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
