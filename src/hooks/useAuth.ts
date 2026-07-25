import { useEffect, useState } from 'react'
import type { User, AuthError } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

interface UseAuthReturn {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<AuthError | null>
  signUp: (email: string, password: string) => Promise<AuthError | null>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Hydrate from existing session (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Keep in sync with sign-in / sign-out events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string): Promise<AuthError | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signUp(email: string, password: string): Promise<AuthError | null> {
    const { error } = await supabase.auth.signUp({ email, password })
    return error
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  return { user, loading, signIn, signUp, signOut }
}
