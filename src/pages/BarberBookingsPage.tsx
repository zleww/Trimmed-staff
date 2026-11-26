import { useEffect, useState } from 'react'
import { AlertsButton } from '../components/AlertsButton'
import { Calendar, CheckCircle, Clock, Scissors } from '../components/icons'
import { BookingInspo } from '../components/Inspo'
import { Notice, Skeleton } from '../components/ui'
import { bookingsSeenAt, markBookingsSeen } from '../lib/alerts'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { formatTime, manilaDateOf, manilaToday, addDays } from '../lib/dates'
import type { ScheduleItem } from '../lib/types'
import { useLoad } from '../lib/useLoad'

const dayFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })

const look: Record<ScheduleItem['status'], { label: string; className: string; Icon: typeof Clock }> = {
  booked: { label: 'Confirmed', className: 'text-good bg-good-bg', Icon: CheckCircle },
  requested: { label: 'Waiting for the desk', className: 'text-warn bg-warn-bg', Icon: Clock },
  checked_in: { label: 'Arrived', className: 'text-warn bg-warn-bg', Icon: Clock },
  in_chair: { label: 'In the chair', className: 'text-good bg-good-bg', Icon: Scissors },
}

function dayTitle(date: string): string {
  const today = manilaToday()
  if (date === today) return 'Today'
  if (date === addDays(today, 1)) return 'Tomorrow'
  return dayFmt.format(new Date(`${date}T00:00:00Z`))
}

/** A barber's coming bookings for two weeks, with the customer's inspo. */
export function BarberBookingsPage() {
  const { session } = useAuth()
  const userId = session?.userId
  const list = useLoad(() => api.barberSchedule(14), [])
  // what counts as "new" is fixed when the page opens, then the badge clears
  const [seenBefore] = useState(() => (userId ? bookingsSeenAt(userId) : 0))
  useEffect(() => {
    if (userId) markBookingsSeen(userId)
  }, [userId])

  // the desk confirms bookings all day: look again every minute
  const { reload } = list
  useEffect(() => {
    const timer = setInterval(reload, 60_000)
    return () => clearInterval(timer)
  }, [reload])

  const items = list.data ?? []
  const days = [...new Set(items.map((b) => manilaDateOf(b.starts_at)))]

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] leading-tight sm:text-[34px]">My bookings</h1>
          <p className="text-[15px] text-ink-3">Who booked you for the next two weeks. Open the inspo before they come.</p>
        </div>
        <AlertsButton />
      </div>

      <div className="mt-6 space-y-6">
        {list.error && <Notice tone="bad">{list.error}</Notice>}
        {list.loading && !list.data && <Skeleton className="h-64" />}
        {list.data && items.length === 0 && (
          <p className="rounded-[14px] border border-line bg-card p-6 text-center text-[15px] text-ink-2">No bookings with you yet. New ones show here once the desk confirms them.</p>
        )}

        {days.map((day) => (
          <section key={day} aria-label={dayTitle(day)}>
            <h2 className="label mb-2">{dayTitle(day)}</h2>
            <ul className="space-y-2">
              {items
                .filter((b) => manilaDateOf(b.starts_at) === day)
                .map((b) => {
                  const status = look[b.status]
                  const fresh = b.status === 'booked' && b.confirmed_at !== null && Date.parse(b.confirmed_at) > seenBefore
                  return (
                    <li key={b.id} className="rounded-[14px] border border-line bg-card px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="num w-[4.5rem] shrink-0 text-[15px] font-medium whitespace-nowrap">{formatTime(b.starts_at)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[16px]">{b.customer_name}</span>
                            {fresh && <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 text-[11px] font-semibold text-bg">New</span>}
                          </span>
                          <span className="block truncate text-[13px] text-ink-3">
                            {b.service_name}
                            {b.branch_name && ` · ${b.branch_name}`} · <span className="num tracking-wider">{b.code}</span>
                          </span>
                        </span>
                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium ${status.className}`}>
                          <status.Icon size={14} />
                          {status.label}
                        </span>
                      </div>
                      {b.inspo > 0 && <BookingInspo bookingId={b.id} editable={false} title="Inspo from the customer" />}
                    </li>
                  )
                })}
            </ul>
          </section>
        ))}
        {items.length > 0 && (
          <p className="flex items-center gap-2 text-[13px] text-ink-3">
            <Calendar size={14} />
            Requests waiting for the desk can still be declined. Only confirmed ones are sure.
          </p>
        )}
      </div>
    </div>
  )
}
