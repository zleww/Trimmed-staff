import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { LogoMark } from './components/Logo'
import { Button, Field, Notice, PasswordField } from './components/ui'
import { useAuth } from './lib/auth'
import { errorMessage } from './lib/format'

// Staff sign in: email or username, no sign-up. Accounts are made by the owner.
export function SignInPage() {
  const { session, staffRole, signIn, signOut } = useAuth()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session && staffRole) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(login.trim(), password)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  // signed in, but not staff (a customer account)
  const notStaff = session && staffRole === null

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <LogoMark size={44} />
      <h1 className="mt-6 text-[28px]">Staff sign in</h1>
      <p className="mt-1 text-[15px] text-ink-2">For the owner, front desk and barbers.</p>

      {notStaff ? (
        <div className="mt-8 space-y-4">
          <Notice tone="bad">This account isn't a shop account. Sign out and use your staff login.</Notice>
          <Button variant="secondary" className="h-12 w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
          {error && <Notice tone="bad">{error}</Notice>}
          <Field
            label="Email or username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
          <PasswordField label="Password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" className="h-12 w-full text-[16px]" loading={busy || (session !== null && session !== undefined && staffRole === undefined)}>
            Sign in
          </Button>
          <p className="text-center text-[13px] text-ink-3">Forgot your password? Ask the owner, or reset it from the booking site.</p>
        </form>
      )}
    </main>
  )
}
