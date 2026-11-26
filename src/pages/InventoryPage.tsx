import { useState } from 'react'
import { Alert, Ban, CheckCircle, Plus } from '../components/icons'
import { Button, Dialog, Field, Notice, Skeleton, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { errorMessage, peso } from '../lib/format'
import { parsePeso } from '../lib/money'
import type { InventoryItem } from '../lib/types'
import { useLoad } from '../lib/useLoad'

type Open =
  | { kind: 'product'; item: InventoryItem | null }
  | { kind: 'in'; item: InventoryItem }
  | { kind: 'count'; item: InventoryItem }
  | null

// stock level: always icon + text + color
function level(item: InventoryItem) {
  if (!item.active) return { label: 'Not sold', className: 'bg-raised text-ink-3', Icon: Ban }
  if (item.stock_qty === 0) return { label: 'Out of stock', className: 'bg-bad-bg text-bad', Icon: Alert }
  if (item.stock_qty <= item.low_stock_at) return { label: 'Low', className: 'bg-warn-bg text-warn', Icon: Alert }
  return { label: 'In stock', className: 'bg-good-bg text-good', Icon: CheckCircle }
}

/** Products for sale: prices, stock deliveries and count corrections. Sales take stock out by themselves. */
export function InventoryPage() {
  const items = useLoad(() => api.inventory(), [])
  const [open, setOpen] = useState<Open>(null)
  const [message, setMessage] = useState<string | null>(null)

  function done(text: string) {
    setOpen(null)
    setMessage(text)
    items.reload()
  }

  const list = items.data ?? []
  const low = list.filter((i) => i.active && i.stock_qty <= i.low_stock_at)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] leading-tight sm:text-[34px]">Inventory</h1>
          <p className="text-[15px] text-ink-3">Stock goes down by itself when the desk sells a product.</p>
        </div>
        <Button className="h-12 px-5" onClick={() => setOpen({ kind: 'product', item: null })}>
          <Plus size={18} />
          Add product
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {message && <Notice tone="good">{message}</Notice>}
        {low.length > 0 && (
          <Notice tone="warn">
            Order soon: {low.map((i) => `${i.name} (${i.stock_qty} left)`).join(', ')}.
          </Notice>
        )}
        {items.error && <Notice tone="bad">{items.error}</Notice>}
        {items.loading && !items.data && <Skeleton className="h-64" />}
        {items.data && list.length === 0 && (
          <p className="rounded-[14px] border border-line bg-card p-6 text-center text-[15px] text-ink-2">No products yet. Add the pomades you sell.</p>
        )}

        <ul className="space-y-2">
          {list.map((item) => {
            const l = level(item)
            return (
              <li key={item.id} className="rounded-[14px] border border-line bg-card px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px]">{item.name}</span>
                    <span className="block text-[13px] text-ink-3">
                      {peso(item.price_centavos)} · warn at {item.low_stock_at}
                    </span>
                  </span>
                  <span className="num shrink-0 text-[22px] font-medium">{item.stock_qty}</span>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium ${l.className}`}>
                    <l.Icon size={14} />
                    {l.label}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="secondary" className="h-11" onClick={() => setOpen({ kind: 'in', item })}>
                    Stock in
                  </Button>
                  <Button variant="ghost" className="h-11" onClick={() => setOpen({ kind: 'count', item })}>
                    Fix count
                  </Button>
                  <Button variant="ghost" className="h-11" onClick={() => setOpen({ kind: 'product', item })}>
                    Edit
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {open?.kind === 'product' && (
        <ProductDialog item={open.item} onClose={() => setOpen(null)} onDone={(name) => done(open.item ? `Saved ${name}.` : `Added ${name}. Use Stock in when it arrives.`)} />
      )}
      {open?.kind === 'in' && <StockInDialog item={open.item} onClose={() => setOpen(null)} onDone={(qty) => done(`Added ${qty} ${open.item.name}.`)} />}
      {open?.kind === 'count' && <CountDialog item={open.item} onClose={() => setOpen(null)} onDone={(n) => done(`${open.item.name} is now ${n}.`)} />}
    </div>
  )
}

function useSubmit() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(task: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await task()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}

function Buttons({ busy, label, onClose }: { busy: boolean; label: string; onClose: () => void }) {
  return (
    <div className="flex gap-2 pt-2">
      <Button type="button" variant="ghost" className="h-12 flex-1" onClick={onClose}>
        Back
      </Button>
      <Button type="submit" className="h-12 flex-1" loading={busy}>
        {label}
      </Button>
    </div>
  )
}

/** A whole number like "12"; anything else is null. */
const count = (text: string) => (/^\d{1,4}$/.test(text.trim()) ? Number(text.trim()) : null)

function ProductDialog({ item, onClose, onDone }: { item: InventoryItem | null; onClose: () => void; onDone: (name: string) => void }) {
  const [name, setName] = useState(item?.name ?? '')
  const [price, setPrice] = useState(item ? String(item.price_centavos / 100) : '')
  const [warnAt, setWarnAt] = useState(String(item?.low_stock_at ?? 3))
  const [active, setActive] = useState(item?.active ?? true)
  const { busy, error, setError, run } = useSubmit()

  return (
    <Dialog open title={item ? `Edit ${item.name}` : 'Add product'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const centavos = parsePeso(price)
          const at = count(warnAt)
          if (!centavos) return setError('Enter the price, like 350')
          if (at === null) return setError('Enter a whole number for the warning, like 3')
          void run(async () => {
            await api.saveProduct({ id: item?.id ?? null, name: name.trim(), price_centavos: centavos, low_stock_at: at, active })
            onDone(name.trim())
          })
        }}
      >
        {error && <Notice tone="bad">{error}</Notice>}
        <Field label="Name" placeholder="Matte pomade 100g" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Price (₱)" inputMode="decimal" placeholder="350" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Field label="Warn me when stock is at or below" inputMode="numeric" value={warnAt} onChange={(e) => setWarnAt(e.target.value)} />
        {item && <Toggle label="For sale" checked={active} onChange={setActive} />}
        <Buttons busy={busy} label={item ? 'Save' : 'Add product'} onClose={onClose} />
      </form>
    </Dialog>
  )
}

function StockInDialog({ item, onClose, onDone }: { item: InventoryItem; onClose: () => void; onDone: (qty: number) => void }) {
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const { busy, error, setError, run } = useSubmit()

  return (
    <Dialog open title={`Stock in: ${item.name}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const n = count(qty)
          if (!n) return setError('Enter how many arrived, like 12')
          void run(async () => {
            await api.stockIn(item.id, n, note.trim())
            onDone(n)
          })
        }}
      >
        {error && <Notice tone="bad">{error}</Notice>}
        <p className="text-[15px] text-ink-2">Now in stock: {item.stock_qty}</p>
        <Field label="How many arrived" inputMode="numeric" placeholder="12" value={qty} onChange={(e) => setQty(e.target.value)} />
        <Field label="Note (optional)" placeholder="Delivery from supplier" value={note} onChange={(e) => setNote(e.target.value)} />
        <Buttons busy={busy} label="Add to stock" onClose={onClose} />
      </form>
    </Dialog>
  )
}

function CountDialog({ item, onClose, onDone }: { item: InventoryItem; onClose: () => void; onDone: (n: number) => void }) {
  const [counted, setCounted] = useState('')
  const [reason, setReason] = useState('')
  const { busy, error, setError, run } = useSubmit()

  return (
    <Dialog open title={`Fix count: ${item.name}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const n = count(counted)
          if (n === null) return setError('Enter the number you counted, like 4')
          void run(async () => {
            await api.adjustStock(item.id, n, reason.trim())
            onDone(n)
          })
        }}
      >
        {error && <Notice tone="bad">{error}</Notice>}
        <p className="text-[15px] text-ink-2">The app says {item.stock_qty}. Type what is really on the shelf.</p>
        <Field label="Counted" inputMode="numeric" placeholder={String(item.stock_qty)} value={counted} onChange={(e) => setCounted(e.target.value)} />
        <Field label="Reason" placeholder="One opened as a tester" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Buttons busy={busy} label="Save count" onClose={onClose} />
      </form>
    </Dialog>
  )
}
