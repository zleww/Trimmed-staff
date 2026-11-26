import { useState } from 'react'
import { CheckCircle } from '../components/icons'
import { Button, Dialog, Field, Notice, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { manilaToday } from '../lib/dates'
import { errorMessage, peso } from '../lib/format'
import { parsePeso } from '../lib/money'
import type { CloseResult } from '../lib/types'
import { useLoad } from '../lib/useLoad'

/**
 * End of day, blind count: the desk types what is in the drawer and the
 * wallets. It never sees what the system expected; only the owner does.
 */
export function ClosePage() {
  const { staffRole } = useAuth()
  const today = manilaToday()
  const closed = useLoad(() => api.isDayClosed(today), [today])
  const [cash, setCash] = useState('')
  const [gcash, setGcash] = useState('')
  const [maya, setMaya] = useState('')
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CloseResult | null>(null)

  const counts = [parsePeso(cash), parsePeso(gcash), parsePeso(maya)]
  const bad = counts.some((c) => c === null)

  async function close() {
    setBusy(true)
    setError(null)
    try {
      setResult(await api.closeDay({ cash_centavos: counts[0]!, gcash_centavos: counts[1]!, maya_centavos: counts[2]!, note: note.trim() }))
      setConfirming(false)
      closed.reload()
    } catch (reason) {
      setError(errorMessage(reason))
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-[30px] leading-tight sm:text-[34px]">Close the day</h1>
      <p className="mt-1 text-[15px] text-ink-3">Count the cash drawer and check the GCash and Maya apps, then type what you see.</p>

      <div className="mt-6 space-y-4">
        {closed.error && <Notice tone="bad">{closed.error}</Notice>}
        {closed.loading && closed.data === undefined && <Skeleton className="h-64" />}

        {(closed.data || result) && (
          <div className="rounded-[14px] border border-line bg-card p-6">
            <p className="flex items-center gap-2 text-[17px] font-medium text-good">
              <CheckCircle size={20} />
              Today is closed
            </p>
            <p className="mt-2 text-[15px] text-ink-2">No more sales can be recorded today. The owner can see the count.</p>
            {result && staffRole === 'owner' && result.cash_difference_centavos !== undefined && (
              <dl className="mt-4 space-y-2 text-[15px]">
                <Difference label="Cash" centavos={result.cash_difference_centavos} />
                <Difference label="GCash" centavos={result.gcash_difference_centavos ?? 0} />
                <Difference label="Maya" centavos={result.maya_difference_centavos ?? 0} />
              </dl>
            )}
          </div>
        )}

        {closed.data === false && !result && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (bad) return setError('Type amounts as numbers, like 1250 or 1,250.50')
              setError(null)
              setConfirming(true)
            }}
          >
            {error && <Notice tone="bad">{error}</Notice>}
            <Field label="Cash in the drawer" inputMode="decimal" placeholder="0" value={cash} onChange={(e) => setCash(e.target.value)} />
            <Field label="GCash received" inputMode="decimal" placeholder="0" value={gcash} onChange={(e) => setGcash(e.target.value)} />
            <Field label="Maya received" inputMode="decimal" placeholder="0" value={maya} onChange={(e) => setMaya(e.target.value)} />
            <Field label="Note (optional)" placeholder="₱20 coin short, will check tomorrow" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            <Button type="submit" className="h-12 w-full">
              Close the day
            </Button>
          </form>
        )}
      </div>

      <Dialog open={confirming} title="Close the day?" onClose={() => setConfirming(false)}>
        <p className="text-[15px] text-ink-2">
          You counted {peso(counts[0] ?? 0)} cash, {peso(counts[1] ?? 0)} GCash and {peso(counts[2] ?? 0)} Maya. After this, no more sales can be recorded
          today.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="h-12 flex-1" onClick={() => setConfirming(false)}>
            Back
          </Button>
          <Button className="h-12 flex-1" loading={busy} onClick={close}>
            Close the day
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function Difference({ label, centavos }: { label: string; centavos: number }) {
  const text = centavos === 0 ? 'Matches' : centavos > 0 ? `${peso(centavos)} over` : `${peso(-centavos)} short`
  return (
    <div className="flex justify-between">
      <dt className="text-ink-2">{label}</dt>
      <dd className={`num ${centavos === 0 ? 'text-good' : 'text-warn'}`}>{text}</dd>
    </div>
  )
}
