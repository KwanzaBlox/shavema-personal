import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Role } from './types'

export interface Profile {
  id: string
  fullName: string
  shortName: string
  slug: string | null
  role: Role
}

interface AuthValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub?.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user || !supabase) {
      setProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('id, full_name, short_name, slug, role')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setProfile({
            id: data.id,
            fullName: data.full_name,
            shortName: data.short_name,
            slug: data.slug,
            role: data.role,
          })
        } else {
          setProfile(null)
        }
      })
  }, [user])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      profile,
      loading,
      signIn: async (email, password) => {
        if (!supabase) {
          return { error: 'Supabase не настроен — проверь файл .env.local' }
        }
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        return error ? { error: error.message } : {}
      },
      signOut: async () => {
        await supabase?.auth.signOut()
      },
    }),
    [user, profile, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth должен использоваться внутри AuthProvider')
  }
  return ctx
}
