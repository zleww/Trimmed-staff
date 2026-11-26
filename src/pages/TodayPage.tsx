import { useEffect, useState, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Alert, Ban, Calendar, CheckCircle, Clock, Plus, Scissors } from '../components/icons'
import { Button, Dialog, Field, Notice, Segmented, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { formatTime, manilaToday } from '../lib/dates'
import { errorMessage, peso } from '../lib/format'
import { parsePeso } from '../lib/money'
import type { Barber, PayMethod, Product, QueueItem, QueueStatus, Service } from '../lib/types'
import { useLoad } from '../lib/useLoad'

const dayFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })

// what the desk calls each status: always icon + text + color
const look: Partial<Record<QueueStatus, { label: string; className: string; Icon: typeof Clock }>> = {
  booked: { label: 'Booked', className: 'text-ink-2 bg-raised', Icon: Calendar },
  checked_in: { label: 'Waiting', className: 'text-warn bg-warn-bg', Icon: Clock },
  in_chair: { label: 'In the chair', className: 'text-good bg-good-bg', Icon: Scissors },
  done: { label: 'Paid', className: 'text-ink-2 bg-raised', Icon: CheckCircle },
  cancelled: { label: 'Cancelled', className: 'text-ink-3 bg-raised', Icon: Ban },
  no_show: { label: 'No-show', className: 'text-bad bg-bad-bg', Icon: Alert },
}

type Open =
  | { kind: 'walk-in' }
  | { kind: 'start'; row: QueueItem }
  | { kind: 'cancel'; row: QueueItem }
  | { kind: 'sale'; row: QueueItem }
  | null

/** The front desk's day: who's coming, who's waiting, who's in the chair. */
export function TodayPage() {
  const today = manilaToday()
  const queue = useLoad(() => api.queueForDay(today), [today])
  const menu = useLoad(() => Promise.all([api.listServices(), api.listBarbers()]), [])
  const [open, setOpen] = useState<Open>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  // the clock, for "is this booking late?"; moves on with each refresh
  const [now, setNow] = useState(() => Date.now())
  const [dayLabel] = useState(() => dayFmt.format(new Date()))

  // bookings and walk-ins change all day: check again every minute
  const { reload } = queue
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
      reload()
    }, 60_000)
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

  function finished(text: string) {
    setOpen(null)
    setMessage({ tone: 'good', text })
    reload()
  }

  const list = queue.data ?? []
  const groups: { title: string; rows: QueueItem[] }[] = [
    { title: 'In the chair', rows: list.filter((r) => r.status === 'in_chair') },
    { title: 'Waiting', rows: list.filter((r) => r.status === 'checked_in') },
    { title: 'Coming up', rows: list.filter((r) => r.status === 'booked') },
    { title: 'Paid', rows: list.filter((r) => r.status === 'done') },
  ]
  const gone = list.filter((r) => r.status === 'cancelled' || r.status === 'no_show')
  const [services, barbers] = menu.data ?? [[], []]

  function actions(row: QueueItem): ReactNode {
    const busy = busyId === row.id
    const late = row.starts_at !== null && new Date(row.starts_at).getTime() < now
    switch (row.status) {
      case 'booked':
        return (
          <>
            <Button variant="secondary" className="h-11" loading={busy} onClick={() => act(row, () => api.checkIn(row.id), `${row.customer_name} is checked in.`)}>
              Check in
            </Button>
            {late && (
              <Button variant="ghost" className="h-11" disabled={busy} onClick={() => act(row, () => api.markNoShow(row.id), `${row.customer_name} marked as a no-show.`)}>
                No-show
              </Button>
            )}
            <Button variant="ghost" className="h-11" disabled={busy} onClick={() => setOpen({ kind: 'cancel', row })}>
              Cancel
            </Button>
          </>
        )
      case 'checked_in':
        return (
          <>
            <Button
              variant="secondary"
              className="h-11"
              loading={busy}
              onClick={() =>
                row.barber_id
                  ? act(row, () => api.startService(row.id, null), `${row.customer_name} is in ${row.barber_name}'s chair.`)
                  : setOpen({ kind: 'start', row })
              }
            >
              Start
            </Button>
            <Button variant="ghost" className="h-11" disabled={busy} onClick={() => setOpen({ kind: 'cancel', row })}>
              Cancel
            </Button>
          </>
        )
      case 'in_chair':
        return (
          <Button variant="secondary" className="h-11" onClick={() => setOpen({ kind: 'sale', row })}>
            Collect {peso(row.price_centavos)}
          </Button>
        )
      default:
        return null
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] leading-tight sm:text-[34px]">Today</h1>
          <p className="text-[15px] text-ink-3">{dayLabel}</p>
        </div>
        <Button className="h-12 px-5" onClick={() => setOpen({ kind: 'walk-in' })} disabled={!menu.data}>
          <Plus size={18} />
          Add walk-in
        </Button>
      </div>

      <div className="mt-6 space-y-6">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        {queue.error && <Notice tone="bad">{queue.error}</Notice>}
        {queue.loading && !queue.data && <Skeleton className="h-64" />}
        {queue.data && list.length === 0 && (
          <p className="rounded-[14px] border border-line bg-card p-6 text-center text-[15px] text-ink-2">
            No one yet today. Walk-ins you add and confirmed bookings show up here.
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
                    <Row key={row.id} row={row}>
                      {actions(row)}
                    </Row>
                  ))}
                </ul>
              </section>
            ),
        )}

        {gone.length > 0 && (
          <details className="rounded-[14px] border border-line bg-card px-4 py-3">
            <summary className="cursor-pointer text-[14px] text-ink-2">Cancelled and no-shows ({gone.length})</summary>
            <ul className="mt-3 space-y-2">
              {gone.map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </ul>
          </details>
        )}
      </div>

      {open?.kind === 'walk-in' && (
        <WalkInDialog services={services} barbers={barbers} onClose={() => setOpen(null)} onDone={(name) => finished(`${name} is waiting.`)} />
      )}
      {open?.kind === 'start' && (
        <StartDialog row={open.row} barbers={barbers} onClose={() => setOpen(null)} onDone={(barber) => finished(`${open.row.customer_name} is in ${barber}'s chair.`)} />
      )}
      {open?.kind === 'cancel' && (
        <CancelDialog row={open.row} onClose={() => setOpen(null)} onDone={() => finished(`Cancelled ${open.row.customer_name}.`)} />
      )}
      {open?.kind === 'sale' && <SaleDialog row={open.row} onClose={() => setOpen(null)} onDone={(text) => finished(text)} />}
    </div>
  )
}

