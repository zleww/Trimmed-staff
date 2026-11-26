import { useEffect, useState } from 'react'
import { Alert, Ban, Calendar, CheckCircle, Clock, Scissors, User } from '../components/icons'
import { AlertsButton } from '../components/AlertsButton'
import { refreshAlerts } from '../lib/alerts'
import { BookingInspo } from '../components/Inspo'
import { Button, Dialog, Field, Glass, Notice, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDayLong, formatTime, manilaDateOf, relativeDay } from '../lib/dates'
import { errorMessage, peso, prettyMobile } from '../lib/format'
import type { BookingRequest } from '../lib/types'
import { useLoad } from '../lib/useLoad'

// Quick reasons the desk can tap instead of typing. The customer sees the reason.
const REASONS = ['That time is no longer available.', 'The barber is not available then.', 'The shop is closed that day.']
// when the desk keeps a booking the customer asked to cancel
const KEEP_REASONS = ['Please call us so we can talk it over.', 'It is too close to your time to cancel online.']

/**
 * The owner and front desk see customers' booking requests and confirm or
 * decline them. ShopLayout checks the role; the database checks again on every action.
 */
export function RequestsPage() {
  const { profile } = useAuth()
  const timeFormat = profile?.time_format ?? '12h'
  const requests = useLoad(() => api.bookingRequests(), [])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [declining, setDeclining] = useState<BookingRequest | null>(null)
  // a cancel ask the desk is answering with "keep it"
  const keepingAsk = declining?.kind === 'cancel'
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  // new requests come in while the desk works: check again every minute
  const { reload } = requests
  useEffect(() => {
    const timer = setInterval(reload, 30_000)
    return () => clearInterval(timer)
  }, [reload])

  async function confirm(request: BookingRequest) {
    setBusyId(request.id)
    setMessage(null)
    try {
      const at = `${relativeDay(manilaDateOf(request.starts_at))} at ${formatTime(request.starts_at, timeFormat)}`
      if (request.kind === 'cancel') {
        await api.approveCancel(request.id)
        setMessage({ tone: 'good', text: `Cancelled ${request.customer}'s booking, ${at}. The seat is free again.` })
      } else {
        await api.confirmBooking(request.id)
        setMessage({
          tone: 'good',
          text: request.kind === 'move' ? `Moved ${request.customer} to ${at}. Their old time is free again.` : `Confirmed ${request.customer}, ${at}.`,
        })
      }
    } catch (reason) {
      setMessage({ tone: 'bad', text: errorMessage(reason) })
    } finally {
      setBusyId(null)
      reload()
      refreshAlerts()
    }
  }

  async function decline() {
    if (!declining) return
    setBusyId(declining.id)
    setMessage(null)
    try {
      if (declining.kind === 'cancel') {
        await api.refuseCancel(declining.id, reason)
        setMessage({ tone: 'good', text: `Kept ${declining.customer}'s booking. They'll see your reason.` })
      } else {
        await api.declineBooking(declining.id, reason)
        setMessage({
          tone: 'good',
          text: declining.kind === 'move' ? `Declined the new time. ${declining.customer}'s booking stays as it was.` : `Declined ${declining.customer}'s request. They'll see your reason.`,
        })
      }
      setDeclining(null)
      setReason('')
    } catch (error) {
      setMessage({ tone: 'bad', text: errorMessage(error) })
      setDeclining(null)
    } finally {
      setBusyId(null)
      reload()
      refreshAlerts()
    }
  }

  const list = requests.data ?? []

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-[12px] font-semibold tracking-[0.2em] text-accent-ink uppercase">Shop</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[34px] leading-tight tracking-tight sm:text-[40px]">Booking requests</h1>
        <div className="flex flex-wrap items-center gap-2">
          <AlertsButton />
          <Button variant="ghost" onClick={reload} loading={requests.loading && Boolean(requests.data)}>
            Refresh
          </Button>
        </div>
      </div>
      <p className="mt-2 text-[15px] text-ink-2">
        {list.length === 0 ? 'Nothing waiting.' : `${list.length} waiting, soonest first.`} Each time stays held until you answer.
      </p>

      <div className="mt-6 space-y-3">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        {requests.error && <Notice tone="bad">{requests.error}</Notice>}
        {requests.loading && !requests.data && <Skeleton className="h-48" />}
        {requests.data && list.length === 0 && (
          <Glass className="p-6 text-center text-[15px] text-ink-2">No requests right now. New ones show up here by themselves.</Glass>
        )}

        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id}>
              <Glass className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="num text-[20px] font-semibold tracking-tight">
                      {relativeDay(manilaDateOf(r.starts_at))}, {formatTime(r.starts_at, timeFormat)}
                    </p>
                    <p className="text-[14px] text-ink-2">{formatDayLong(manilaDateOf(r.starts_at))}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium ${
                      r.kind === 'cancel' ? 'bg-bad-bg text-bad' : 'bg-warn-bg text-warn'
                    }`}
                  >
                    {r.kind === 'cancel' ? <Ban size={14} /> : <Clock size={14} />}
                    {r.kind === 'cancel' ? 'Wants to cancel' : r.kind === 'move' ? 'New time asked' : 'New booking'}
                  </span>
                </div>
                {r.kind === 'move' && r.replaces_starts_at && (
                  <p className="mt-3 rounded-2xl bg-raised px-4 py-2.5 text-[14px] text-ink-2">
                    Moving from{' '}
                    <span className="num font-medium text-ink">
                      {relativeDay(manilaDateOf(r.replaces_starts_at))}, {formatTime(r.replaces_starts_at, timeFormat)}
                    </span>
                    . That booking stays until you confirm.
                  </p>
                )}
                {r.kind === 'cancel' && (
                  <p className="mt-3 rounded-2xl bg-raised px-4 py-2.5 text-[14px] text-ink-2">
                    A confirmed booking. Cancel frees the seat; keep it to say no (they'll see your reason).
                  </p>
                )}

                <dl className="mt-4 grid grid-cols-1 gap-3 text-[15px] sm:grid-cols-2">
                  <Line Icon={User} label="Customer">
                    {r.customer}
                    {r.username && <span className="text-ink-3"> @{r.username}</span>}
                    <a href={`tel:${r.mobile}`} className="num block text-[14px] text-ink-2 underline underline-offset-4 hover:text-ink">
                      {prettyMobile(r.mobile)}
                    </a>
                  </Line>
                  <Line Icon={Scissors} label="Service">
                    {r.service} · <span className="num">{peso(r.price_centavos)}</span>
                    <span className="block text-[14px] text-ink-2">
                      with {r.barber ?? 'any barber'} at {r.branch}
                    </span>
                  </Line>
                  <Line Icon={Calendar} label="History">
                    <span className="num">
                      {r.visits} visit{r.visits === 1 ? '' : 's'}
                    </span>
                    {r.no_shows > 0 ? (
                      <span className="mt-0.5 flex items-center gap-1 text-[14px] text-warn">
                        <Alert size={14} />
                        {r.no_shows} missed booking{r.no_shows === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="block text-[14px] text-ink-2">No missed bookings</span>
                    )}
                  </Line>
                </dl>

                {r.inspo > 0 && <BookingInspo bookingId={r.id} editable={false} />}

                <div className="mt-5 flex flex-col-reverse gap-2 border-t border-glass-line pt-4 sm:flex-row sm:justify-end">
                  <Button
                    variant="ghost"
                    className="text-bad hover:bg-bad-bg hover:text-bad"
                    disabled={busyId !== null}
                    onClick={() => {
                      setReason('')
                      setDeclining(r)
                    }}
                  >
                    <Ban size={18} />
                    {r.kind === 'cancel' ? 'Keep booking' : 'Decline'}
                  </Button>
                  <Button loading={busyId === r.id && !declining} disabled={busyId !== null} onClick={() => confirm(r)}>
                    <CheckCircle size={18} />
                    {r.kind === 'cancel' ? 'Cancel it' : r.kind === 'move' ? 'Confirm new time' : 'Confirm'}
                  </Button>
                </div>
              </Glass>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={declining !== null} title={keepingAsk ? 'Keep this booking?' : 'Decline this request?'} onClose={() => setDeclining(null)}>
        <p className="text-[15px] text-ink-2">The customer sees this reason in their bookings. Keep it short and polite.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(keepingAsk ? KEEP_REASONS : REASONS).map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => setReason(text)}
              className={`min-h-11 rounded-full border px-4 text-left text-[14px] transition ${
                reason === text ? 'border-transparent bg-ink text-bg' : 'border-glass-line text-ink-2 hover:text-ink'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
        <Field label="Reason" className="mt-4" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setDeclining(null)}>
            Keep it
          </Button>
          <Button variant="danger" disabled={reason.trim().length < 3} loading={busyId !== null} onClick={decline}>
            {keepingAsk ? 'Keep booking' : 'Decline request'}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function Line({ Icon, label, children }: { Icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-raised text-ink-2">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <dt className="text-[13px] text-ink-3">{label}</dt>
        <dd className="mt-0.5 font-medium break-words">{children}</dd>
      </div>
    </div>
  )
}
