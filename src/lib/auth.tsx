import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { applyTheme } from './theme'
import type { Profile, Session, SignupDetails, StaffRole } from './types'

type AuthValue = {
  /** undefined while checking the saved session, null when signed out */
  session: Session | null | undefined
  /** undefined while loading, null when the account has no profile yet */
  profile: Profile | null | undefined
  /** undefined while loading, null for customers */
  staffRole: StaffRole | null | undefined
  setProfile: (profile: Profile) => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, details: SignupDetails) => Promise<{ needsConfirm: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

// Holds "who is signed in" and their profile, so any screen can ask.
// The staff app keeps its own light/dark choice, so it passes profileTheme={false}.
export function AuthProvider({ children, profileTheme = true }: { children: ReactNode; profileTheme?: boolean }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [profile, setProfileState] = useState<Profile | null | undefined>(undefined)
  const [staffRole, setStaffRole] = useState<StaffRole | null | undefined>(undefined)

  useEffect(() => {
    api
      .getSession()
      .then(setSession)
      .catch(() => setSession(null))
    // sign in, sign out, or the email link opening the app
    const stopSession = api.onSessionChange(setSession)
    // the "forgot password" link signs you in: send it to the page that asks for the new password
    const stopRecovery = api.onPasswordRecovery(() => {
      if (window.location.pathname !== '/new-password') window.location.replace('/new-password')
    })
    return () => {
      stopSession()
      stopRecovery()
    }
  }, [])

  const userId = session?.userId
  useEffect(() => {
    if (session === undefined) return
    if (!userId) {
      setProfileState(null)
      setStaffRole(null)
      return
    }
    let current = true
    setProfileState(undefined)
    setStaffRole(undefined)
    api
      .myProfile()
      .then((loaded) => {
        if (!current) return
        setProfileState(loaded)
        if (loaded && profileTheme) applyTheme(loaded.theme)
      })
      .catch(() => current && setProfileState(null))
    // staff (owner, desk, barber) get the shop screens
    api
      .myStaffRole()
      .then((role) => current && setStaffRole(role))
      .catch(() => current && setStaffRole(null))
    return () => {
      current = false
    }
    // only reload when the person changes, not on every token refresh
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, session === undefined])

  const setProfile = useCallback((next: Profile) => {
    setProfileState(next)
    if (profileTheme) applyTheme(next.theme)
  }, [profileTheme])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      staffRole,
      setProfile,
      signIn: async (email, password) => setSession(await api.signIn(email, password)),
      signUp: (email, password, details) => api.signUp(email, password, details),
      signOut: async () => {
        await api.signOut()
        setSession(null)
      },
    }),
    [session, profile, staffRole, setProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
