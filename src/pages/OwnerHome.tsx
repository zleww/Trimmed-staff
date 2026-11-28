import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, Box, ChevronLeft, ChevronRight, Download, List, Plus } from '../components/icons'
import { Button, Dialog, Field, Notice, Segmented, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { downloadCsv, manilaStamp, pesos, toCsv } from '../lib/csv'
import { addDays, formatTime, manilaToday, weekdayOf, WEEKDAYS } from '../lib/dates'
import { errorMessage, peso } from '../lib/format'
import type { CalendarDay } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { SellDialog } from './InventoryPage'

const hourText = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`

/**
 * The most important card: how today is going. Today's sales big, then the
 * appointment numbers small, then what's happening right now.
 */
export function TodayHero({ revenue, sales }: { revenue: number | null; sales: number | null }) {
  const overview = useLoad(() => api.ownerOverview(), [])
  const o = overview.data
  if (overview.error) return <Notice tone="bad">{overview.error}</Notice>
  if (!o) return <Skeleton className="h-44" />

  const diff = o.today.appointments - o.today.last_week
  const weekday = WEEKDAYS[weekdayOf(manilaToday())]
  return (
    <section aria-labelledby="today-title" className="relative overflow-hidden rounded-[18px] border border-line bg-card p-5 sm:p-6">
      {/* a soft amber light so this card reads first */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 -left-16 h-56 w-80 bg-[radial-gradient(closest-side,var(--glow-warm),transparent)]" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-center">
        <div>
          <h2 id="today-title" className="label">
            Today
          </h2>
          <p className="num mt-2 text-[40px] leading-none font-medium sm:text-[48px]">{revenue === null ? '—' : peso(Math.round(revenue / 100) * 100)}</p>
          <p className="mt-2 text-[14px] text-ink-3">
            {sales === null ? 'Sales today' : `${sales} ${sales === 1 ? 'sale' : 'sales'} so far`}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 lg:border-l lg:border-line lg:pl-6">
          <Mini
            label="Appointments"
            value={o.today.appointments}
            note={
              <span className={diff > 0 ? 'text-good' : diff < 0 ? 'text-bad' : ''}>
                {diff === 0 ? 'Same as' : `${diff > 0 ? '+' : ''}${diff} vs`} last {weekday}
              </span>
            }
          />
          <Mini label="Walk-ins" value={o.today.walk_ins} note={`${o.today.waiting} waiting now`} />
          <Mini label="Completed" value={o.today.completed} note={`${o.today.in_chair} in the chair`} />
          <Mini label="No-shows" value={o.today.no_shows} note={o.today.no_shows ? 'See the Today list' : 'None so far'} />
        </dl>
      </div>
    </section>
  )
}

function Mini({ label, value, note }: { label: string; value: number; note: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="num text-[26px] leading-tight font-medium">{value}</dd>
      <dd className="truncate text-[12px] text-ink-3">{note}</dd>
    </div>
  )
}

/**
 * The owner's shortcuts, next to the page title. Record sale is the one main
 * button; the rest are smaller so they don't compete with the numbers.
 */
export function QuickActions() {
  const navigate = useNavigate()
  const [open, setOpen] = useState<'sell' | 'csv' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const products = useLoad(() => (open === 'sell' ? api.inventory() : Promise.resolve([])), [open])

  const more: { label: string; Icon: typeof Plus; run: () => void }[] = [
    { label: 'Sell product', Icon: List, run: () => setOpen('sell') },
    { label: 'Update stock', Icon: Box, run: () => navigate('/inventory') },
    { label: 'Download CSV', Icon: Download, run: () => setOpen('csv') },
  ]

  return (
    <div className="w-full sm:w-auto">
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-end">
        <Button className="col-span-3 h-12 px-5" onClick={() => navigate('/today')}>
          <Plus size={18} />
          Record sale
        </Button>
        {more.map(({ label, Icon, run }) => (
          // phones: icon above the word, so "Sell product" stays on one line
          <Button key={label} variant="secondary" className="h-16 flex-col gap-1 px-2 text-[13px] whitespace-nowrap sm:h-12 sm:flex-row sm:gap-2 sm:px-4 sm:text-[14px]" onClick={run}>
            <Icon size={16} />
            {label}
          </Button>
        ))}
      </div>
      {message && (
        <div className="mt-3">
          <Notice tone="good">{message}</Notice>
        </div>
      )}
      {open === 'sell' && products.data && (
        <SellDialog
          items={products.data.filter((p) => p.active && p.stock_qty > 0)}
          onClose={() => setOpen(null)}
          onDone={(text) => {
            setOpen(null)
            setMessage(text)
          }}
        />
      )}
      {open === 'csv' && <CsvDialog onClose={() => setOpen(null)} />}
    </div>
  )
}

type CsvKind = 'sales' | 'appointments' | 'products'

function CsvDialog({ onClose }: { onClose: () => void }) {
  const today = manilaToday()
  const [kind, setKind] = useState<CsvKind>('sales')
  const [from, setFrom] = useState(today.slice(0, 8) + '01')
  const [to, setTo] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      if (kind === 'sales') {
        const rows = await api.exportSales(from, to)
        downloadCsv(
          `trimmed-sales-${from}-to-${to}.csv`,
          toCsv(rows, [
            { header: 'Sold at', value: (r) => manilaStamp(r.sold_at) },
            { header: 'Items', value: (r) => r.items },
            { header: 'Barbers', value: (r) => r.barbers },
            { header: 'Paid with', value: (r) => r.paid_with },
            { header: 'Subtotal (PHP)', value: (r) => pesos(r.subtotal_centavos) },
            { header: 'Discount (PHP)', value: (r) => pesos(r.discount_centavos) },
            { header: 'Total (PHP)', value: (r) => pesos(r.total_centavos) },
            { header: 'Tips (PHP)', value: (r) => pesos(r.tips_centavos) },
            { header: 'Voided', value: (r) => (r.voided ? 'yes' : 'no') },
            { header: 'Recorded by', value: (r) => r.recorded_by },
          ]),
        )
      } else if (kind === 'appointments') {
        const rows = await api.exportAppointments(from, to)
        downloadCsv(
          `trimmed-appointments-${from}-to-${to}.csv`,
          toCsv(rows, [
            { header: 'Date and time', value: (r) => manilaStamp(r.starts_at) },
            { header: 'Code', value: (r) => r.code },
            { header: 'Customer', value: (r) => r.customer },
            { header: 'Mobile', value: (r) => r.mobile },
            { header: 'Service', value: (r) => r.service },
            { header: 'Barber', value: (r) => r.barber },
            { header: 'Branch', value: (r) => r.branch },
            { header: 'Source', value: (r) => r.source },
            { header: 'Status', value: (r) => r.status },
            { header: 'Price (PHP)', value: (r) => pesos(r.price_centavos) },
          ]),
        )
      } else {
        const rows = await api.inventory()
        downloadCsv(
          `trimmed-products-${today}.csv`,
          toCsv(rows, [
            { header: 'Product', value: (r) => r.name },
            { header: 'Category', value: (r) => r.category },
            { header: 'Size', value: (r) => r.size },
            { header: 'Price (PHP)', value: (r) => pesos(r.price_centavos) },
            { header: 'In stock', value: (r) => r.stock_qty },
            { header: 'Low stock alert at', value: (r) => r.low_stock_at },
            { header: 'For sale', value: (r) => (r.active ? 'yes' : 'no') },
          ]),
        )
      }
      onClose()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open title="Download CSV" onClose={onClose}>
      <div className="space-y-4">
        {error && <Notice tone="bad">{error}</Notice>}
        <Segmented
          label="What to download"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'sales', label: 'Sales' },
            { value: 'appointments', label: 'Appointments' },
            { value: 'products', label: 'Products' },
          ]}
        />
        {kind !== 'products' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            <Field label="To" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
        {kind === 'appointments' && (
          <p className="text-[13px] leading-relaxed text-ink-3">
            This file has customers' names and mobile numbers. Keep it on the shop's computer and delete it when you're done (Data Privacy Act).
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" className="h-12 flex-1" onClick={onClose}>
            Back
          </Button>
          <Button className="h-12 flex-1" loading={busy} onClick={() => void download()}>
            Download
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

/** A few plain-language facts from the last weeks. */
export function Insights() {
  const overview = useLoad(() => api.ownerOverview(), [])
  const i = overview.data?.insights
  const items: { label: string; value: string; note?: string; to?: string }[] = i
    ? [
        { label: 'Busiest time', value: i.busiest_hour === null ? 'Not enough data yet' : `${i.busiest_weekday === null ? '' : `${WEEKDAYS[i.busiest_weekday]}s, `}around ${hourText(i.busiest_hour)}`, note: 'Last 30 days' },
        { label: 'Top barber this week', value: i.top_barber_week ? `${i.top_barber_week.name} · ${i.top_barber_week.cuts} cuts` : 'No cuts yet this week' },
        { label: 'Average sale', value: i.average_sale_centavos === null ? '—' : peso(i.average_sale_centavos), note: 'Last 30 days' },
        { label: 'Customers coming back', value: i.returning_rate === null ? '—' : `${i.returning_rate}%`, note: 'This month, had been here before' },
        { label: 'No-show rate', value: i.no_show_rate === null ? '—' : `${i.no_show_rate}%`, note: 'Last 30 days' },
        {
          label: 'Stock to order',
          value: i.low_stock + i.out_of_stock === 0 ? 'All good' : `${i.out_of_stock} out, ${i.low_stock} low`,
          to: i.low_stock + i.out_of_stock ? '/inventory' : undefined,
        },
      ]
    : []
  const navigate = useNavigate()

  return (
    <section aria-labelledby="insights-title" className="min-w-0 rounded-[14px] border border-line bg-card p-5">
      <h2 id="insights-title" className="text-[20px]">
        Quick insights
      </h2>
      {overview.error && <Notice tone="bad">{overview.error}</Notice>}
      {!i && !overview.error && <Skeleton className="mt-4 h-64" />}
      <ul className="mt-3 divide-y divide-[var(--line)]">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3 py-3">
            <span className="min-w-0">
              <span className="block text-[13px] text-ink-3">{item.label}</span>
              <span className="block text-[15px] font-medium">{item.value}</span>
              {item.note && <span className="block text-[12px] text-ink-3">{item.note}</span>}
            </span>
            {item.to && (
              <button type="button" onClick={() => navigate(item.to!)} aria-label={`Open ${item.label}`} className="grid size-10 shrink-0 place-items-center rounded-full text-gold hover:bg-raised">
                <ArrowRight size={18} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

const monthFmt = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const dayFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })

/** A month of appointments: how busy each day is, and who is booked on the day you tap. */
export function AppointmentCalendar() {
  const today = manilaToday()
  const [month, setMonth] = useState(today.slice(0, 8) + '01')
  const [picked, setPicked] = useState(today)
  const days = useLoad(() => api.appointmentCalendar(month), [month])
  const list = useLoad(() => api.queueForDay(picked), [picked])

  // move a whole month: the 1st of the month before or after
  const shift = (step: number) => {
    const d = new Date(`${month}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + step)
    setMonth(d.toISOString().slice(0, 10))
  }

  // Monday first; empty cells before the 1st
  const lead = (weekdayOf(month) + 6) % 7
  const cells: (CalendarDay | null)[] = [...Array<null>(lead).fill(null), ...(days.data ?? [])]
  const busiest = Math.max(1, ...(days.data ?? []).map((d) => d.total))
  const shown = (list.data ?? []).filter((r) => r.status !== 'cancelled' && r.status !== 'declined')

  return (
    <section aria-labelledby="calendar-title" className="min-w-0 rounded-[14px] border border-line bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="calendar-title" className="text-[20px]">
          Appointments
        </h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-raised hover:text-ink">
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[8rem] text-center text-[15px] font-medium">{monthFmt.format(new Date(`${month}T00:00:00Z`))}</span>
          <button type="button" onClick={() => shift(1)} aria-label="Next month" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-raised hover:text-ink">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {days.error && <Notice tone="bad">{days.error}</Notice>}
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[12px] text-ink-3">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, index) =>
          cell ? (
            <button
              key={cell.day}
              type="button"
              onClick={() => setPicked(cell.day)}
              aria-pressed={cell.day === picked}
              aria-label={`${dayFmt.format(new Date(`${cell.day}T00:00:00Z`))}: ${cell.total} appointments`}
              className={`relative flex h-12 flex-col items-center justify-center rounded-[10px] text-[14px] transition sm:h-14 ${
                cell.day === picked ? 'bg-ink text-bg' : 'hover:bg-raised'
              } ${cell.day === today && cell.day !== picked ? 'ring-1 ring-gold' : ''}`}
            >
              <span className="num">{Number(cell.day.slice(8))}</span>
              {cell.total > 0 && (
                // the bar gets longer on busier days
                <span
                  aria-hidden="true"
                  className={`mt-1 h-1 rounded-full ${cell.day === picked ? 'bg-bg/70' : 'bg-gold'}`}
                  style={{ width: `${20 + (cell.total / busiest) * 60}%` }}
                />
              )}
              {cell.requests > 0 && <span aria-hidden="true" className="absolute top-1 right-1 size-1.5 rounded-full bg-warn" />}
            </button>
          ) : (
            <span key={`blank-${index}`} />
          ),
        )}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-5 rounded-full bg-gold" /> Longer bar = busier day
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-warn" /> Has waiting requests
        </span>
      </p>

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="text-[15px] font-medium">
          {picked === today ? 'Today' : picked === addDays(today, 1) ? 'Tomorrow' : dayFmt.format(new Date(`${picked}T00:00:00Z`))}
          {list.data && <span className="num text-ink-3"> · {shown.length}</span>}
        </h3>
        {list.loading && !list.data && <Skeleton className="mt-3 h-24" />}
        {list.data && shown.length === 0 && <p className="mt-2 text-[14px] text-ink-3">No appointments.</p>}
        <ul className="mt-2 divide-y divide-[var(--line)]">
          {shown.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5 text-[14px]">
              <span className="num w-[4.5rem] shrink-0 font-medium">{r.starts_at ? formatTime(r.starts_at) : 'Walk-in'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{r.customer_name}</span>
                <span className="block truncate text-[12px] text-ink-3">
                  {r.service_name} · {r.barber_name ?? 'Any barber'}
                </span>
              </span>
              <span className="shrink-0 text-[12px] text-ink-3">{STATUS[r.status] ?? r.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const STATUS: Record<string, string> = {
  requested: 'Waiting for answer',
  booked: 'Booked',
  checked_in: 'Arrived',
  in_chair: 'In the chair',
  done: 'Done',
  no_show: 'No-show',
}
