import { useState, type FormEvent } from 'react'
import { CheckCircle } from '../components/icons'
import { Button, Field, Notice, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { errorMessage } from '../lib/format'
import type { TwoStepSetup } from '../lib/types'
import { useLoad } from '../lib/useLoad'

// Two-step sign-in for the signed-in account: after the password, a 6-digit code
// from an authenticator app. With it on, a stolen password alone can't open the
// shop's money and customer records (the database checks this, not just the app).
export function SecurityPage() {
  const [version, setVersion] = useState(0)
  const status = useLoad(() => api.twoStepStatus(), [version])
  const [setup, setSetup] = useState<TwoStepSetup | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  async function act(action: () => Promise<void>) {
    setBusy(true)
    setMessage(null)
    try {
      await action()
    } catch (reason) {
      setMessage({ tone: 'bad', text: errorMessage(reason) })
    } finally {
      setBusy(false)
    }
  }

  function confirm(event: FormEvent) {
    event.preventDefault()
    void act(async () => {
      await api.confirmTwoStep(setup!.factorId, code)
      setSetup(null)
      setCode('')
      setMessage({ tone: 'good', text: 'Two-step sign-in is on. You will be asked for a code each time you sign in.' })
      setVersion((n) => n + 1)
    })
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-[30px] leading-tight sm:text-[34px]">Security</h1>
      <p className="mt-1 text-[15px] text-ink-3">Two-step sign-in: your password plus a code from your phone.</p>

      <section className="mt-6 space-y-4 rounded-[14px] border border-line bg-card p-5">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        {status.error && <Notice tone="bad">{status.error}</Notice>}
        {!status.data && !status.error && <Skeleton className="h-32" />}

        {status.data?.on && (
          <>
            <p className="flex items-center gap-2 text-[16px] font-medium text-good">
              <CheckCircle size={18} />
              On for this account
            </p>
            <p className="text-[15px] text-ink-2">
              Signing in needs your password and a code from your authenticator app. Getting a new phone? Turn this off on the old one first, then turn it on
              again on the new one.
            </p>
            {confirmOff ? (
              <div className="space-y-3">
                <p className="text-[15px] text-ink-2">With it off, anyone with your password can open the shop's records.</p>
                <div className="flex gap-2">
                  <Button variant="ghost" className="h-12 flex-1" onClick={() => setConfirmOff(false)}>
                    Keep it on
                  </Button>
                  <Button
                    variant="danger"
                    className="h-12 flex-1"
                    loading={busy}
                    onClick={() =>
                      act(async () => {
                        await api.turnOffTwoStep()
                        setConfirmOff(false)
                        setMessage({ tone: 'good', text: 'Two-step sign-in is off. Only the password is needed now.' })
                        setVersion((n) => n + 1)
                      })
                    }
                  >
                    Turn it off
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" className="h-12" onClick={() => setConfirmOff(true)}>
                Turn off
              </Button>
            )}
          </>
        )}

        {status.data && !status.data.on && setup && (
          <form onSubmit={confirm} className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-[15px] text-ink-2">
              <li>Open an authenticator app on your phone, like Google Authenticator or Microsoft Authenticator.</li>
              <li>Add an account and scan this code.</li>
              <li>Type the 6-digit number the app shows.</li>
            </ol>
            <img src={setup.qrCode} alt="QR code to add Trimmed staff to an authenticator app" className="size-48 rounded-[10px] bg-white p-2" />
            <p className="text-[13px] text-ink-3">
              Can't scan? Type this key into the app: <span className="font-mono break-all text-ink">{setup.secret}</span>
            </p>
            <Field
              label="Code from the app"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <div className="flex gap-2">
              <Button type="button" variant="ghost" className="h-12 flex-1" onClick={() => setSetup(null)}>
                Back
              </Button>
              <Button type="submit" className="h-12 flex-1" loading={busy} disabled={code.length !== 6}>
                Turn on
              </Button>
            </div>
          </form>
        )}

        {status.data && !status.data.on && !setup && (
          <>
            <p className="text-[15px] text-ink-2">
              Off. With it on, a stolen or guessed password alone can't open sales, staff or customer records. It takes about two minutes.
            </p>
            <Button className="h-12 w-full" loading={busy} onClick={() => act(async () => setSetup(await api.startTwoStep()))}>
              Set up two-step sign-in
            </Button>
          </>
        )}
      </section>
    </div>
  )
}
