import { useState } from 'react'
import { Notice, Segmented, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { addDays, manilaToday, weekdayOf } from '../lib/dates'
import { peso } from '../lib/format'
import { useLoad } from '../lib/useLoad'

type Range = 'today' | 'week' | 'month'

// Manila dates for each choice. Weeks start on Monday.
function rangeFor(range: Range): { from: string; to: string } {
  const today = manilaToday()
  if (range === 'today') return { from: today, to: today }
  if (range === 'week') return { from: addDays(today, -((weekdayOf(today) + 6) % 7)), to: today }
  return { from: today.slice(0, 8) + '01', to: today }
}

/** A barber's own numbers from my_earnings(). No shop totals, no other barbers. */
export function EarningsPage() {
  const [range, setRange] = useState<Range>('today')
  const { from, to } = rangeFor(range)
  const earnings = useLoad(() => api.myEarnings(from, to), [from, to])
  const e = earnings.data

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[30px] leading-tight sm:text-[34px]">My earnings</h1>
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

      <div className="mt-6 space-y-4">
        {earnings.error && <Notice tone="bad">{earnings.error}</Notice>}
        {!e && !earnings.error && <Skeleton className="h-48" />}
        {e && (
          <>
            {/* tips are the barber's own money, so they get the big card */}
            <div className="rounded-[14px] border border-line bg-card p-5">
              <p className="label">Tips</p>
              <p className="num mt-1 text-[40px] leading-none font-medium">{peso(e.tips_centavos)}</p>
              <p className="mt-2 text-[14px] text-ink-3">Yours in full. Collected with each bill.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat label="Cuts done" value={String(e.services_count)} />
              <Stat label="Services sold" value={peso(e.services_centavos)} />
              <Stat label="Products sold" value={peso(e.products_centavos)} />
            </div>
            <p className="text-[14px] text-ink-3">
              Only sales on your chair count. A sale the owner voids drops out. Your pay is worked out from these by the owner.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-line bg-card p-4">
      <p className="label">{label}</p>
      <p className="num mt-1 truncate text-[24px] font-medium">{value}</p>
    </div>
  )
}
