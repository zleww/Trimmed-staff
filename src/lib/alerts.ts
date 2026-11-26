import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { formatTime, manilaDateOf, manilaToday } from './dates'
import type { StaffRole } from './types'

// In-app alerts while the staff app is open (a tab or an installed screen):
// - owner and desk: booking requests waiting for an answer
// - barber: bookings confirmed for their chair since they last looked
// Shown as a number on the menu, in the tab title, and as a pop-up if allowed.
// Nothing is sent when the app is closed: that would need web push (later).

const POLL_MS = 30_000
const SEEN_EVENT = 'trimmed-bookings-seen'
const seenKey = (userId: string) => `trimmed.bookings-seen.${userId}`

/** When this barber last opened their bookings (ms). Stored on this device only. */
export function bookingsSeenAt(userId: string): number {
  try {
    return Number(localStorage.getItem(seenKey(userId))) || 0
  } catch {
    return 0
  }
}

/** The barber opened their bookings: clear the badge. */
export function markBookingsSeen(userId: string) {
  try {
    localStorage.setItem(seenKey(userId), String(Date.now()))
  } catch {
    // private mode: the badge just comes back next time
  }
  window.dispatchEvent(new Event(SEEN_EVENT))
}

/** Something was answered: count again now instead of at the next check. */
export function refreshAlerts() {
  window.dispatchEvent(new Event(SEEN_EVENT))
}

export function popupsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

function popup(title: string, body: string) {
  if (!popupsSupported() || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/favicon-32.png', tag: title + body })
  } catch {
    // some phones only allow pop-ups from an installed app
  }
}

const when = (iso: string) => (manilaDateOf(iso) === manilaToday() ? `today ${formatTime(iso)}` : `${manilaDateOf(iso).slice(5)} ${formatTime(iso)}`)

/** How many things need this person's attention. Polls while the app is open. */
export function useAlerts(role: StaffRole | null | undefined, userId: string | undefined) {
  const [requests, setRequests] = useState(0)
  const [bookings, setBookings] = useState(0)
  // ids already announced, so each one pops up once; null until the first check
  const known = useRef<Set<string> | null>(null)

  const check = useCallback(async () => {
    if (!role || !userId) return
    try {
      if (role === 'owner' || role === 'desk') {
        const list = await api.bookingRequests()
        setRequests(list.length)
        const fresh = list.filter((r) => !known.current?.has(r.id))
        // the first check only learns what's there; later ones announce what's new
        if (known.current) {
          for (const r of fresh) {
            const what = r.kind === 'cancel' ? 'Cancel request' : r.kind === 'move' ? 'New time asked' : 'New booking request'
            popup(what, `${r.customer}, ${r.service}, ${when(r.starts_at)}${r.barber ? ` with ${r.barber}` : ''}`)
          }
        }
        known.current = new Set(list.map((r) => r.id))
      } else if (role === 'barber') {
        const seen = bookingsSeenAt(userId)
        const list = (await api.barberSchedule(14)).filter((b) => b.status === 'booked' && b.confirmed_at && Date.parse(b.confirmed_at) > seen)
        setBookings(list.length)
        if (known.current) {
          for (const b of list.filter((x) => !known.current!.has(x.id))) {
            popup('New booking with you', `${b.customer_name}, ${b.service_name}, ${when(b.starts_at)}${b.inspo ? ' (has inspo)' : ''}`)
          }
        }
        known.current = new Set([...(known.current ?? []), ...list.map((b) => b.id)])
      }
    } catch {
      // offline or signed out: try again next time
    }
  }, [role, userId])

  useEffect(() => {
    known.current = null
    // oxlint-disable-next-line react/set-state-in-effect -- the state is set after the network answer, not right away
    void check()
    const timer = setInterval(() => void check(), POLL_MS)
    const again = () => void check()
    window.addEventListener(SEEN_EVENT, again)
    window.addEventListener('focus', again)
    return () => {
      clearInterval(timer)
      window.removeEventListener(SEEN_EVENT, again)
      window.removeEventListener('focus', again)
    }
  }, [check])

  // "(2) Trimmed staff" in the browser tab
  const total = requests + bookings
  useEffect(() => {
    document.title = total > 0 ? `(${total}) Trimmed staff` : 'Trimmed staff'
  }, [total])

  return { requests, bookings }
}
