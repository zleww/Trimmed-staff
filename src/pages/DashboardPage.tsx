import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Alert, ArrowRight, TrendUp } from '../components/icons'
import { Notice, Segmented, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { peso } from '../lib/format'
import type { OwnerDashboard } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { AppointmentCalendar, Insights, QuickActions, TodayHero } from './OwnerHome'

type Days = '7' | '30' | '90'
const dayFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const timeFmt = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
// whole pesos for the big numbers: centavos only add noise there
const whole = (c: number) => peso(Math.round(c / 100) * 100)
const shortPeso = (c: number) => (c >= 100_000_00 ? `₱${(c / 100_000_00).toFixed(1)}M` : c >= 1000_00 ? `₱${Math.round(c / 1000_00)}k` : peso(c))
const method = (m: string) => m.replace('gcash', 'GCash').replace('maya', 'Maya').replace('cash', 'Cash')

/** The owner's home: money, bookings and who's busy. Numbers come from owner_dashboard(). */
export function DashboardPage() {
  const [days, setDays] = useState<Days>('30')
  const dash = useLoad(() => api.ownerDashboard(Number(days) as 7 | 30 | 90), [days])
  const twoStep = useLoad(() => api.twoStepStatus(), [])
  const d = dash.data

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* 1. who and when, with the owner's actions on the right */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[14px] text-ink-3">{greeting()}</p>
          <h1 className="text-[30px] leading-tight sm:text-[34px]">Dashboard</h1>
        </div>
        <QuickActions />
      </div>

      {/* 2. only when something needs the owner */}
      {((d && d.waiting_requests > 0) || (twoStep.data && !twoStep.data.on)) && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {d && d.waiting_requests > 0 && (
            <Link to="/requests" className="flex items-center justify-between gap-3 rounded-[12px] border border-gold/40 bg-card px-4 py-3 text-[15px] hover:border-gold">
              <span>
                <span className="num font-semibold">{d.waiting_requests}</span> booking {d.waiting_requests === 1 ? 'request is' : 'requests are'} waiting
              </span>
              <ArrowRight size={18} className="shrink-0 text-gold" />
            </Link>
          )}
          {twoStep.data && !twoStep.data.on && (
            <Link to="/security" className="flex items-center justify-between gap-3 rounded-[12px] border border-warn/30 bg-warn-bg px-4 py-3 text-[14px] text-warn">
              <span className="flex items-center gap-2">
                <Alert size={18} className="shrink-0" />
                Turn on two-step sign-in to protect your sales.
              </span>
              <ArrowRight size={18} className="shrink-0" />
            </Link>
          )}
        </div>
      )}
      {dash.error && (
        <div className="mt-5">
          <Notice tone="bad">{dash.error}</Notice>
        </div>
      )}

      {/* 3. today, the biggest card */}
      <div className="mt-5">
        <TodayHero revenue={d ? d.today.revenue_centavos : null} sales={d ? d.today.sales : null} />
      </div>

      {/* 4. how the shop is doing over time */}
      <h2 className="label mt-8 mb-3">Performance</h2>
      {!d && !dash.error && <Loading />}
      {d && <Board d={d} days={days} setDays={setDays} />}

      {/* 5. planning ahead */}
      <h2 className="label mt-8 mb-3">Schedule and insights</h2>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <AppointmentCalendar />
        <Insights />
      </div>
    </div>
  )
}

// "Saturday, November 28 · Good afternoon" by the Manila clock
function greeting(): string {
  const now = new Date()
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' }).format(now))
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return `${part} · ${new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' }).format(now)}`
}

