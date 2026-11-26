import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { formatTime, manilaDateOf, manilaToday } from './dates'
import type { StaffRole } from './types'

// Alerts while the staff app is open (a tab, even in the background, or an installed screen):
// - owner and desk: booking requests waiting for an answer
// - barber: bookings confirmed for their chair since they last looked
// Each new one shows a banner on screen, plays a short chime, and (if allowed)
// a system pop-up. The menu shows a number and so does the browser tab title.
// Nothing arrives when the app is fully closed: that would need web push (later).

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

// Android Chrome refuses `new Notification(...)`; it only shows pop-ups from a
// service worker. public/sw.js does nothing else (no caching).
let worker: Promise<ServiceWorkerRegistration | null> | null = null
function alertWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!worker) {
    worker =
      'serviceWorker' in navigator
        ? navigator.serviceWorker
            .register('/sw.js')
            .then(() => navigator.serviceWorker.ready)
            .catch(() => null)
        : Promise.resolve(null)
  }
  return worker
}

/** Ask for system pop-ups. Also gets the sound ready (browsers need a tap first). */
export async function askForPopups(): Promise<NotificationPermission> {
  unlockSound()
  void alertWorker()
  return Notification.requestPermission()
}

async function popup(title: string, body: string, url: string) {
  if (!popupsSupported() || Notification.permission !== 'granted') return
  const options = { body, icon: '/favicon-32.png', badge: '/favicon-32.png', tag: `${title}:${body}`, data: { url } }
  try {
    const registration = await alertWorker()
    if (registration) return await registration.showNotification(title, options)
    new Notification(title, options)
  } catch {
    // iPhone: pop-ups only work once the app is added to the home screen
  }
}

// A short two-note chime made in the browser (no sound file to download).
let audio: AudioContext | null = null
function unlockSound() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = null
  }
}
function chime() {
  if (!audio || audio.state !== 'running') return
  const start = audio.currentTime
  for (const [i, freq] of [880, 1320].entries()) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, start + i * 0.18)
    gain.gain.exponentialRampToValueAtTime(0.25, start + i * 0.18 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.18 + 0.35)
    osc.connect(gain).connect(audio.destination)
    osc.start(start + i * 0.18)
    osc.stop(start + i * 0.18 + 0.4)
  }
}

const when = (iso: string) => (manilaDateOf(iso) === manilaToday() ? `today ${formatTime(iso)}` : `${manilaDateOf(iso).slice(5)} ${formatTime(iso)}`)

/** The banner the layout shows for the newest alert. */
export type AlertBanner = { id: number; title: string; body: string; to: string }

/** How many things need this person's attention. Polls while the app is open. */
export function useAlerts(role: StaffRole | null | undefined, userId: string | undefined) {
  const [requests, setRequests] = useState(0)
  const [bookings, setBookings] = useState(0)
  const [banner, setBanner] = useState<AlertBanner | null>(null)
  // ids already announced, so each one alerts once; null until the first check
  const known = useRef<Set<string> | null>(null)

  const announce = useCallback((title: string, body: string, to: string, loud: boolean) => {
    setBanner({ id: Date.now(), title, body, to })
    if (loud) {
      chime()
      void popup(title, body, to)
    }
  }, [])

  const check = useCallback(async () => {
    if (!role || !userId) return
    try {
      if (role === 'owner' || role === 'desk') {
        const list = await api.bookingRequests()
        setRequests(list.length)
        if (known.current) {
          for (const r of list.filter((x) => !known.current!.has(x.id))) {
            const what = r.kind === 'cancel' ? 'Cancel request' : r.kind === 'move' ? 'New time asked' : 'New booking request'
            announce(what, `${r.customer}, ${r.service}, ${when(r.starts_at)}${r.barber ? ` with ${r.barber}` : ''}`, '/requests', true)
          }
        } else if (list.length > 0) {
          // opening the app with requests already waiting: a quiet reminder
          announce(list.length === 1 ? '1 request is waiting' : `${list.length} requests are waiting`, 'Confirm or decline them so customers know.', '/requests', false)
        }
        known.current = new Set(list.map((r) => r.id))
      } else if (role === 'barber') {
        const seen = bookingsSeenAt(userId)
        const list = (await api.barberSchedule(14)).filter((b) => b.status === 'booked' && b.confirmed_at && Date.parse(b.confirmed_at) > seen)
        setBookings(list.length)
        if (known.current) {
          for (const b of list.filter((x) => !known.current!.has(x.id))) {
            announce('New booking with you', `${b.customer_name}, ${b.service_name}, ${when(b.starts_at)}${b.inspo ? ' (has inspo)' : ''}`, '/bookings', true)
          }
        } else if (list.length > 0) {
          announce(list.length === 1 ? '1 new booking with you' : `${list.length} new bookings with you`, 'Open Bookings to see who and their inspo.', '/bookings', false)
        }
        known.current = new Set([...(known.current ?? []), ...list.map((b) => b.id)])
      }
    } catch {
      // offline or signed out: try again next time
    }
  }, [role, userId, announce])

  useEffect(() => {
    known.current = null
    // the pop-up helper is ready early when pop-ups were allowed before
    if (popupsSupported() && Notification.permission === 'granted') void alertWorker()
    // the first tap anywhere lets the chime play later
    window.addEventListener('pointerdown', unlockSound, { once: true })
    // oxlint-disable-next-line react/set-state-in-effect -- the state is set after the network answer, not right away
    void check()
    const timer = setInterval(() => void check(), POLL_MS)
    const again = () => void check()
    window.addEventListener(SEEN_EVENT, again)
    window.addEventListener('focus', again)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pointerdown', unlockSound)
      window.removeEventListener(SEEN_EVENT, again)
      window.removeEventListener('focus', again)
    }
  }, [check])

  // "(2) Trimmed staff" in the browser tab
  const total = requests + bookings
  useEffect(() => {
    document.title = total > 0 ? `(${total}) Trimmed staff` : 'Trimmed staff'
  }, [total])

  return { requests, bookings, banner, dismiss: () => setBanner(null) }
}
