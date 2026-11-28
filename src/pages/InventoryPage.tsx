import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Ban, CheckCircle, List, Plus, Scissors } from '../components/icons'
import { Button, Dialog, Field, Notice, Segmented, Skeleton, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { centered } from '../lib/crop'
import { errorMessage, peso } from '../lib/format'
import { cropPhoto, loadPhoto } from '../lib/image'
import { parsePeso } from '../lib/money'
import { PRODUCT_CATEGORIES, type InventoryItem, type PayMethod, type ProductCategory } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { Select } from './Select'

type Open =
  | { kind: 'product'; item: InventoryItem | null }
  | { kind: 'in'; item: InventoryItem }
  | { kind: 'count'; item: InventoryItem }
  | { kind: 'sell' }
  | null

type StockFilter = 'all' | 'low' | 'out'

// stock level: always icon + text + color
function level(item: InventoryItem) {
  if (!item.active) return { label: 'Not sold', className: 'bg-raised text-ink-3', Icon: Ban }
  if (item.stock_qty === 0) return { label: 'Out of stock', className: 'bg-bad-bg text-bad', Icon: Alert }
  if (item.stock_qty <= item.low_stock_at) return { label: 'Low stock', className: 'bg-warn-bg text-warn', Icon: Alert }
  return { label: 'In stock', className: 'bg-good-bg text-good', Icon: CheckCircle }
}

/**
 * Products for sale. Owner: add and edit products, receive stock, fix a count.
 * Front desk: look, receive deliveries, and sell to someone who only buys a product.
 * Sales take stock out by themselves.
 */
export function InventoryPage() {
  const { staffRole } = useAuth()
  const owner = staffRole === 'owner'
  const items = useLoad(() => api.inventory(), [])
  const [open, setOpen] = useState<Open>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [stock, setStock] = useState<StockFilter>('all')

  function done(text: string) {
    setOpen(null)
    setMessage(text)
    items.reload()
  }

  const list = items.data ?? []
  const sold = list.filter((i) => i.active)
  const low = sold.filter((i) => i.stock_qty > 0 && i.stock_qty <= i.low_stock_at)
  const out = sold.filter((i) => i.stock_qty === 0)
  const value = sold.reduce((sum, i) => sum + i.price_centavos * i.stock_qty, 0)

  const q = search.trim().toLowerCase()
  const shown = list.filter(
    (i) =>
      (!q || `${i.name} ${i.size ?? ''} ${i.category}`.toLowerCase().includes(q)) &&
      (!category || i.category === category) &&
      (stock === 'all' || (stock === 'low' ? low.includes(i) : out.includes(i))),
  )

  // the buttons for one product, on the table row or the phone card
  const actions = (item: InventoryItem): ReactNode => (
    <>
      {item.active && (
        <Button variant="ghost" className="h-10 px-3 text-[14px]" onClick={() => setOpen({ kind: 'in', item })}>
          Receive
        </Button>
      )}
      {owner && (
        <>
          <Button variant="ghost" className="h-10 px-3 text-[14px]" onClick={() => setOpen({ kind: 'product', item })}>
            Edit
          </Button>
          <Button variant="ghost" className="h-10 px-3 text-[14px]" onClick={() => setOpen({ kind: 'count', item })}>
            Fix count
          </Button>
        </>
      )}
    </>
  )

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Inventory</p>
          <h1 className="text-[30px] leading-tight sm:text-[34px]">Products</h1>
          <p className="text-[15px] text-ink-3">Customers see these on the booking site and buy at the desk.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={owner ? 'secondary' : 'primary'} className="h-12 px-5" onClick={() => setOpen({ kind: 'sell' })} disabled={!sold.some((i) => i.stock_qty > 0)}>
            Sell product
          </Button>
          {owner && (
            <Button className="h-12 px-5" onClick={() => setOpen({ kind: 'product', item: null })}>
              <Plus size={18} />
              Add product
            </Button>
          )}
        </div>
      </div>

      {/* the numbers at a glance */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Stat label="Products for sale" value={String(sold.length)} />
        <Stat label="Low stock" value={String(low.length)} tone={low.length ? 'warn' : undefined} onClick={() => setStock('low')} />
        <Stat label="Out of stock" value={String(out.length)} tone={out.length ? 'bad' : undefined} onClick={() => setStock('out')} />
        {owner ? (
          <Stat label="Stock value" value={peso(value)} />
        ) : (
          <Stat label="Categories" value={String(new Set(sold.map((i) => i.category)).size)} />
        )}
      </div>

      <div className="mt-6 space-y-3">
        {message && <Notice tone="good">{message}</Notice>}
        {items.error && <Notice tone="bad">{items.error}</Notice>}

        {/* search and filters */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
          <div className="col-span-2 sm:flex-1">
            <Field label="Search" placeholder="Name, size or category" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="min-w-0 sm:w-48">
            <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Segmented
              label="Stock"
              value={stock}
              onChange={setStock}
              options={[
                { value: 'all', label: 'All' },
                { value: 'low', label: 'Low' },
                { value: 'out', label: 'Out' },
              ]}
            />
          </div>
        </div>

        {items.loading && !items.data && <Skeleton className="h-64" />}
        {items.data && shown.length === 0 && (
          <p className="rounded-[14px] border border-line bg-card p-6 text-center text-[15px] text-ink-2">
            {list.length === 0 ? (owner ? 'No products yet. Add the first one.' : 'No products yet. The owner adds them.') : 'Nothing matches. Clear the search or filters.'}
          </p>
        )}

        {/* wide screens: a table */}
        {shown.length > 0 && (
          <div className="hidden overflow-x-auto rounded-[14px] border border-line bg-card md:block">
            <table className="w-full text-left text-[15px]">
              <thead className="border-b border-line text-[13px] text-ink-3">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="hidden px-4 py-3 font-medium xl:table-cell">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 text-right font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {shown.map((item) => {
                  const lv = level(item)
                  return (
                    <tr key={item.id} className={item.active ? '' : 'opacity-60'}>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-3">
                          <Thumb item={item} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{item.name}</span>
                            {/* the category sits under the name until there's room for its own column */}
                            <span className="block text-[13px] text-ink-3">
                              <span className="xl:hidden">
                                {item.category}
                                {item.size && ' · '}
                              </span>
                              {item.size}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 xl:table-cell">
                        <span className="rounded-full bg-raised px-2.5 py-1 text-[13px] whitespace-nowrap text-ink-2">{item.category}</span>
                      </td>
                      <td className="num px-4 py-3 text-right">{peso(item.price_centavos)}</td>
                      <td className={`num px-4 py-3 text-right font-medium ${item.active && item.stock_qty <= item.low_stock_at ? 'text-warn' : ''}`}>{item.stock_qty}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium whitespace-nowrap ${lv.className}`}>
                          <lv.Icon size={14} />
                          {lv.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex justify-end gap-1">{actions(item)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* phones: cards */}
        <ul className="space-y-2 md:hidden">
          {shown.map((item) => {
            const lv = level(item)
            return (
              <li key={item.id} className={`rounded-[14px] border border-line bg-card p-3 ${item.active ? '' : 'opacity-60'}`}>
                <div className="flex items-center gap-3">
                  <Thumb item={item} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium">{item.name}</span>
                    <span className="block truncate text-[13px] text-ink-3">{[item.category, item.size].filter(Boolean).join(' · ')}</span>
                    <span className="num mt-0.5 block text-[14px]">
                      {peso(item.price_centavos)} · <span className="font-medium">{item.stock_qty}</span> left
                    </span>
                  </span>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium ${lv.className}`}>
                    <lv.Icon size={12} />
                    {lv.label}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1 border-t border-line pt-2">{actions(item)}</div>
              </li>
            )
          })}
        </ul>
      </div>

      {open?.kind === 'product' && (
        <ProductDialog item={open.item} onClose={() => setOpen(null)} onDone={(name) => done(open.item ? `Saved ${name}.` : `Added ${name}. Receive stock when it comes in.`)} />
      )}
      {open?.kind === 'in' && <StockInDialog item={open.item} onClose={() => setOpen(null)} onDone={(n) => done(`Added ${n} to ${open.item.name}.`)} />}
      {open?.kind === 'count' && <CountDialog item={open.item} onClose={() => setOpen(null)} onDone={(n) => done(`${open.item.name} is now ${n}.`)} />}
      {open?.kind === 'sell' && <SellDialog items={sold.filter((i) => i.stock_qty > 0)} onClose={() => setOpen(null)} onDone={done} />}
    </div>
  )
}

function Stat({ label, value, tone, onClick }: { label: string; value: string; tone?: 'warn' | 'bad'; onClick?: () => void }) {
  const body = (
    <>
      <span className={`num block text-[22px] leading-tight font-medium sm:text-[26px] ${tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : ''}`}>{value}</span>
      <span className="block truncate text-[12px] text-ink-3 sm:text-[13px]">{label}</span>
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className="min-w-0 rounded-[14px] border border-line bg-card p-3 text-left transition hover:border-ink-3 sm:p-4">
      {body}
    </button>
  ) : (
    <div className="min-w-0 rounded-[14px] border border-line bg-card p-3 sm:p-4">{body}</div>
  )
}

function Thumb({ item }: { item: InventoryItem }) {
  return item.photo_url ? (
    <img src={item.photo_url} alt="" className="size-12 shrink-0 rounded-[10px] object-cover" />
  ) : (
    <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-[10px] bg-raised text-ink-3">
      <Scissors size={18} />
    </span>
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

function ProductDialog({ item, onClose, onDone }: { item: InventoryItem | null; onClose: () => void; onDone: (name: string) => void }) {
  const [name, setName] = useState(item?.name ?? '')
  const [cat, setCat] = useState<ProductCategory>(item?.category ?? 'Styling')
  const [size, setSize] = useState(item?.size ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [price, setPrice] = useState(item ? String(item.price_centavos / 100) : '')
  const [lowAt, setLowAt] = useState(String(item?.low_stock_at ?? 3))
  const [active, setActive] = useState(item?.active ?? true)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(item?.photo_url ?? null)
  const { busy, error, setError, run } = useSubmit()

  // free a picked photo's preview memory when it changes or the dialog closes
  useEffect(() => {
    if (!photo || !preview) return
    return () => URL.revokeObjectURL(preview)
  }, [photo, preview])

  async function pick(file: File | undefined) {
    if (!file) return
    try {
      const loaded = await loadPhoto(file)
      URL.revokeObjectURL(loaded.url)
      // a centered square, small enough for the 2 MB limit
      const blob = await cropPhoto(loaded, centered(loaded), 600)
      setPhoto(blob)
      setPreview(URL.createObjectURL(blob))
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  return (
    <Dialog open title={item ? `Edit ${item.name}` : 'Add product'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const centavos = parsePeso(price)
          const at = Number(lowAt)
          if (!centavos) return setError('Enter a price, like 350')
          if (!Number.isInteger(at) || at < 0) return setError('Low stock alert must be 0 or more')
          void run(async () => {
            await api.saveProduct({ id: item?.id ?? null, name: name.trim(), category: cat, size, description, price_centavos: centavos, low_stock_at: at, active, photo })
            onDone(name.trim())
          })
        }}
      >
        {error && <Notice tone="bad">{error}</Notice>}
        <div className="flex items-center gap-4">
          {preview ? (
            <img src={preview} alt="" className="size-20 rounded-[12px] object-cover" />
          ) : (
            <span aria-hidden="true" className="grid size-20 place-items-center rounded-[12px] bg-raised text-ink-3">
              <Scissors size={22} />
            </span>
          )}
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] border border-line px-4 text-[14px] font-medium hover:bg-raised">
            {preview ? 'Change photo' : 'Add photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
        </div>
        <Field label="Name" placeholder="Matte Clay Pomade" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Category" value={cat} onChange={(e) => setCat(e.target.value as ProductCategory)}>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Field label="Size" placeholder="100 g" value={size} onChange={(e) => setSize(e.target.value)} />
        </div>
        <Field label="Short description (optional)" placeholder="Strong hold, no shine." maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₱)" inputMode="decimal" placeholder="350" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Field label="Low stock alert at" inputMode="numeric" value={lowAt} onChange={(e) => setLowAt(e.target.value)} />
        </div>
        <Toggle label="For sale" description="Turned off: hidden from the booking site and the desk." checked={active} onChange={setActive} />
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
    <Dialog open title={`Receive ${item.name}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const n = Number(qty)
          if (!Number.isInteger(n) || n < 1) return setError('Enter how many came in')
          void run(async () => {
            await api.stockIn(item.id, n, note.trim())
            onDone(n)
          })
        }}
      >
        {error && <Notice tone="bad">{error}</Notice>}
        <p className="num text-[15px] text-ink-2">Now: {item.stock_qty}</p>
        <Field label="How many came in" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
        <Field label="Note (optional)" placeholder="Supplier, receipt number" value={note} onChange={(e) => setNote(e.target.value)} />
        <Buttons busy={busy} label="Add to stock" onClose={onClose} />
      </form>
    </Dialog>
  )
}

function CountDialog({ item, onClose, onDone }: { item: InventoryItem; onClose: () => void; onDone: (n: number) => void }) {
  const [counted, setCounted] = useState(String(item.stock_qty))
  const [reason, setReason] = useState('')
  const { busy, error, setError, run } = useSubmit()

  return (
    <Dialog open title={`Fix the count of ${item.name}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const n = Number(counted)
          if (!Number.isInteger(n) || n < 0) return setError('Enter the number you counted')
          void run(async () => {
            await api.adjustStock(item.id, n, reason.trim())
            onDone(n)
          })
        }}
      >
        {error && <Notice tone="bad">{error}</Notice>}
        <p className="num text-[15px] text-ink-2">The app says: {item.stock_qty}</p>
        <Field label="What you counted" inputMode="numeric" value={counted} onChange={(e) => setCounted(e.target.value)} />
        <Field label="Reason" placeholder="One jar broke" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Buttons busy={busy} label="Save count" onClose={onClose} />
      </form>
    </Dialog>
  )
}

/**
 * Someone buys only a product (no haircut). Same record_sale as the desk's Collect,
 * without an appointment: the database checks stock and takes it out.
 */
export function SellDialog({ items, onClose, onDone }: { items: InventoryItem[]; onClose: () => void; onDone: (text: string) => void }) {
  const [cart, setCart] = useState<{ item: InventoryItem; qty: number }[]>([])
  const [pick, setPick] = useState('')
  const [method, setMethod] = useState<PayMethod>('cash')
  const [reference, setReference] = useState('')
  const { busy, error, setError, run } = useSubmit()
  const total = cart.reduce((sum, c) => sum + c.item.price_centavos * c.qty, 0)

  function add() {
    const item = items.find((i) => i.id === pick)
    if (!item) return
    setCart((list) => {
      const found = list.find((c) => c.item.id === item.id)
      if (found && found.qty >= item.stock_qty) return list
      return found ? list.map((c) => (c === found ? { ...c, qty: c.qty + 1 } : c)) : [...list, { item, qty: 1 }]
    })
    setPick('')
  }

  return (
    <Dialog open title="Sell product" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (cart.length === 0) return setError('Add at least one product')
          void run(async () => {
            await api.recordSale({
              appointmentId: null,
              items: cart.map((c) => ({ product_id: c.item.id, qty: c.qty })),
              payments: [{ method, amount_centavos: total, ...(method === 'cash' ? {} : { reference }) }],
              tips: [],
            })
            onDone(`Sold ${cart.map((c) => `${c.item.name}${c.qty > 1 ? ` × ${c.qty}` : ''}`).join(', ')} for ${peso(total)}.`)
          })
        }}
      >
        {error && <Notice tone="bad">{error}</Notice>}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select label="Product" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Pick one</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} · {peso(i.price_centavos)} ({i.stock_qty} left)
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" variant="secondary" className="h-12" disabled={!pick} onClick={add}>
            Add
          </Button>
        </div>
        {cart.length > 0 ? (
          <ul className="divide-y divide-[var(--line)] rounded-[10px] border border-line">
            {cart.map((c) => (
              <li key={c.item.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[15px]">
                <span className="min-w-0 truncate">
                  {c.item.name} <span className="num text-ink-3">× {c.qty}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="num">{peso(c.item.price_centavos * c.qty)}</span>
                  <button type="button" className="min-h-11 px-2 text-[13px] text-ink-3 hover:text-ink" onClick={() => setCart((list) => list.filter((x) => x !== c))}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-[14px] text-ink-3">
            <List size={16} />
            Pick the products the customer is buying.
          </p>
        )}
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
          <Field label="Reference number" hint="From the customer's receipt on their phone" autoCapitalize="characters" value={reference} onChange={(e) => setReference(e.target.value)} />
        )}
        <Buttons busy={busy} label={`Collect ${peso(total)}`} onClose={onClose} />
      </form>
    </Dialog>
  )
}
