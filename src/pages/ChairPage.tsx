import { useEffect, useState, type ReactNode } from 'react'
import { BookingInspo } from '../components/Inspo'
import { Button, Notice, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { manilaToday } from '../lib/dates'
import { errorMessage, peso } from '../lib/format'
import type { QueueItem } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { Row, SaleDialog } from './TodayPage'

const dayFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })

/**
 * A barber's day: only their own chair, plus walk-ins nobody has taken yet.
 * queue_for_day() already hides other chairs and phone numbers from barbers.
 */
export function ChairPage() {
  const today = manilaToday()
  const queue = useLoad(() => api.queueForDay(today), [today])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [collect, setCollect] = useState<QueueItem | null>(null)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [dayLabel] = useState(() => dayFmt.format(new Date()))

  // the desk adds walk-ins and checks people in all day: look again every minute
  const { reload } = queue
  useEffect(() => {
    const timer = setInterval(reload, 60_000)
    return () => clearInterval(timer)
  }, [reload])

  async function act(row: QueueItem, run: () => Promise<void>, done: string) {
    setBusyId(row.id)
    setMessage(null)
    try {
      await run()
      setMessage({ tone: 'good', text: done })
    } catch (reason) {
      setMessage({ tone: 'bad', text: errorMessage(reason) })
    } finally {
      setBusyId(null)
      reload()
    }
  }

  const list = queue.data ?? []
  const mine = list.filter((r) => r.barber_id !== null)
  const groups: { title: string; rows: QueueItem[]; empty?: string }[] = [
    { title: 'In my chair', rows: mine.filter((r) => r.status === 'in_chair') },
    { title: 'Waiting for me', rows: mine.filter((r) => r.status === 'checked_in') },
    { title: 'Walk-ins anyone can take', rows: list.filter((r) => r.barber_id === null && r.status === 'checked_in') },
    { title: 'Coming up', rows: mine.filter((r) => r.status === 'booked') },
    { title: 'Done today', rows: mine.filter((r) => r.status === 'done') },
  ]
  const done = mine.filter((r) => r.status === 'done').length
  const left = mine.filter((r) => ['booked', 'checked_in', 'in_chair'].includes(r.status)).length

  function actions(row: QueueItem): ReactNode {
    const busy = busyId === row.id
    switch (row.status) {
      case 'booked':
        return (
          <Button variant="secondary" className="h-11" loading={busy} onClick={() => act(row, () => api.checkIn(row.id), `${row.customer_name} is checked in.`)}>
            Check in
          </Button>
        )
      case 'checked_in':
        return (
          <Button variant="secondary" className="h-11" loading={busy} onClick={() => act(row, () => api.startService(row.id, null), `${row.customer_name} is in your chair.`)}>
            {row.barber_id ? 'Start' : 'Take'}
          </Button>
        )
      case 'in_chair':
        return (
          <Button variant="secondary" className="h-11" onClick={() => setCollect(row)}>
            Finish · {peso(row.price_centavos)}
          </Button>
        )
      default:
        return null
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[30px] leading-tight sm:text-[34px]">My chair</h1>
      <p className="text-[15px] text-ink-3">
        {dayLabel}
        {queue.data && (
          <>
            {' · '}
            <span className="num">{done}</span> done, <span className="num">{left}</span> to go
          </>
        )}
      </p>

      <div className="mt-6 space-y-6">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        {queue.error && <Notice tone="bad">{queue.error}</Notice>}
        {queue.loading && !queue.data && <Skeleton className="h-64" />}
        {queue.data && list.length === 0 && (
          <p className="rounded-[14px] border border-line bg-card p-6 text-center text-[15px] text-ink-2">
            No one in your chair today yet. Confirmed bookings and walk-ins the desk adds show up here.
          </p>
        )}

        {groups.map(
          (group) =>
            group.rows.length > 0 && (
              <section key={group.title} aria-label={group.title}>
                <h2 className="label mb-2">
                  {group.title} <span className="num">({group.rows.length})</span>
                </h2>
                <ul className="space-y-2">
                  {group.rows.map((row) => (
                    <Row
                      key={row.id}
                      row={row}
                      // the customer's photos or videos, until the cut is done (shows nothing when there are none)
                      below={row.source !== 'walk_in' && row.status !== 'done' ? <BookingInspo bookingId={row.id} editable={false} title="Inspo from the customer" /> : null}
                    >
                      {actions(row)}
                    </Row>
                  ))}
                </ul>
              </section>
            ),
        )}
      </div>

      {collect && (
        <SaleDialog
          row={collect}
          onClose={() => setCollect(null)}
          onDone={(text) => {
            setCollect(null)
            setMessage({ tone: 'good', text })
            reload()
          }}
        />
      )}
    </div>
  )
}