function Row({ row, children }: { row: QueueItem; children?: ReactNode }) {
  const status = look[row.status]
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[14px] border border-line bg-card px-4 py-3">
      <span className="num w-[4.5rem] shrink-0 text-[15px] font-medium whitespace-nowrap">{row.starts_at ? formatTime(row.starts_at) : 'Walk-in'}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px]">{row.customer_name}</span>
        <span className="block truncate text-[13px] text-ink-3">
          {row.service_name} · {row.barber_name ?? 'Any barber'}
        </span>
      </span>
      {/* on phones the status and buttons share the second line, so the name gets the full width */}
      <span className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        {status && (
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium max-sm:mr-auto ${status.className}`}>
            <status.Icon size={14} />
            {status.label}
          </span>
        )}
        {children}
      </span>
    </li>
  )
}

function Select({ label, children, ...rest }: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-medium">{label}</span>
      <select className="h-12 w-full rounded-[10px] border border-line bg-card px-3 text-[16px] text-ink" {...rest}>
        {children}
      </select>
    </label>
  )
}

function useSubmit(onError: (text: string) => void) {
  const [busy, setBusy] = useState(false)
  async function run(task: () => Promise<void>) {
    setBusy(true)
    try {
      await task()
    } catch (reason) {
      onError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}

function WalkInDialog({ services, barbers, onClose, onDone }: { services: Service[]; barbers: Barber[]; onClose: () => void; onDone: (name: string) => void }) {
  const [name, setName] = useState('')
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [barberId, setBarberId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { busy, run } = useSubmit(setError)

  return (
    <Dialog open title="Add walk-in" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          void run(async () => {
            await api.addWalkIn(name.trim(), serviceId, barberId || null)
            onDone(name.trim())
          })
        }}
      >
        {error && <Notice tone="bad">{error}</Notice>}
        <Field label="Customer name" placeholder="Juan Dela Cruz" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} required />
        <Select label="Service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {peso(s.price_centavos)}
            </option>
          ))}
        </Select>
        <Select label="Barber" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
          <option value="">Next free barber</option>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.display_name}
            </option>
          ))}
        </Select>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" className="h-12 flex-1" onClick={onClose}>
            Back
          </Button>
          <Button type="submit" className="h-12 flex-1" loading={busy}>
            Add to queue
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function StartDialog({ row, barbers, onClose, onDone }: { row: QueueItem; barbers: Barber[]; onClose: () => void; onDone: (barber: string) => void }) {
  const [barberId, setBarberId] = useState(barbers[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const { busy, run } = useSubmit(setError)

  return (
    <Dialog open title={`Who takes ${row.customer_name}?`} onClose={onClose}>
      <div className="space-y-4">
        {error && <Notice tone="bad">{error}</Notice>}
        <Select label="Barber" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.display_name}
            </option>
          ))}
        </Select>
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" className="h-12 flex-1" onClick={onClose}>
            Back
          </Button>
          <Button
            className="h-12 flex-1"
            loading={busy}
            onClick={() =>
              run(async () => {
                await api.startService(row.id, barberId)
                onDone(barbers.find((b) => b.id === barberId)?.display_name ?? 'the')
              })
            }
          >
            Start
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function CancelDialog({ row, onClose, onDone }: { row: QueueItem; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { busy, run } = useSubmit(setError)

  return (
    <Dialog open title={`Cancel ${row.customer_name}?`} onClose={onClose}>
      <div className="space-y-4">
        {error && <Notice tone="bad">{error}</Notice>}
        <Field label="Reason" placeholder="Customer called to cancel" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" className="h-12 flex-1" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant="danger"
            className="h-12 flex-1"
            loading={busy}
            onClick={() =>
              run(async () => {
                await api.cancelAppointment(row.id, reason.trim())
                onDone()
              })
            }
          >
            Cancel booking
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// The bill: the haircut, any pomade, an optional tip, and how they paid.
// We only send what was sold; the database looks up every price again.
function SaleDialog({ row, onClose, onDone }: { row: QueueItem; onClose: () => void; onDone: (text: string) => void }) {
  const products = useLoad(() => api.listProducts(), [])
  const [extra, setExtra] = useState<{ product: Product; qty: number }[]>([])
  const [pick, setPick] = useState('')
  const [tipText, setTipText] = useState('')
  const [method, setMethod] = useState<PayMethod>('cash')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { busy, run } = useSubmit(setError)

  const tip = parsePeso(tipText)
  const total = row.price_centavos + extra.reduce((sum, e) => sum + e.product.price_centavos * e.qty, 0)
  const due = total + (tip ?? 0)

  function addProduct() {
    const product = products.data?.find((p) => p.id === pick)
    if (!product) return
    setExtra((list) => {
      const found = list.find((e) => e.product.id === product.id)
      return found ? list.map((e) => (e === found ? { ...e, qty: e.qty + 1 } : e)) : [...list, { product, qty: 1 }]
    })
    setPick('')
  }

  return (
    <Dialog open title={`Collect from ${row.customer_name}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          if (tip === null) return setError('Type the tip as a number, like 50')
          if (!row.barber_id) return setError('Start the service first so we know the barber')
          void run(async () => {
            const sale = await api.recordSale({
              appointmentId: row.id,
              items: [{ service_id: row.service_id, barber_id: row.barber_id! }, ...extra.map((e) => ({ product_id: e.product.id, qty: e.qty }))],
              payments: [{ method, amount_centavos: due, ...(method === 'cash' ? {} : { reference }) }],
              tips: tip > 0 ? [{ barber_id: row.barber_id!, amount_centavos: tip }] : [],
            })
            onDone(`Collected ${peso(sale.total_centavos + sale.tips_centavos)} from ${row.customer_name}.`)
          })
        }}
      >
        {error && <Notice tone="bad">{error}</Notice>}

        <ul className="divide-y divide-[var(--line)] rounded-[10px] border border-line">
          <li className="flex justify-between gap-3 px-3 py-2.5 text-[15px]">
            <span className="min-w-0 truncate">
              {row.service_name} <span className="text-ink-3">· {row.barber_name}</span>
            </span>
            <span className="num">{peso(row.price_centavos)}</span>
          </li>
          {extra.map((e) => (
            <li key={e.product.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[15px]">
              <span className="min-w-0 truncate">
                {e.product.name} <span className="num text-ink-3">× {e.qty}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="num">{peso(e.product.price_centavos * e.qty)}</span>
                <button type="button" className="min-h-11 px-2 text-[13px] text-ink-3 hover:text-ink" onClick={() => setExtra((list) => list.filter((x) => x !== e))}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>

        {products.data && products.data.length > 0 && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select label="Add a product" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Pick one</option>
                {products.data.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.stock_qty === 0}>
                    {p.name} · {peso(p.price_centavos)} ({p.stock_qty} left)
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" variant="secondary" className="h-12" disabled={!pick} onClick={addProduct}>
              Add
            </Button>
          </div>
        )}

        <Field label={`Tip for ${row.barber_name ?? 'the barber'} (optional)`} inputMode="decimal" placeholder="0" value={tipText} onChange={(e) => setTipText(e.target.value)} />

        <div>
          <p className="mb-1.5 text-[14px] font-medium">Paid with</p>
          <Segmented
            label="Paid with"
            value={method}
            onChange={setMethod}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'gcash', label: 'GCash' },
              { value: 'maya', label: 'Maya' },
            ]}
          />
        </div>
        {method !== 'cash' && (
          <Field
            label="Reference number"
            hint="From the customer's receipt on their phone"
            placeholder="1234567890123"
            autoCapitalize="characters"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" className="h-12" onClick={onClose}>
            Back
          </Button>
          <Button type="submit" className="h-12 flex-1" loading={busy}>
            Collect {peso(due)}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
