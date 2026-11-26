import { useRef, useState, type ChangeEvent } from 'react'
import { api } from '../lib/api'
import { errorMessage } from '../lib/format'
import { MAX_INSPO, MAX_VIDEO_SECONDS, prepareInspo, type ReadyInspo } from '../lib/inspo'
import type { Inspo } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { ImagePlus, Play, X } from './icons'
import { Dialog, Notice, Spinner } from './ui'

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm'

type Tile = { key: string; kind: 'image' | 'video'; url: string | null }

/** A row of square previews plus an "Add" tile. Tap a preview to see it big. */
function TileRow({
  tiles,
  canAdd,
  busy,
  onPick,
  onRemove,
}: {
  tiles: Tile[]
  canAdd: boolean
  busy: boolean
  onPick: (files: File[]) => void
  onRemove?: (key: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState<Tile | null>(null)

  function picked(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])]
    event.target.value = '' // picking the same file again still works
    if (files.length) onPick(files)
  }

  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.key} className="relative aspect-square overflow-hidden rounded-2xl bg-raised">
            <button type="button" onClick={() => setOpen(tile)} className="block size-full" aria-label={`Open ${tile.kind === 'video' ? 'video' : 'photo'}`}>
              {tile.url &&
                (tile.kind === 'image' ? (
                  <img src={tile.url} alt="" className="size-full object-cover" />
                ) : (
                  <>
                    <video src={`${tile.url}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
                      <Play size={26} />
                    </span>
                  </>
                ))}
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(tile.key)}
                aria-label="Remove"
                className="absolute top-1 right-1 flex size-9 items-center justify-center rounded-full bg-bg/80 text-ink backdrop-blur hover:text-bad"
              >
                <X size={16} />
              </button>
            )}
          </li>
        ))}
        {canAdd && (
          <li className="aspect-square">
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className="flex size-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-ink-3/60 text-[13px] text-ink-2 transition hover:border-ink-2 hover:text-ink disabled:opacity-60"
            >
              {busy ? <Spinner /> : <ImagePlus size={22} />}
              {busy ? 'Adding…' : 'Add'}
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={picked} />

      <Dialog open={open !== null} title={open?.kind === 'video' ? 'Inspo video' : 'Inspo photo'} onClose={() => setOpen(null)}>
        {open?.url &&
          (open.kind === 'image' ? (
            <img src={open.url} alt="Inspo" className="max-h-[65dvh] w-full rounded-2xl object-contain" />
          ) : (
            <video src={open.url} controls playsInline autoPlay className="max-h-[65dvh] w-full rounded-2xl bg-black" />
          ))}
      </Dialog>
    </>
  )
}

const HELP = `Up to ${MAX_INSPO} photos or videos (${MAX_VIDEO_SECONDS} seconds max). Only you, the front desk and your barber can see them.`

/**
 * Before the booking exists: files wait here and go up right after "Confirm".
 * The parent keeps the list so it survives moving between steps.
 */
export function InspoDraft({ items, onChange }: { items: ReadyInspo[]; onChange: (items: ReadyInspo[]) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add(files: File[]) {
    setError(null)
    setBusy(true)
    const next = [...items]
    for (const file of files) {
      if (next.length >= MAX_INSPO) {
        setError(`Up to ${MAX_INSPO} per booking.`)
        break
      }
      try {
        next.push(await prepareInspo(file))
      } catch (reason) {
        setError(errorMessage(reason))
      }
    }
    onChange(next)
    setBusy(false)
  }

  function remove(key: string) {
    const item = items.find((i) => i.key === key)
    if (item) URL.revokeObjectURL(item.preview)
    onChange(items.filter((i) => i.key !== key))
  }

  return (
    <div className="space-y-3">
      <p className="text-[14px] leading-relaxed text-ink-2">{HELP}</p>
      {error && <Notice tone="bad">{error}</Notice>}
      <TileRow
        tiles={items.map((i) => ({ key: i.key, kind: i.kind, url: i.preview }))}
        canAdd={items.length < MAX_INSPO}
        busy={busy}
        onPick={add}
        onRemove={remove}
      />
    </div>
  )
}

/** After booking: the inspo saved on it. Add or remove while the booking can still change. */
export function BookingInspo({ bookingId, editable }: { bookingId: string; editable: boolean }) {
  const list = useLoad(() => api.listInspo(bookingId), [bookingId])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const items: Inspo[] = list.data ?? []

  async function add(files: File[]) {
    setError(null)
    setBusy(true)
    let count = items.length
    for (const file of files) {
      if (count >= MAX_INSPO) {
        setError(`Up to ${MAX_INSPO} per booking.`)
        break
      }
      try {
        const ready = await prepareInspo(file)
        await api.addInspo(bookingId, ready.blob, ready.kind)
        URL.revokeObjectURL(ready.preview)
        count++
      } catch (reason) {
        setError(errorMessage(reason))
      }
    }
    setBusy(false)
    list.reload()
  }

  async function remove(id: string) {
    setError(null)
    try {
      await api.removeInspo(id)
    } catch (reason) {
      setError(errorMessage(reason))
    }
    list.reload()
  }

  if (!editable && items.length === 0) return null

  return (
    <div className="mt-4 space-y-3 border-t border-glass-line pt-4">
      <p className="text-[14px] font-medium">Inspo for your barber</p>
      {editable && items.length === 0 && !list.loading && <p className="text-[13px] leading-relaxed text-ink-3">{HELP}</p>}
      {error && <Notice tone="bad">{error}</Notice>}
      {list.error && <Notice tone="bad">{list.error}</Notice>}
      <TileRow
        tiles={items.map((i) => ({ key: i.id, kind: i.kind, url: i.url }))}
        canAdd={editable && items.length < MAX_INSPO && !list.loading}
        busy={busy}
        onPick={add}
        onRemove={editable ? remove : undefined}
      />
    </div>
  )
}
