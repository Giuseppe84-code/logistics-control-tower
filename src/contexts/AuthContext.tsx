import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type PlanTier = 'free' | 'pro'

export interface Profile {
  id: string
  email: string
  plan: PlanTier
  trial_ends_at: string | null
  stripe_customer_id: string | null
}

export function isPro(profile: Profile | null): boolean {
  return profile?.plan === 'pro'
}

export function trialDaysLeft(profile: Profile | null): number {
  if (!profile?.trial_ends_at) return 0
  const ms = new Date(profile.trial_ends_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, plan, trial_ends_at, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null
  return data as Profile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profileState, setProfileState] = useState<{ userId: string; profile: Profile | null } | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const user = session?.user ?? null
  const userId = user?.id
  const profile = profileState?.userId === userId ? profileState?.profile ?? null : null
  const loading = !authReady || Boolean(userId && profileState?.userId !== userId)

  useEffect(() => {
    let mounted = true
    let receivedEvent = false
    // Auth callbacks must return synchronously; profile requests run separately.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return
      receivedEvent = true
      setSession(newSession)
      setAuthReady(true)
    })
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted || receivedEvent) return
      setSession(data.session)
      setAuthReady(true)
    }).catch(() => { if (mounted) setAuthReady(true) })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!userId) { setProfileState(null); return }
    let mounted = true
    let pending = false
    const load = async () => {
      if (pending) return
      pending = true
      try {
        const next = await fetchProfile(userId)
        if (mounted) setProfileState({ userId, profile: next })
      } finally { pending = false }
    }
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    void load()
    // A checkout redirect can arrive before the webhook commits the new plan.
    const timer = window.setInterval(refreshVisible, 15000)
    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      mounted = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [userId])

  async function refreshProfile() {
    if (userId) setProfileState({ userId, profile: await fetchProfile(userId) })
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfileState(null)
  }

  const value: AuthContextValue = {
    session,
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
