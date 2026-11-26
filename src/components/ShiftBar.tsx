import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { formatTime, manilaDateOf, manilaToday } from '../lib/dates'
import { errorMessage, hoursText } from '../lib/format'
import { useLoad } from '../lib/useLoad'
import { Clock } from './icons'
import { Button, Dialog, Notice } from './ui'

const dayFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })

/**
 * Clock in / clock out for barbers and the front desk, shown above every page.
 * The owner doesn't clock in, so the bar hides itself for them (the database returns null).
 */
export function ShiftBar() {
  const shifts = useLoad(() => api.myShiftsToday(), [])
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // the clock, so "on shift for" moves along
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  if (!shifts.data) return null
  const open = shifts.data.find((s) => !s.clock_out)
  const doneToday = shifts.data.filter((s) => s.clock_out)
  const workedToday = doneToday.reduce((sum, s) => sum + (Date.parse(s.clock_out!) - Date.parse(s.clock_in)) / 60000, 0)
  // an open shift from an earlier day = forgot to clock out
  const stale = open && manilaDateOf(open.clock_in) !== manilaToday()

  async function run(task: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await task()
      setNow(Date.now())
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
      setConfirm(false)
      shifts.reload()
    }
  }

  return (
    <div className="mb-5 space-y-2">
      {error && <Notice tone="bad">{error}</Notice>}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-[14px] border px-4 py-3 ${
          open ? (stale ? 'border-warn/30 bg-warn-bg' : 'border-good/30 bg-good-bg') : 'border-line bg-card'
        }`}
      >
        <p className={`flex min-w-0 items-center gap-2 text-[15px] ${open ? (stale ? 'text-warn' : 'text-good') : 'text-ink-2'}`}>
          <Clock size={18} className="shrink-0" />
          {open ? (
            stale ? (
              <span>
                Still clocked in since {dayFmt.format(new Date(open.clock_in))}, {formatTime(open.clock_in)}. Clock out, then clock in again. The owner fixes the old time.
              </span>
            ) : (
              <span>
                On shift since <span className="num">{formatTime(open.clock_in)}</span> ·{' '}
                <span className="num">{hoursText(Math.max(0, Math.round((now - Date.parse(open.clock_in)) / 60000)))}</span>
              </span>
            )
          ) : (
            <span>
              Not clocked in
              {doneToday.length > 0 && (
                <>
                  {' · '}worked <span className="num">{hoursText(Math.round(workedToday))}</span> today
                </>
              )}
            </span>
          )}
        </p>
        {open ? (
          <Button variant="secondary" className="h-11 shrink-0" onClick={() => setConfirm(true)}>
            Clock out
          </Button>
        ) : (
          <Button variant="secondary" className="h-11 shrink-0" loading={busy} onClick={() => run(() => api.clockIn())}>
            Clock in
          </Button>
        )}
      </div>

      <Dialog open={confirm} title="Clock out now?" onClose={() => setConfirm(false)}>
        <p className="text-[15px] text-ink-2">Your shift ends at the time you tap. You can clock in again later for another shift.</p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="h-12 flex-1" onClick={() => setConfirm(false)}>
            Back
          </Button>
          <Button className="h-12 flex-1" loading={busy} onClick={() => run(() => api.clockOut())}>
            Clock out
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
