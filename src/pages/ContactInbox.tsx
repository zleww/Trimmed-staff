import { useState } from 'react'
import { CheckCircle, MapPin, Phone } from '../components/icons'
import { Button, Glass, Notice, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { errorMessage, prettyMobile } from '../lib/format'
import type { ContactMessage } from '../lib/types'
import { useLoad } from '../lib/useLoad'

const when = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/**
 * Notes from the contact form. The owner sees all of them; the front desk sees
 * its own branch's and the ones with no branch picked. Newest first.
 * Reply by email or text from your own phone, then mark it done.
 */
export function ContactInbox() {
  const messages = useLoad(() => api.contactMessages(), [])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const list = messages.data ?? []
  const unread = list.filter((m) => !m.read).length

  async function mark(message: ContactMessage, read: boolean) {
    setBusyId(message.id)
    setError(null)
    try {
      await api.markContactMessage(message.id, read)
      messages.reload()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-labelledby="inbox-title" className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 id="inbox-title" className="text-[34px] leading-tight sm:text-[40px]">
          Messages
        </h1>
        <Button variant="ghost" onClick={messages.reload} loading={messages.loading && Boolean(messages.data)}>
          Refresh
        </Button>
      </div>
      <p className="mt-2 text-[15px] text-ink-2">
        {list.length === 0 ? 'No notes yet.' : unread === 0 ? 'All caught up.' : `${unread} new.`} Notes from the contact form on the home page.
      </p>

      <div className="mt-6 space-y-3">
        {error && <Notice tone="bad">{error}</Notice>}
        {messages.error && <Notice tone="bad">{messages.error}</Notice>}
        {messages.loading && !messages.data && <Skeleton className="h-32" />}
        <ul className="space-y-3">
          {list.map((m) => (
            <li key={m.id}>
              <Glass className={`p-5 sm:p-6 ${m.read ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-3">
                  <span className="num">{when.format(new Date(m.created_at))}</span>
                  {m.read ? (
                    <span className="inline-flex items-center gap-1.5 text-good">
                      <CheckCircle size={14} />
                      Done
                    </span>
                  ) : (
                    <span className="rounded-full bg-warn-bg px-2.5 py-1 font-medium text-warn">New</span>
                  )}
                </div>
                <p className="mt-3 text-[16px] leading-relaxed whitespace-pre-line">{m.note}</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
                  {m.email && (
                    <a href={`mailto:${m.email}`} className="inline-flex min-h-11 items-center break-all text-ink underline underline-offset-4">
                      {m.email}
                    </a>
                  )}
                  {m.mobile && (
                    <a href={`tel:${m.mobile}`} className="num inline-flex min-h-11 items-center gap-1.5 text-ink underline underline-offset-4">
                      <Phone size={14} />
                      {prettyMobile(m.mobile)}
                    </a>
                  )}
                  {m.branch && (
                    <span className="inline-flex min-h-11 items-center gap-1.5 text-ink-2">
                      <MapPin size={14} />
                      {m.branch}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex justify-end">
                  <Button variant="ghost" onClick={() => mark(m, !m.read)} loading={busyId === m.id} className="min-h-10 px-4 text-[14px]">
                    {m.read ? 'Mark as new' : 'Mark as done'}
                  </Button>
                </div>
              </Glass>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
