import { useState } from 'react'
import { Alert, Clock } from '../components/icons'
import { Button, Dialog, Field, Notice, Segmented, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { addDays, formatTime, manilaDateOf, manilaToday, manilaWallClock, weekdayOf } from '../lib/dates'
import { errorMessage, hoursText } from '../lib/format'
import type { AttendanceRow } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { Select } from './Select'

type Range = 'today' | 'week' | 'month'

// Manila dates for each choice. Weeks start on Monday.
function rangeFor(range: Range): { from: string; to: string } {
  const today = manilaToday()
  if (range === 'today') return { from: today, to: today }
  if (range === 'week') return { from: addDays(today, -((weekdayOf(today) + 6) % 7)), to: today }
  return { from: today.slice(0, 8) + '01', to: today }
}

const dayFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
const roleName = { desk: 'Front desk', barber: 'Barber' } as const

// "2026-11-26T09:05" in Manila, for <input type="datetime-local">
const toInput = (iso: string) => `${manilaDateOf(iso)}T${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Manila' }).format(new Date(iso))}`
const fromInput = (value: string) => manilaWallClock(value.slice(0, 10), value.slice(11, 16)).toISOString()

/** The owner's view of who clocked in and out, and for how long. */
export function AttendancePage() {
  const [range, setRange] = useState<Range>('week')
  const [person, setPerson] = useState('')
  const [fixing, setFixing] = useState<AttendanceRow | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const { from, to } = rangeFor(range)
  const list = useLoad(() => api.attendance(from, to), [from, to])

  const all = list.data ?? []
  const people = [...new Map(all.map((s) => [s.staff_id, s.full_name])).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const shown = person ? all.filter((s) => s.staff_id === person) : all

  // total hours per person in the range (closed shifts only)
  const totals = people
    .map(([id, name]) => {
      const mine = all.filter((s) => s.staff_id === id)
      return { id, name, minutes: mine.reduce((sum, s) => sum + (s.minutes ?? 0), 0), shifts: mine.length, open: mine.some((s) => !s.clock_out) }
    })
    .filter((t) => !person || t.id === person)

  // group the shifts by the day they started
  const days = [...new Set(shown.map((s) => manilaDateOf(s.clock_in)))]

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] leading-tight sm:text-[34px]">Attendance</h1>
          <p className="text-[15px] text-ink-3">Barbers and the front desk clock in and out from their own login.</p>
        </div>
        <Segmented
          label="Period"
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This week' },
            { value: 'month', label: 'This month' },
          ]}
        />
      </div>

      <div className="mt-6 space-y-6">
        {message && <Notice tone="good">{message}</Notice>}
        {list.error && <Notice tone="bad">{list.error}</Notice>}
        {list.loading && !list.data && <Skeleton className="h-64" />}

        {list.data && all.length === 0 && (
          <p className="rounded-[14px] border border-line bg-card p-6 text-center text-[15px] text-ink-2">No one clocked in in this period.</p>
        )}

        {people.length > 1 && (
          <Select label="Person" value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">Everyone</option>
            {people.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        )}

        {totals.length > 0 && (
          <section aria-label="Hours per person">
            <h2 className="label mb-2">Hours in this period</h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {totals.map((t) => (
                <li key={t.id} className="min-w-0 rounded-[14px] border border-line bg-card px-4 py-3">
                  <p className="truncate text-[15px]">{t.name}</p>
                  <p className="num mt-0.5 text-[22px] font-medium">{hoursText(t.minutes)}</p>
                  <p className="text-[13px] text-ink-3">
                    {t.shifts} {t.shifts === 1 ? 'shift' : 'shifts'}
                    {t.open && ' · one still open'}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {days.map((day) => (
          <section key={day} aria-label={day}>
            <h2 className="label mb-2">{dayFmt.format(new Date(`${day}T00:00:00Z`))}</h2>
            <ul className="space-y-2">
              {shown
                .filter((s) => manilaDateOf(s.clock_in) === day)
                .map((s) => {
                  const stale = !s.clock_out && manilaDateOf(s.clock_in) !== manilaToday()
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] border border-line bg-card px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px]">{s.full_name}</span>
                        <span className="block truncate text-[13px] text-ink-3">
                          {roleName[s.role]}
                          {s.branch_name && ` · ${s.branch_name}`}
                        </span>
                      </span>
                      <span className="num text-[15px] whitespace-nowrap">
                        {formatTime(s.clock_in)} – {s.clock_out ? formatTime(s.clock_out) : '…'}
                      </span>
                      <span className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        {s.clock_out ? (
                          <span className="num rounded-full bg-raised px-2.5 py-1 text-[13px] font-medium text-ink-2 max-sm:mr-auto">{hoursText(s.minutes ?? 0)}</span>
                        ) : stale ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-bg px-2.5 py-1 text-[13px] font-medium text-warn max-sm:mr-auto">
                            <Alert size={14} />
                            No clock-out
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-good-bg px-2.5 py-1 text-[13px] font-medium text-good max-sm:mr-auto">
                            <Clock size={14} />
                            On shift
                          </span>
                        )}
                        <Button variant="ghost" className="h-11" onClick={() => setFixing(s)}>
                          Fix
                        </Button>
                      </span>
                      {s.fix_reason && <p className="w-full text-[13px] text-ink-3">Fixed: "{s.fix_reason}"</p>}
                    </li>
                  )
                })}
            </ul>
          </section>
        ))}
      </div>

      {fixing && (
        <FixDialog
          shift={fixing}
          onClose={() => setFixing(null)}
          onDone={() => {
            setMessage(`Fixed ${fixing.full_name}'s shift.`)
            setFixing(null)
            list.reload()
          }}
        />
      )}
    </div>
  )
}

function FixDialog({ shift, onClose, onDone }: { shift: AttendanceRow; onClose: () => void; onDone: () => void }) {
  const [clockIn, setClockIn] = useState(toInput(shift.clock_in))
  const [clockOut, setClockOut] = useState(shift.clock_out ? toInput(shift.clock_out) : '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialog open title={`Fix ${shift.full_name}'s shift`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!clockIn) return setError('Enter the clock-in time')
          setBusy(true)
          setError(null)
          try {
            await api.fixShift(shift.id, fromInput(clockIn), clockOut ? fromInput(clockOut) : null, reason.trim())
            onDone()
          } catch (reason) {
            setError(errorMessage(reason))
          } finally {
            setBusy(false)
          }
        }}
      >
        {error && <Notice tone="bad">{error}</Notice>}
        <Field label="Clock in" type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
        <Field label="Clock out" hint="Leave empty if they're still on shift" type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
        <Field label="Reason" placeholder="Forgot to clock out" value={reason} onChange={(e) => setReason(e.target.value)} />
        <p className="text-[13px] text-ink-3">The old times and your reason are kept in the log.</p>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" className="h-12 flex-1" onClick={onClose}>
            Back
          </Button>
          <Button type="submit" className="h-12 flex-1" loading={busy}>
            Save fix
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
