import { useState } from 'react'
import { TrendUp } from '../components/icons'
import { Notice, Segmented, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { peso } from '../lib/format'
import type { BranchStats } from '../lib/types'
import { useLoad } from '../lib/useLoad'

type Days = '7' | '30' | '90'
const whole = (c: number) => peso(Math.round(c / 100) * 100)

/** How each branch is doing, side by side. Numbers come from branch_stats(). */
export function BranchesPage() {
  const [days, setDays] = useState<Days>('30')
  const stats = useLoad(() => api.branchStats(Number(days) as 7 | 30 | 90), [days])
  const list = stats.data ?? []
  const total = list.reduce((sum, b) => sum + b.revenue_centavos, 0)

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] leading-tight sm:text-[34px]">Branches</h1>
          <p className="text-[15px] text-ink-3">
            {stats.data ? `${whole(total)} across ${list.length} ${list.length === 1 ? 'branch' : 'branches'}, last ${days} days` : 'Sales per location'}
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

      <div className="mt-6 space-y-4">
        {stats.error && <Notice tone="bad">{stats.error}</Notice>}
        {stats.loading && !stats.data && <Skeleton className="h-64" />}
        {stats.data && list.length === 0 && <p className="text-[15px] text-ink-2">No open branches yet.</p>}

        {/* share of sales: one grey bar per branch, so the biggest stands out at a glance */}
        {list.length > 1 && total > 0 && (
          <section className="rounded-[14px] border border-line bg-card p-5" aria-label="Share of sales">
            <h2 className="text-[18px]">Share of sales</h2>
            <ul className="mt-4 space-y-3">
              {list.map((b) => (
                <li key={b.id}>
                  <div className="flex justify-between gap-3 text-[14px]">
                    <span className="truncate">{b.name}</span>
                    <span className="num shrink-0 text-ink-2">{Math.round((b.revenue_centavos / total) * 100)}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-raised">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${(b.revenue_centavos / total) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {list.map((b) => (
            <BranchCard key={b.id} b={b} days={days} />
          ))}
        </div>
      </div>
    </div>
  )
}

function BranchCard({ b, days }: { b: BranchStats; days: Days }) {
  const change = b.previous_centavos ? Math.round(((b.revenue_centavos - b.previous_centavos) / b.previous_centavos) * 100) : null
  const average = b.sales ? Math.round(b.revenue_centavos / b.sales) : 0

  return (
    <section className="rounded-[14px] border border-line bg-card p-5 shadow-[inset_0_1px_0_var(--sheen)]" aria-label={b.name}>
      <h2 className="truncate text-[18px]">{b.name}</h2>
      <p className="num mt-2 text-[32px] font-medium">{whole(b.revenue_centavos)}</p>
      <p className="text-[14px] text-ink-3">
        {change === null ? (
          `Last ${days} days`
        ) : (
          <>
            <span className={`inline-flex items-center gap-1 ${change >= 0 ? 'text-good' : 'text-bad'}`}>
              <TrendUp size={14} className={change < 0 ? '-scale-y-100' : ''} />
              {change >= 0 ? '+' : ''}
              {change}%
            </span>{' '}
            vs the {days} days before
          </>
        )}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
        <Stat label="Sales" value={String(b.sales)} />
        <Stat label="Avg. sale" value={whole(average)} />
        <Stat label="Barbers" value={String(b.barbers)} />
        <Stat label="Cuts done" value={String(b.done)} />
        <Stat label="No-shows" value={String(b.no_shows)} tone={b.no_shows > 0 ? 'text-warn' : ''} />
        <Stat label="Cancelled" value={String(b.cancelled)} />
      </dl>
    </section>
  )
}

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className={`num truncate text-[17px] font-medium ${tone}`}>{value}</dd>
    </div>
  )
}