function Board({ d, days, setDays }: { d: OwnerDashboard; days: Days; setDays: (days: Days) => void }) {
  const profit = d.period.revenue_centavos - d.period.expenses_centavos
  const change = d.period.previous_centavos ? Math.round(((d.period.revenue_centavos - d.period.previous_centavos) / d.period.previous_centavos) * 100) : null

  return (
    <div className="rise grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px]">
      {/* sales chart: the big one */}
      <Card className="relative overflow-hidden max-xl:order-1 xl:col-span-2">
        {/* a soft amber light under the chart */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-24 h-56 bg-[radial-gradient(50%_60%_at_50%_100%,var(--glow-warm),transparent)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] text-ink-2">Sales</h2>
            <p className="num mt-1 text-[32px] font-medium sm:text-[40px]">{whole(d.period.revenue_centavos)}</p>
            <p className="mt-0.5 text-[14px] text-ink-3">
              {change === null ? (
                `Last ${d.days} days`
              ) : (
                <>
                  <span className={`inline-flex items-center gap-1 ${change >= 0 ? 'text-good' : 'text-bad'}`}>
                    <TrendUp size={14} className={change < 0 ? '-scale-y-100' : ''} />
                    {change >= 0 ? '+' : ''}
                    {change}%
                  </span>{' '}
                  vs the {d.days} days before
                </>
              )}
            </p>
          </div>
          <Segmented
            label="Period"
            value={days}
            onChange={setDays}
            options={[
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
            ]}
          />
        </div>
        <div className="relative">
          <RevenueChart daily={d.daily} />
        </div>
      </Card>

      {/* recent sales: tall column on the right */}
      <Card className="min-w-0 max-xl:order-4 xl:row-span-2">
        <h2 className="text-[20px]">Recent sales</h2>
        {d.recent.length === 0 ? (
          <p className="mt-4 text-[15px] text-ink-2">No sales yet. They show up here once the desk records one.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {d.recent.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-[10px] border border-line px-3.5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{s.items ?? 'Sale'}</span>
                  <span className="block truncate text-[13px] text-ink-3">
                    {s.barber ?? 'No barber'}
                    {s.paid_by && ` · ${method(s.paid_by)}`}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="num block text-[15px] font-medium">{peso(s.total_centavos)}</span>
                  <span className="num block text-[12px] text-ink-3">{timeFmt.format(new Date(s.sold_at))}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-8 text-[20px]">Top services</h2>
        {d.services.length === 0 ? (
          <p className="mt-4 text-[15px] text-ink-2">Nothing sold in this period.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {d.services.map((s, i) => (
              <li key={s.name} className="flex items-center gap-3 text-[15px]">
                <span className={`num grid size-7 shrink-0 place-items-center rounded-full text-[13px] ${i === 0 ? 'bg-ink text-bg' : 'bg-raised text-ink-2'}`}>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="num text-ink-2">{s.count}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* barbers */}
      <Card className="min-w-0 max-xl:order-3">
        <h2 className="text-[20px]">Barbers</h2>
        <p className="text-[14px] text-ink-3">Service sales, last {d.days} days</p>
        {d.barbers.length === 0 ? (
          <p className="mt-6 text-[15px] text-ink-2">No active barbers yet.</p>
        ) : (
          <ul className="mt-5 space-y-4">
            {d.barbers.map((b) => {
              const top = d.barbers[0].revenue_centavos || 1
              return (
                <li key={b.name}>
                  <div className="flex justify-between gap-3 text-[14px]">
                    <span className="truncate">{b.name}</span>
                    <span className="num shrink-0 text-ink-2">{whole(b.revenue_centavos)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-raised">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${(b.revenue_centavos / top) * 100}%` }} />
                  </div>
                  <p className="num mt-1 text-[12px] text-ink-3">{b.services} services</p>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* money left after expenses for the same period */}
      <Stat
        className="max-xl:order-2"
        label={`After expenses, last ${d.days} days`}
        value={whole(profit)}
        note={`${whole(d.period.expenses_centavos)} spent · ${d.period.sales} sales`}
      />
    </div>
  )
}

function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-[14px] border border-line bg-card p-5 sm:p-6 ${className}`}>{children}</section>
}

function Stat({ label, value, note, className = '' }: { label: string; value: string; note: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 rounded-[14px] border border-line bg-card p-4 sm:p-5 ${className}`}>
      <p className="text-[13px] text-ink-3">{label}</p>
      <p className="num mt-1.5 truncate text-[24px] font-medium sm:text-[28px]">{value}</p>
      <p className="mt-0.5 truncate text-[13px] text-ink-2">{note}</p>
    </div>
  )
}

// A smooth line with a soft fill and thin day lines underneath. Hover or tap for the number.
function RevenueChart({ daily }: { daily: OwnerDashboard['daily'] }) {
  const [hover, setHover] = useState<number | null>(null)
  // draw at the box's real width so the labels stay readable on phones
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(640)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const watch = new ResizeObserver(() => setW(Math.max(el.clientWidth, 260)))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  const H = W < 500 ? 220 : 300
  const pad = { top: 16, bottom: 30, left: 52 }
  const max = Math.max(...daily.map((d) => d.revenue_centavos), 1) * 1.15
  const x = (i: number) => pad.left + (i / Math.max(daily.length - 1, 1)) * (W - pad.left - 8)
  const y = (v: number) => pad.top + (1 - v / max) * (H - pad.top - pad.bottom)
  const pts = daily.map((d, i) => [x(i), y(d.revenue_centavos)] as const)

  // curve through the points (each bend uses its neighbours)
  const line = pts.reduce((path, [px, py], i) => {
    if (i === 0) return `M${px},${py}`
    const [x0, y0] = pts[i - 1]
    const [xm, ym] = pts[i - 2] ?? pts[i - 1]
    const [xn, yn] = pts[i + 1] ?? [px, py]
    return `${path} C${x0 + (px - xm) / 6},${y0 + (py - ym) / 6} ${px - (xn - x0) / 6},${py - (yn - y0) / 6} ${px},${py}`
  }, '')
  const area = `${line} L${x(daily.length - 1)},${H - pad.bottom} L${pad.left},${H - pad.bottom} Z`
  const every = Math.ceil(daily.length / (W < 500 ? 4 : 6))
  const hovered = hover === null ? null : daily[hover]

  function pick(clientX: number, rect: DOMRect) {
    const sx = ((clientX - rect.left) / rect.width) * W
    const i = Math.round(((sx - pad.left) / (W - pad.left - 8)) * (daily.length - 1))
    setHover(Math.min(Math.max(i, 0), daily.length - 1))
  }

  if (daily.every((d) => d.revenue_centavos === 0)) {
    return <p className="mt-10 mb-6 text-center text-[15px] text-ink-2">No sales in this period yet.</p>
  }

  return (
    <div ref={box} className="relative mt-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y select-none"
        role="img"
        aria-label={`Sales per day. Highest ${peso(Math.max(...daily.map((d) => d.revenue_centavos)))}.`}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.left} x2={W - 8} y1={y((max * f) / 1.15)} y2={y((max * f) / 1.15)} stroke="var(--line)" strokeDasharray="2 4" />
            <text x={pad.left - 8} y={y((max * f) / 1.15) + 4} textAnchor="end" className="num fill-[var(--ink-3)] text-[12px]">
              {shortPeso(Math.round((max * f) / 1.15))}
            </text>
          </g>
        ))}
        {pts.map(([px, py], i) => (
          <line key={i} x1={px} x2={px} y1={py} y2={H - pad.bottom} stroke="var(--ink)" strokeOpacity="0.07" />
        ))}
        <path d={area} fill="url(#fill)" />
        <path d={line} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" />
        {daily.map((d, i) =>
          (i % every === 0 && daily.length - 1 - i >= every * 0.8) || i === daily.length - 1 ? (
            <text
              key={d.day}
              x={x(i)}
              y={H - 8}
              textAnchor={i === daily.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
              className="fill-[var(--ink-3)] text-[12px]"
            >
              {dayFmt.format(new Date(d.day))}
            </text>
          ) : null,
        )}
        {hover !== null && (
          <g>
            <line x1={pts[hover][0]} x2={pts[hover][0]} y1={pad.top} y2={H - pad.bottom} stroke="var(--ink)" strokeOpacity="0.4" />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r="5" fill="var(--bg)" stroke="var(--gold)" strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl border border-line bg-raised px-3 py-1.5 text-center"
          style={{ left: `${Math.min(Math.max((pts[hover!][0] / W) * 100, 12), 88)}%` }}
        >
          <p className="text-[12px] text-ink-3">{dayFmt.format(new Date(hovered.day))}</p>
          <p className="num text-[14px] font-semibold">{peso(hovered.revenue_centavos)}</p>
        </div>
      )}
    </div>
  )
}

function Loading() {
  return (
    <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_360px]" aria-label="Loading">
      <Skeleton className="h-96 xl:col-span-2" />
      <Skeleton className="h-96" />
    </div>
  )
}
