import { manilaDateOf, manilaToday, manilaWallClock, addDays } from './dates'
import type { Api, Barber, BarberReviews, Booking, Branch, BookingRequest, BookingRules, BranchReviews, ContactMessage, Inspo, InventoryItem, OpeningHours, OwnerDashboard, Profile, QueueItem, Review, StaffMember, Service, Session, StaffRole, Shift, WorkDay } from './types'

// Sample data for working on the screens without a database.
// Development only: api.ts never loads this file in a production build.
// Names and prices here are made up and must never appear on the live site.

const services: Service[] = [
  { id: 's1', name: 'Classic cut', description: 'Scissor and clipper cut, styled.', duration_minutes: 30, price_centavos: 25000 },
  { id: 's2', name: 'Skin fade', description: 'Fade down to the skin, sharp line-up.', duration_minutes: 45, price_centavos: 35000 },
  { id: 's3', name: 'Beard trim', description: 'Shape, line and hot towel.', duration_minutes: 20, price_centavos: 15000 },
  { id: 's4', name: 'Cut and beard', description: 'Any cut plus a full beard trim.', duration_minutes: 60, price_centavos: 45000 },
  { id: 's5', name: 'Kids cut', description: 'For 12 and under.', duration_minutes: 30, price_centavos: 20000 },
]

// two made-up branches, so the location step can be tried
const branches: Branch[] = [
  {
    id: 'br1',
    name: 'Sample Branch One',
    address: '123 Sample Street, Sample City',
    phone: '0917 000 0001',
    description: 'Sample text: the first shop, three chairs by the window, open early for the work crowd.',
  },
  { id: 'br2', name: 'Sample Branch Two', address: '45 Example Avenue, Sample City', phone: null, description: null },
]

const barbers: Barber[] = [
  { id: 'b1', branch_id: 'br1', display_name: 'Sample Barber 1', bio: 'Fades and tapers.', photo_url: null },
  { id: 'b2', branch_id: 'br1', display_name: 'Sample Barber 2', bio: 'Classic cuts and beards.', photo_url: null },
  { id: 'b3', branch_id: 'br2', display_name: 'Sample Barber 3', bio: 'Textured crops.', photo_url: null },
]

// Branch One: 9 to 8 (Sunday 10 to 5). Branch Two: 11 to 9, closed Mondays.
const hours: OpeningHours[] = [
  ...[0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    branch_id: 'br1',
    weekday,
    opens_at: weekday === 0 ? '10:00:00' : '09:00:00',
    closes_at: weekday === 0 ? '17:00:00' : '20:00:00',
  })),
  ...[0, 2, 3, 4, 5, 6].map((weekday) => ({ branch_id: 'br2', weekday, opens_at: '11:00:00', closes_at: '21:00:00' })),
]

const rules: BookingRules = { slot_step_minutes: 15, booking_days_ahead: 14, min_notice_minutes: 60, cancel_cutoff_minutes: 120 }

let session: Session | null = null
let profile: Profile | null = null
// one waiting request, so the desk's Requests badge can be tried in the sample data
const bookings: Booking[] = [
  (() => {
    const start = manilaWallClock(addDays(manilaToday(), 1), '11:00:00')
    return {
      id: 'sample-request',
      code: 'SAMPLE02',
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + services[0].duration_minutes * 60_000).toISOString(),
      status: 'requested' as const,
      service_id: services[0].id,
      service: services[0].name,
      branch_id: 'br1',
      branch: 'Sample Branch One',
      barber_id: 'b2',
      barber: 'Sample Barber 2',
      price_centavos: services[0].price_centavos,
    }
  })(),
]
// a request for a new time -> the confirmed booking it would replace
const replaces = new Map<string, string>()

function pendingMoves(bookingId: string) {
  return bookings.filter((b) => replaces.get(b.id) === bookingId && b.status === 'requested')
}

// what the database's booking summary adds about waiting changes
function withChanges(b: Booking): Booking {
  const old = bookings.find((x) => x.id === replaces.get(b.id))
  const moving = b.status === 'booked' ? pendingMoves(b.id).at(-1) : undefined
  return { ...b, replaces_starts_at: old?.starts_at ?? null, moving_to: moving?.starts_at ?? null, cancel_requested: Boolean(b.cancel_requested) }
}
const takenUsernames = new Set(['admin', 'owner', 'staff', 'desk', 'barber', 'trimmed', 'sample.fan'])
const inspo = new Map<string, Inspo & { bookingId: string }>()
// one sample inspo picture on the sample barber's booking tomorrow
inspo.set('inspo-sample', {
  id: 'inspo-sample',
  kind: 'image',
  bookingId: 'ahead1',
  url:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#2a2620"/><circle cx="60" cy="52" r="26" fill="#d6a54e"/><rect x="30" y="82" width="60" height="30" rx="14" fill="#d6a54e"/></svg>',
    ),
})

// made-up reviews so the barber page has something to show
const reviews: (Review & { barberId: string })[] = [
  { id: 'r1', barberId: 'b1', rating: 5, comment: 'Clean skin fade, took his time on the line-up.', created_at: '2026-11-02T06:00:00Z', edited: false, username: 'sample.fan', mine: false },
  { id: 'r2', barberId: 'b1', rating: 4, comment: 'Good cut. Slightly late start.', created_at: '2026-10-21T09:30:00Z', edited: false, username: 'jm_sample', mine: false },
  { id: 'r3', barberId: 'b2', rating: 5, comment: null, created_at: '2026-11-10T03:00:00Z', edited: false, username: 'cutclient', mine: false },
]

// made-up branch reviews for the Branches section
const branchReviewList: (Review & { branchId: string })[] = [
  { id: 'br-r1', branchId: 'br1', rating: 5, comment: 'Sample review: clean place, easy parking.', created_at: '2026-11-12T05:00:00Z', edited: false, username: 'sample.fan', mine: false },
  { id: 'br-r2', branchId: 'br1', rating: 4, comment: 'Sample review: busy on Saturdays, book ahead.', created_at: '2026-11-03T08:00:00Z', edited: false, username: 'jm_sample', mine: false },
]

function branchReviewsFor(branchId: string): BranchReviews {
  return {
    reviews: branchReviewList
      .filter((r) => r.branchId === branchId)
      .map(({ branchId: _branch, ...r }) => ({ ...r, mine: r.username !== null && r.username === profile?.username }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    // like barber reviews: in the sample data a visit is pretended once you have a profile
    can_review: Boolean(profile),
  }
}

const contactInbox: ContactMessage[] = []

function reviewsFor(barberId: string): BarberReviews {
  return {
    reviews: reviews
      .filter((r) => r.barberId === barberId)
      .map(({ barberId: _barber, ...r }) => ({ ...r, mine: r.username !== null && r.username === profile?.username }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    // in the sample data, a finished cut with every barber is pretended once you have a profile
    can_review: Boolean(profile),
  }
}
const listeners = new Set<(s: Session | null) => void>()

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))
const setSession = (next: Session | null) => {
  session = next
  listeners.forEach((listener) => listener(next))
}

function isFree(barberId: string, start: Date, end: Date): boolean {
  return !bookings.some(
    (b) =>
      b.barber_id === barberId &&
      ['requested', 'booked', 'checked_in', 'in_chair', 'done'].includes(b.status) &&
      new Date(b.starts_at) < end &&
      new Date(b.ends_at) > start,
  )
}

// a few made-up busy times so the slot grid doesn't look empty
function sampleBusy(barberId: string, start: Date): boolean {
  const n = start.getTime() / 900000 + barberId.charCodeAt(1)
  return n % 7 === 0 || n % 11 === 0
}

// is this barber's branch open for the whole of [start, end)?
function branchOpen(barberId: string, date: string, start: number, end: number): boolean {
  const branchId = barbers.find((b) => b.id === barberId)?.branch_id
  const day = hours.find((h) => h.branch_id === branchId && h.weekday === new Date(`${date}T00:00:00+08:00`).getUTCDay())
  return Boolean(day) && manilaWallClock(date, day!.opens_at).getTime() <= start && manilaWallClock(date, day!.closes_at).getTime() >= end
}

function slotsFor(serviceId: string, branchId: string | null, barberId: string | null, date: string): string[] {
  const service = services.find((s) => s.id === serviceId)
  if (!service || date < manilaToday() || date > addDays(manilaToday(), rules.booking_days_ahead)) return []
  const candidates = barbers.filter((b) => (!barberId || b.id === barberId) && (!branchId || b.branch_id === branchId)).map((b) => b.id)
  const earliest = Date.now() + rules.min_notice_minutes * 60000
  const out: string[] = []
  // every 15 minutes of the day; each barber's own branch hours decide
  for (let t = manilaWallClock(date, '06:00:00').getTime(); t < manilaWallClock(date, '23:00:00').getTime(); t += rules.slot_step_minutes * 60000) {
    const start = new Date(t)
    const end = new Date(t + service.duration_minutes * 60000)
    if (t < earliest) continue
    if (candidates.some((id) => branchOpen(id, date, t, end.getTime()) && isFree(id, start, end) && !sampleBusy(id, start))) {
      out.push(start.toISOString())
    }
  }
  return out
}

// In the sample data, signing in with an email that starts with "owner@", "desk@"
// or "barber@" makes you staff, so the shop screens can be tried.
// The sample barber login sits in Sample Barber 1's chair.
const SAMPLE_BARBER = 'b1'

function demoRole(): StaffRole | null {
  // like the database: no shop role until the two-step code is entered
  if (twoStep.on && !twoStep.verified) return null
  const email = session?.email ?? ''
  return email.startsWith('owner@') ? 'owner' : email.startsWith('desk@') ? 'desk' : email.startsWith('barber@') ? 'barber' : null
}

function needStaff() {
  if (!demoRole()) throw new Error('Not allowed')
}

// like the database: a barber only sees their own chair and walk-ins nobody has taken yet
function barberCanSee(row: SampleRow): boolean {
  return demoRole() !== 'barber' || row.barber_id === SAMPLE_BARBER || (row.barber_id === null && row.status === 'checked_in')
}

function needDesk() {
  const role = demoRole()
  if (role !== 'owner' && role !== 'desk') throw new Error('Not allowed')
}

function waiting(id: string): Booking {
  needDesk()
  const booking = bookings.find((b) => b.id === id)
  if (!booking) throw new Error('Request not found')
  if (booking.status !== 'requested') throw new Error('This request was already answered or cancelled')
  return booking
}

function needProfile(): Profile {
  if (!profile) throw new Error('Finish your profile first')
  return profile
}

export const demoApi: Api = {
  async listServices() {
    await wait()
    return services
  },
  async listBranches() {
    await wait(150)
    return branches
  },
  async listBarbers() {
    await wait()
    return barbers
  },
  async openingHours() {
    return hours
  },
  async bookingRules() {
    return rules
  },
  async freeSlots(serviceId, branchId, barberId, date) {
    await wait(300)
    return slotsFor(serviceId, branchId, barberId, date)
  },

  async getSession() {
    return session
  },
  onSessionChange(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  async signIn(login) {
    await wait()
    // a username signs in as the sample customer (the live site finds the email on the server)
    const email = login.includes('@') ? login : `${login.toLowerCase()}@sample.test`
    setSession({ userId: '00000000-0000-4000-8000-000000000001', email, pending: null })
    return session!
  },
  async signUp(email, _password, details) {
    await wait()
    setSession({ userId: '00000000-0000-4000-8000-000000000001', email, pending: details })
    return { needsConfirm: false }
  },
  async usernameAvailable(username) {
    await wait(150)
    const clean = username.trim().toLowerCase()
    return (/^[a-z0-9._]{3,20}$/.test(clean) && !takenUsernames.has(clean)) || clean === profile?.username
  },
  async sendPasswordReset() {
    await wait()
  },
  onPasswordRecovery() {
    return () => {}
  },
  async updatePassword(password) {
    await wait()
    if (password.length < 10) throw new Error('Pick a stronger password: at least 10 characters with letters and numbers.')
  },
  async clearPending() {
    if (session) session = { ...session, pending: null }
  },
  async signOut() {
    twoStep.verified = false
    setSession(null)
  },

  async myProfile() {
    return session ? profile : null
  },
  async saveProfile(username, fullName, mobile, consent) {
    await wait()
    const handle = username.trim().toLowerCase()
    if (!/^[a-z0-9._]{3,20}$/.test(handle)) throw new Error('Pick a username: 3 to 20 letters, numbers, dots or underscores')
    if (takenUsernames.has(handle) && handle !== profile?.username) throw new Error('That username is taken. Try another.')
    const digits = mobile.replace(/\D/g, '').replace(/^63/, '0')
    if (!/^09\d{9}$/.test(digits)) throw new Error('Enter an 11-digit mobile number that starts with 09')
    if (!profile && !consent) throw new Error('Please agree to the privacy notice first')
    if (profile?.username) takenUsernames.delete(profile.username)
    takenUsernames.add(handle)
    profile = {
      id: 'c1',
      avatar_path: null,
      avatar_url: null,
      preferred_barber: null,
      theme: 'dark',
      time_format: '12h',
      promo_opt_in: false,
      member_since: new Date().toISOString(),
      ...profile,
      username: handle,
      full_name: fullName.trim(),
      mobile: digits,
    }
    return profile
  },
  async setFavourite(barberId) {
    await wait(150)
    profile = { ...needProfile(), preferred_barber: barberId }
    return profile
  },
  async saveSettings(settings) {
    await wait()
    profile = { ...needProfile(), ...settings }
    return profile
  },
  async uploadAvatar(file) {
    await wait()
    profile = { ...needProfile(), avatar_path: 'demo/avatar.webp', avatar_url: URL.createObjectURL(file) }
    return profile
  },
  async removeAvatar() {
    profile = { ...needProfile(), avatar_path: null, avatar_url: null }
    return profile
  },
  async deleteMyData() {
    await wait()
    bookings.forEach((b) => {
      if (b.status === 'booked') b.status = 'cancelled'
    })
    for (let i = reviews.length - 1; i >= 0; i--) if (reviews[i]!.username === profile?.username) reviews.splice(i, 1)
    inspo.clear()
    profile = null
    setSession(null)
  },

  async book(serviceId, branchId, barberId, startsAt) {
    await wait(400)
    needProfile()
    const service = services.find((s) => s.id === serviceId)!
    const date = manilaDateOf(startsAt)
    if (barberId && barbers.find((b) => b.id === barberId)?.branch_id !== branchId) throw new Error('That barber works at another location')
    if (!slotsFor(serviceId, branchId, barberId, date).includes(startsAt)) throw new Error('That time is no longer free. Please pick another.')
    const start = new Date(startsAt)
    const end = new Date(start.getTime() + service.duration_minutes * 60000)
    const chosen =
      barberId ??
      barbers.find((b) => b.branch_id === branchId && branchOpen(b.id, date, start.getTime(), end.getTime()) && isFree(b.id, start, end) && !sampleBusy(b.id, start))!.id
    const booking: Booking = {
      id: crypto.randomUUID(),
      code: Math.random().toString(16).slice(2, 10).toUpperCase(),
      starts_at: startsAt,
      ends_at: end.toISOString(),
      status: 'requested' as const,
      service_id: service.id,
      service: service.name,
      branch_id: branchId,
      branch: branches.find((b) => b.id === branchId)?.name ?? null,
      barber: barbers.find((b) => b.id === chosen)!.display_name,
      barber_id: chosen,
      price_centavos: service.price_centavos,
    }
    bookings.push(booking)
    return booking
  },
  async myBookings() {
    await wait()
    return [...bookings].map(withChanges).sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  },
  async cancelBooking(id) {
    await wait()
    const booking = bookings.find((b) => b.id === id)
    if (!booking) throw new Error('Booking not found')
    if (booking.status === 'requested') {
      booking.status = 'cancelled'
      return withChanges(booking)
    }
    if (booking.cancel_requested) throw new Error('You already asked to cancel this booking. The shop will answer soon.')
    for (const move of pendingMoves(id)) move.status = 'cancelled'
    booking.cancel_requested = true
    booking.cancel_answer = null
    return withChanges(booking)
  },
  async keepBooking(id) {
    await wait()
    const booking = bookings.find((b) => b.id === id)
    if (!booking?.cancel_requested) throw new Error('There is no cancel request on this booking')
    booking.cancel_requested = false
    return withChanges(booking)
  },
  async rescheduleBooking(id, barberId, startsAt) {
    const old = bookings.find((b) => b.id === id)
    if (!old) throw new Error('Booking not found')
    if (old.status === 'requested') {
      // never confirmed: swap it straight away, still pointing at any confirmed booking it replaces
      old.status = 'cancelled'
      try {
        const moved = await demoApi.book(old.service_id, old.branch_id ?? 'br1', barberId, startsAt)
        const original = replaces.get(old.id)
        if (original) replaces.set(moved.id, original)
        for (const item of inspo.values()) if (item.bookingId === id) item.bookingId = moved.id
        return withChanges(moved)
      } catch (error) {
        old.status = 'requested'
        throw error
      }
    }
    if (old.cancel_requested) throw new Error('You asked to cancel this booking. Keep it first if you want to move it.')
    for (const move of pendingMoves(id)) move.status = 'cancelled'
    // confirmed: it stays until the shop confirms the new time
    const moved = await demoApi.book(old.service_id, old.branch_id ?? 'br1', barberId, startsAt)
    replaces.set(moved.id, old.id)
    return withChanges(moved)
  },

  async barberRatings() {
    await wait(150)
    const out: Record<string, { average: number | null; reviews: number }> = {}
    for (const b of barbers) {
      const list = reviews.filter((r) => r.barberId === b.id)
      const total = list.reduce((sum, r) => sum + r.rating, 0)
      out[b.id] = { average: list.length ? Math.round((total / list.length) * 10) / 10 : null, reviews: list.length }
    }
    return out
  },
  async barberReviews(barberId) {
    await wait()
    return reviewsFor(barberId)
  },
  async reviewBarber(barberId, rating, comment) {
    await wait()
    const me = needProfile()
    const text = comment.trim() || null
    const existing = reviews.find((r) => r.barberId === barberId && r.username === me.username)
    if (existing) Object.assign(existing, { rating, comment: text, edited: true })
    else {
      reviews.push({ id: crypto.randomUUID(), barberId, rating, comment: text, created_at: new Date().toISOString(), edited: false, username: me.username, mine: true })
    }
    return reviewsFor(barberId)
  },
  async removeMyReview(barberId) {
    await wait()
    const index = reviews.findIndex((r) => r.barberId === barberId && r.username === profile?.username)
    if (index >= 0) reviews.splice(index, 1)
    return reviewsFor(barberId)
  },

  async branchRatings() {
    await wait(150)
    const out: Record<string, { average: number | null; reviews: number }> = {}
    for (const b of branches) {
      const list = branchReviewList.filter((r) => r.branchId === b.id)
      const total = list.reduce((sum, r) => sum + r.rating, 0)
      out[b.id] = { average: list.length ? Math.round((total / list.length) * 10) / 10 : null, reviews: list.length }
    }
    return out
  },
  async branchReviews(branchId) {
    await wait()
    return branchReviewsFor(branchId)
  },
  async reviewBranch(branchId, rating, comment) {
    await wait()
    const me = needProfile()
    const text = comment.trim() || null
    const existing = branchReviewList.find((r) => r.branchId === branchId && r.username === me.username)
    if (existing) Object.assign(existing, { rating, comment: text, edited: true })
    else {
      branchReviewList.push({ id: crypto.randomUUID(), branchId, rating, comment: text, created_at: new Date().toISOString(), edited: false, username: me.username, mine: true })
    }
    return branchReviewsFor(branchId)
  },
  async removeMyBranchReview(branchId) {
    await wait()
    const index = branchReviewList.findIndex((r) => r.branchId === branchId && r.username === profile?.username)
    if (index >= 0) branchReviewList.splice(index, 1)
    return branchReviewsFor(branchId)
  },

  async sendContactMessage(form) {
    await wait()
    // the same checks the database makes, so the form's errors can be tried here
    if (!form.consent) throw new Error('Please agree to let us use your details to reply')
    const email = form.email.trim().toLowerCase()
    const mobile = form.mobile.replace(/\D/g, '')
    if (!email && !mobile) throw new Error('Leave an email or a mobile number so we can reply')
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email address')
    if (mobile && !/^09\d{9}$/.test(mobile)) throw new Error('Enter a mobile number like 09171234567')
    if (form.note.trim().length < 5) throw new Error('Write a short note (at least 5 characters)')
    contactInbox.unshift({
      id: crypto.randomUUID(),
      branch_id: form.branchId,
      branch: branches.find((b) => b.id === form.branchId)?.name ?? null,
      email: email || null,
      mobile: mobile || null,
      note: form.note.trim(),
      created_at: new Date().toISOString(),
      read: false,
    })
  },
  async contactMessages() {
    await wait()
    needDesk()
    return contactInbox.map((m) => ({ ...m }))
  },
  async markContactMessage(id, read) {
    await wait(100)
    needDesk()
    const message = contactInbox.find((m) => m.id === id)
    if (!message) throw new Error('Message not found')
    message.read = read
  },

  async myStaffRole() {
    return demoRole()
  },
  async bookingRequests(): Promise<BookingRequest[]> {
    await wait()
    needDesk()
    return bookings
      .filter((b) => (b.status === 'requested' || (b.status === 'booked' && b.cancel_requested)) && new Date(b.starts_at).getTime() > Date.now())
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((b) => ({
        id: b.id,
        kind: b.status === 'booked' ? ('cancel' as const) : replaces.has(b.id) ? ('move' as const) : ('new' as const),
        replaces_starts_at: bookings.find((x) => x.id === replaces.get(b.id))?.starts_at ?? null,
        code: b.code,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        service: b.service,
        price_centavos: b.price_centavos,
        branch_id: b.branch_id ?? 'br1',
        branch: b.branch ?? 'Sample Branch One',
        barber_id: b.barber_id,
        barber: b.barber,
        customer: profile?.full_name ?? 'Sample Customer',
        username: profile?.username ?? null,
        mobile: profile?.mobile ?? '09171234567',
        requested_at: new Date().toISOString(),
        visits: 2,
        no_shows: 0,
        inspo: [...inspo.values()].filter((i) => i.bookingId === b.id).length,
      }))
  },
  async confirmBooking(id) {
    await wait()
    const booking = waiting(id)
    booking.status = 'booked'
    const old = bookings.find((b) => b.id === replaces.get(id))
    if (old && old.status === 'booked') {
      old.status = 'cancelled'
      for (const item of inspo.values()) if (item.bookingId === old.id) item.bookingId = id
    }
  },
  async approveCancel(id) {
    await wait()
    needDesk()
    const booking = bookings.find((b) => b.id === id)
    if (!booking || booking.status !== 'booked' || !booking.cancel_requested) throw new Error('This request was already answered or taken back')
    booking.status = 'cancelled'
    booking.cancel_requested = false
  },
  async refuseCancel(id, reason) {
    await wait()
    needDesk()
    if (reason.trim().length < 3) throw new Error('Give the customer a short reason (3 to 200 characters)')
    const booking = bookings.find((b) => b.id === id)
    if (!booking || booking.status !== 'booked' || !booking.cancel_requested) throw new Error('This request was already answered or taken back')
    booking.cancel_requested = false
    booking.cancel_answer = reason.trim()
  },
  async declineBooking(id, reason) {
    await wait()
    if (reason.trim().length < 3) throw new Error('Give the customer a short reason (3 to 200 characters)')
    const booking = waiting(id)
    booking.status = 'declined'
    booking.reason = reason.trim()
  },

  async ownerDashboard(days) {
    await wait()
    if (demoRole() !== 'owner') throw new Error('Not allowed')
    return sampleDashboard(days)
  },

  async queueForDay(date) {
    await wait()
    needStaff()
    const barber = demoRole() === 'barber'
    return queue
      .filter((q) => manilaDateOf(q.starts_at ?? q.checked_in) === date && barberCanSee(q))
      .sort((a, b) => (a.starts_at ?? a.checked_in).localeCompare(b.starts_at ?? b.checked_in))
      .map(({ checked_in: _c, ...q }) => ({ ...q, customer_mobile: barber ? null : q.customer_mobile }))
  },
  async addWalkIn(name, serviceId, barberId) {
    await wait()
    needDesk()
    if (name.trim().length < 2) throw new Error("Enter the customer's name")
    const service = services.find((s) => s.id === serviceId)
    if (!service) throw new Error('That service is not available')
    const barber = barbers.find((b) => b.id === barberId)
    queue.push(sampleRow(name.trim(), service, barber ?? null, null, 'checked_in', 'walk_in'))
  },
  async checkIn(id) {
    await wait(150)
    const row = queueRow(id)
    if (row.status !== 'booked') throw new Error('Only a booked appointment can be checked in')
    row.status = 'checked_in'
  },
  async startService(id, barberId) {
    await wait(150)
    const row = queueRow(id)
    if (row.status !== 'checked_in') throw new Error('Check the customer in first')
    if (!row.barber_id) {
      // a barber can only take a walk-in into their own chair
      if (demoRole() === 'barber' && barberId && barberId !== SAMPLE_BARBER) throw new Error('Not allowed')
      const barber = barbers.find((b) => b.id === (demoRole() === 'barber' ? SAMPLE_BARBER : barberId))
      if (!barber) throw new Error('Pick a barber')
      row.barber_id = barber.id
      row.barber_name = barber.display_name
      row.starts_at = new Date().toISOString()
    }
    row.status = 'in_chair'
  },
  async markNoShow(id) {
    await wait(150)
    needDesk()
    const row = queueRow(id)
    if (row.status !== 'booked') throw new Error('Only a booked appointment can be a no-show')
    row.status = 'no_show'
  },
  async cancelAppointment(id, reason) {
    await wait(150)
    needDesk()
    const row = queueRow(id)
    if (!['booked', 'checked_in'].includes(row.status)) throw new Error('This appointment can no longer be cancelled')
    if (reason.trim().length < 3) throw new Error('Give a reason')
    row.status = 'cancelled'
  },
  async listProducts() {
    await wait(150)
    needStaff()
    return products.filter((p) => p.active).map(({ id, name, price_centavos, stock_qty }) => ({ id, name, price_centavos, stock_qty }))
  },
  async recordSale(sale) {
    await wait()
    needStaff()
    if (dayClosed) throw new Error('Today is already closed')
    if (sale.items.length === 0) throw new Error('Add at least one service or product')
    let total = 0
    for (const item of sale.items) {
      if ('service_id' in item) total += services.find((s) => s.id === item.service_id)?.price_centavos ?? 0
      else {
        const product = products.find((p) => p.id === item.product_id)
        if (!product) throw new Error('A product in this sale is not available')
        if (product.stock_qty < item.qty) throw new Error(`Not enough stock (only ${product.stock_qty} left)`)
        total += product.price_centavos * item.qty
      }
    }
    const tips = sale.tips.reduce((sum, t) => sum + t.amount_centavos, 0)
    const paid = sale.payments.reduce((sum, p) => sum + p.amount_centavos, 0)
    for (const p of sale.payments) {
      if (p.method !== 'cash' && !/^[A-Z0-9]{6,30}$/.test((p.reference ?? '').replace(/\s/g, '').toUpperCase())) {
        throw new Error('Enter the reference number from the receipt')
      }
    }
    if (paid !== total + tips) throw new Error(`Payments must add up to ₱${(total + tips) / 100}`)
    for (const item of sale.items) if ('product_id' in item) products.find((p) => p.id === item.product_id)!.stock_qty -= item.qty
    if (sale.appointmentId) queueRow(sale.appointmentId).status = 'done'
    if (demoRole() === 'barber') {
      for (const item of sale.items) {
        if ('service_id' in item) {
          earnings.services_count += 1
          earnings.services_centavos += services.find((s) => s.id === item.service_id)?.price_centavos ?? 0
        } else {
          earnings.products_centavos += (products.find((p) => p.id === item.product_id)?.price_centavos ?? 0) * item.qty
        }
      }
      earnings.tips_centavos += tips
    }
    return { total_centavos: total, tips_centavos: tips }
  },
  async barberSchedule(days) {
    await wait()
    if (demoRole() !== 'barber') throw new Error('Not allowed')
    const last = addDays(manilaToday(), days)
    return queue
      .filter((q) => q.barber_id === SAMPLE_BARBER && q.starts_at && ['booked', 'checked_in', 'in_chair'].includes(q.status) && Date.parse(q.ends_at!) > Date.now())
      .concat(sampleAhead)
      .filter((q) => manilaDateOf(q.starts_at!) < last)
      .sort((a, b) => a.starts_at!.localeCompare(b.starts_at!))
      .map((q) => ({
        id: q.id,
        code: q.code,
        starts_at: q.starts_at!,
        ends_at: q.ends_at!,
        status: q.status as 'requested' | 'booked' | 'checked_in' | 'in_chair',
        source: q.source,
        service_name: q.service_name,
        customer_name: q.customer_name,
        branch_name: 'Sample Branch One',
        // the made-up ones count as just confirmed, so the "new" badge can be tried
        confirmed_at: q.status === 'requested' ? null : q.id.startsWith('ahead') ? SAMPLE_CONFIRMED : manilaWallClock(manilaToday(), '07:00').toISOString(),
        created_at: manilaWallClock(manilaToday(), '07:00').toISOString(),
        inspo: q.id === 'ahead1' ? 1 : 0,
      }))
  },
  async myEarnings(from, to) {
    await wait()
    if (demoRole() !== 'barber') throw new Error('Not allowed')
    if (to < from || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 92) throw new Error('Pick a range of up to 3 months')
    // made-up numbers that grow with the range, plus what you rang up in this sample session
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000
    const scale = Math.round(days)
    return {
      services_count: earnings.services_count + scale * 6,
      services_centavos: earnings.services_centavos + scale * 180_000,
      products_centavos: earnings.products_centavos + scale * 25_000,
      tips_centavos: earnings.tips_centavos + scale * 12_000,
    }
  },
  async isDayClosed() {
    await wait(100)
    return dayClosed
  },
  async closeDay(count) {
    await wait()
    needDesk()
    if (dayClosed) throw new Error('Today is already closed')
    dayClosed = true
    if (demoRole() === 'owner') {
      return { closed: true, cash_difference_centavos: count.cash_centavos - 52500, gcash_difference_centavos: count.gcash_centavos - 35000, maya_difference_centavos: count.maya_centavos }
    }
    return { closed: true }
  },

  // sample two-step: any 6 digits work, so the screens can be tried
  async needsSignInCode() {
    return twoStep.on && !twoStep.verified
  },
  async verifySignInCode(code) {
    await wait()
    if (!/^\d{6}$/.test(code.trim())) throw new Error('That code is wrong or too old. Type the newest code from the app.')
    twoStep.verified = true
  },
  async twoStepStatus() {
    await wait(150)
    return { on: twoStep.on }
  },
  async startTwoStep() {
    await wait()
    return { factorId: 'sample-factor', qrCode: SAMPLE_QR, secret: 'SAMPLESECRETKEY234' }
  },
  async confirmTwoStep(_factorId, code) {
    await wait()
    if (!/^\d{6}$/.test(code.trim())) throw new Error('That code is wrong or too old. Type the newest code from the app.')
    twoStep.on = true
    twoStep.verified = true
  },
  async turnOffTwoStep() {
    await wait()
    twoStep.on = false
  },

  async staffList() {
    await wait()
    needOwner()
    return staffMembers.map((m) => ({ ...m, branch_name: branches.find((b) => b.id === m.branch_id)?.name ?? null }))
  },
  async createStaff(input) {
    await wait(400)
    needOwner()
    if (input.fullName.trim().length < 2) throw new Error('Enter their full name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Enter a valid email address.')
    if (input.password.length < 10) throw new Error('Use a password of at least 10 characters.')
    if (staffMembers.some((m) => m.email === input.email.trim().toLowerCase())) throw new Error('That email already has a login.')
    staffMembers.unshift({
      id: crypto.randomUUID(),
      full_name: input.fullName.trim(),
      role: input.role,
      email: input.email.trim().toLowerCase(),
      active: true,
      branch_id: input.branchId,
      branch_name: null,
      barber_id: input.role === 'barber' ? crypto.randomUUID() : null,
      created_at: new Date().toISOString(),
    })
  },
  async updateStaff(id, fullName, branchId) {
    await wait()
    needOwner()
    const member = staffMembers.find((m) => m.id === id)
    if (!member) throw new Error('Staff member not found')
    if (fullName.trim().length < 2) throw new Error('Enter their full name')
    if (member.role === 'desk' && !branchId) throw new Error('Pick the branch they work at')
    member.full_name = fullName.trim()
    if (member.role !== 'owner') member.branch_id = branchId
  },
  async barberHours(barberId) {
    await wait(150)
    needStaff()
    return (barberWeeks.get(barberId) ?? branchWeek(barberId)).map((d) => ({ ...d }))
  },
  async setBarberHours(barberId, days) {
    await wait()
    needOwner()
    if (new Set(days.map((d) => d.weekday)).size !== days.length) throw new Error('Each day can only be listed once')
    if (days.some((d) => d.ends_at <= d.starts_at)) throw new Error('Each day must end after it starts')
    barberWeeks.set(barberId, days.map((d) => ({ ...d })))
  },
  async myShiftsToday() {
    await wait(150)
    const role = demoRole()
    if (role !== 'barber' && role !== 'desk') return null
    const me = sampleMe()
    const today = manilaToday()
    return shifts
      .filter((s) => s.staff_id === me.id && (!s.clock_out || manilaDateOf(s.clock_in) === today || manilaDateOf(s.clock_out) === today))
      .map(({ id, clock_in, clock_out }) => ({ id, clock_in, clock_out }))
  },
  async clockIn() {
    await wait()
    const role = demoRole()
    if (role !== 'barber' && role !== 'desk') throw new Error('Not allowed')
    const me = sampleMe()
    if (shifts.some((s) => s.staff_id === me.id && !s.clock_out)) throw new Error('You are already clocked in')
    shifts.push({ id: crypto.randomUUID(), staff_id: me.id, clock_in: new Date().toISOString(), clock_out: null, fixed_at: null, fix_reason: null })
  },
  async clockOut() {
    await wait()
    const me = sampleMe()
    const open = shifts.find((s) => s.staff_id === me.id && !s.clock_out)
    if (!open) throw new Error('You are not clocked in')
    open.clock_out = new Date().toISOString()
  },
  async attendance(from, to) {
    await wait()
    needOwner()
    if (to < from) throw new Error('Pick a range of up to 3 months')
    return shifts
      .filter((s) => manilaDateOf(s.clock_in) >= from && manilaDateOf(s.clock_in) <= to)
      .sort((a, b) => b.clock_in.localeCompare(a.clock_in))
      .map((s) => {
        const member = staffMembers.find((m) => m.id === s.staff_id)!
        const branchId = member.branch_id
        return {
          ...s,
          full_name: member.full_name,
          role: member.role as 'desk' | 'barber',
          branch_id: branchId,
          branch_name: branches.find((b) => b.id === branchId)?.name ?? null,
          minutes: s.clock_out ? Math.round((Date.parse(s.clock_out) - Date.parse(s.clock_in)) / 60000) : null,
        }
      })
  },
  async fixShift(id, clockIn, clockOut, reason) {
    await wait()
    needOwner()
    if (reason.trim().length < 3) throw new Error('Give a reason (3 to 200 characters)')
    if (Date.parse(clockIn) > Date.now() || (clockOut && Date.parse(clockOut) > Date.now())) throw new Error("Times can't be in the future")
    if (clockOut && clockOut <= clockIn) throw new Error('Clock-out must be after clock-in')
    const shift = shifts.find((s) => s.id === id)
    if (!shift) throw new Error('Shift not found')
    Object.assign(shift, { clock_in: clockIn, clock_out: clockOut, fixed_at: new Date().toISOString(), fix_reason: reason.trim() })
  },
  async setStaffPassword(_id, password) {
    await wait(400)
    needOwner()
    if (password.length < 10) throw new Error('Use a password of at least 10 characters.')
  },
  async setStaffActive(id, active) {
    await wait()
    needOwner()
    const member = staffMembers.find((m) => m.id === id)
    if (!member) throw new Error('Staff member not found')
    if (member.role === 'owner' && !active) throw new Error("You can't turn off your own account.")
    member.active = active
  },
  async branchStats(days) {
    await wait()
    needOwner()
    return branches.map((b, i) => ({
      id: b.id,
      name: b.name,
      revenue_centavos: (i === 0 ? 5_800_00 : 3_100_00) * days,
      previous_centavos: (i === 0 ? 5_400_00 : 3_350_00) * days,
      sales: (i === 0 ? 19 : 11) * days,
      done: (i === 0 ? 18 : 10) * days,
      no_shows: Math.round(days / (i === 0 ? 6 : 4)),
      cancelled: Math.round(days / 3),
      barbers: barbers.filter((x) => x.branch_id === b.id).length,
    }))
  },
  async inventory() {
    await wait()
    needOwner()
    return products.map((p) => ({ ...p }))
  },
  async saveProduct(input) {
    await wait()
    needOwner()
    if (input.name.trim().length < 2) throw new Error('Enter the product name')
    if (input.price_centavos <= 0) throw new Error('Enter a price above zero')
    const found = products.find((p) => p.id === input.id)
    if (found) Object.assign(found, { name: input.name.trim(), price_centavos: input.price_centavos, low_stock_at: input.low_stock_at, active: input.active })
    else products.push({ id: crypto.randomUUID(), name: input.name.trim(), price_centavos: input.price_centavos, low_stock_at: input.low_stock_at, active: input.active, stock_qty: 0 })
  },
  async stockIn(id, qty) {
    await wait()
    needOwner()
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) throw new Error('Quantity must be 1 to 1000')
    products.find((p) => p.id === id)!.stock_qty += qty
  },
  async adjustStock(id, counted, reason) {
    await wait()
    needOwner()
    if (!Number.isInteger(counted) || counted < 0) throw new Error('Enter the number you counted')
    if (reason.trim().length < 3) throw new Error('Give a reason')
    products.find((p) => p.id === id)!.stock_qty = counted
  },

  async listInspo(bookingId) {
    await wait(150)
    return [...inspo.values()].filter((i) => i.bookingId === bookingId).map(({ bookingId: _booking, ...item }) => item)
  },
  async addInspo(bookingId, file, kind) {
    await wait(500)
    if ([...inspo.values()].filter((i) => i.bookingId === bookingId).length >= 3) throw new Error('Up to 3 photos or videos per booking')
    const item = { id: crypto.randomUUID(), kind, url: URL.createObjectURL(file), bookingId }
    inspo.set(item.id, item)
    return { id: item.id, kind, url: item.url }
  },
  async removeInspo(id) {
    await wait(150)
    inspo.delete(id)
  },
}

// made-up but steady numbers (same every reload) so the owner screen can be worked on
function sampleDashboard(days: number): OwnerDashboard {
  const daily = Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10)
    const weekend = [0, 6].includes(new Date(day).getDay())
    const wobble = Math.round((Math.sin(i * 1.7) + 1) * 1500) * 100
    return { day, revenue_centavos: (weekend ? 900000 : 550000) + wobble }
  })
  const revenue = daily.reduce((sum, d) => sum + d.revenue_centavos, 0)
  const now = Date.now()
  return {
    days,
    today: { revenue_centavos: daily.at(-1)!.revenue_centavos, sales: 21 },
    bookings_today: { total: 26, done: 14, no_show: 1 },
    waiting_requests: bookings.filter((b) => b.status === 'requested').length,
    period: { revenue_centavos: revenue, previous_centavos: Math.round(revenue * 0.91), expenses_centavos: Math.round(revenue * 0.34), sales: days * 19 },
    daily,
    barbers: [
      { name: 'Barber A (sample)', services: days * 8, revenue_centavos: Math.round(revenue * 0.42) },
      { name: 'Barber B (sample)', services: days * 6, revenue_centavos: Math.round(revenue * 0.33) },
      { name: 'Barber C (sample)', services: days * 4, revenue_centavos: Math.round(revenue * 0.25) },
    ],
    services: [
      { name: 'Haircut', count: days * 11 },
      { name: 'Haircut and beard', count: days * 4 },
      { name: 'Beard trim', count: days * 3 },
      { name: 'Hot towel shave', count: days },
    ],
    recent: ['Haircut', 'Beard trim', 'Haircut, Pomade', 'Haircut and beard', 'Haircut'].map((items, i) => ({
      id: `s${i}`,
      sold_at: new Date(now - i * 38 * 60_000).toISOString(),
      total_centavos: [25000, 15000, 60000, 40000, 25000][i],
      items,
      barber: ['Barber A (sample)', 'Barber B (sample)', 'Barber A (sample)', 'Barber C (sample)', 'Barber B (sample)'][i],
      paid_by: i % 2 ? 'gcash' : 'cash',
    })),
  }
}

// ---------- desk sample data: today's list ----------

type SampleRow = QueueItem & { checked_in: string }
let dayClosed = false
const products: InventoryItem[] = [
  { id: 'p1', name: 'Sample matte pomade', price_centavos: 35000, stock_qty: 6, low_stock_at: 3, active: true },
  { id: 'p2', name: 'Sample shine pomade', price_centavos: 32000, stock_qty: 2, low_stock_at: 3, active: true },
  { id: 'p3', name: 'Sample hair clay', price_centavos: 38000, stock_qty: 0, low_stock_at: 2, active: true },
]

function needOwner() {
  if (demoRole() !== 'owner') throw new Error('Not allowed')
}

const staffMembers: StaffMember[] = [
  { id: 'st0', full_name: 'Sample Owner', role: 'owner', email: 'owner@sample.test', active: true, branch_id: null, branch_name: null, barber_id: null, created_at: '2026-11-01T00:00:00Z' },
  { id: 'st1', full_name: 'Sample Desk One', role: 'desk', email: 'desk@sample.test', active: true, branch_id: 'br1', branch_name: null, barber_id: null, created_at: '2026-11-02T00:00:00Z' },
  { id: 'st2', full_name: 'Sample Barber 1', role: 'barber', email: 'barber1@sample.test', active: true, branch_id: 'br1', branch_name: null, barber_id: 'b1', created_at: '2026-11-03T00:00:00Z' },
  { id: 'st3', full_name: 'Sample Barber 3', role: 'barber', email: 'barber3@sample.test', active: false, branch_id: 'br2', branch_name: null, barber_id: 'b3', created_at: '2026-11-04T00:00:00Z' },
]

function sampleRow(name: string, service: Service, barber: Barber | null, at: Date | null, status: QueueItem['status'], source: QueueItem['source']): SampleRow {
  return {
    id: crypto.randomUUID(),
    code: Math.random().toString(36).slice(2, 10).toUpperCase(),
    starts_at: at?.toISOString() ?? null,
    ends_at: at ? new Date(at.getTime() + service.duration_minutes * 60_000).toISOString() : null,
    status,
    source,
    service_id: service.id,
    service_name: service.name,
    price_centavos: service.price_centavos,
    branch_id: barber?.branch_id ?? 'br1',
    barber_id: barber?.id ?? null,
    barber_name: barber?.display_name ?? null,
    customer_name: name,
    customer_mobile: source === 'online' ? '09171234567' : null,
    checked_in: new Date().toISOString(),
  }
}

// a made-up day around "now": one done, one in the chair, one waiting, a few to come
const queue: SampleRow[] = (() => {
  const at = (minutes: number) => new Date(Math.round((Date.now() + minutes * 60_000) / 900_000) * 900_000)
  return [
    sampleRow('Sample Customer A', services[0], barbers[0], at(-90), 'done', 'online'),
    sampleRow('Sample Customer B', services[1], barbers[1], at(-20), 'in_chair', 'online'),
    sampleRow('Sample Walk-in C', services[2], null, null, 'checked_in', 'walk_in'),
    sampleRow('Sample Customer D', services[3], barbers[0], at(-5), 'booked', 'online'),
    sampleRow('Sample Customer E', services[0], barbers[1], at(45), 'booked', 'desk'),
    sampleRow('Sample Customer F', services[4], barbers[0], at(120), 'booked', 'online'),
  ]
})()

// sample customer D (booked today with the sample barber) also sent an inspo picture
inspo.set('inspo-today', { ...inspo.get('inspo-sample')!, id: 'inspo-today', bookingId: queue[3].id })

function queueRow(id: string): SampleRow {
  needStaff()
  const row = queue.find((q) => q.id === id)
  if (!row) throw new Error('Appointment not found')
  if (!barberCanSee(row)) throw new Error('Not allowed')
  return row
}

// when the sample's "just confirmed" booking was confirmed: the moment the page loaded
const SAMPLE_CONFIRMED = new Date().toISOString()

// two bookings on coming days for the sample barber (not in today's queue)
const sampleAhead: SampleRow[] = (() => {
  const at = (days: number, time: string) => manilaWallClock(addDays(manilaToday(), days), time)
  return [
    { ...sampleRow('Sample Customer G', services[1], barbers[0], at(1, '10:00'), 'booked', 'online'), id: 'ahead1' },
    { ...sampleRow('Sample Customer H', services[0], barbers[0], at(2, '15:30'), 'requested', 'online'), id: 'ahead2' },
  ]
})()

// the sample barber's sales this session (today), added on top of the made-up numbers
const earnings = { services_count: 0, services_centavos: 0, products_centavos: 0, tips_centavos: 0 }

// sample barbers' working weeks; a barber nobody changed works their branch's opening hours
const barberWeeks = new Map<string, WorkDay[]>()
function branchWeek(barberId: string): WorkDay[] {
  const branchId = barbers.find((b) => b.id === barberId)?.branch_id ?? staffMembers.find((m) => m.barber_id === barberId)?.branch_id ?? 'br1'
  return hours
    .filter((h) => h.branch_id === branchId)
    .map((h) => ({ weekday: h.weekday, starts_at: h.opens_at.slice(0, 5), ends_at: h.closes_at.slice(0, 5) }))
}

// sample shifts: who the signed-in barber or desk login is in the staff list
type SampleShift = Shift & { staff_id: string; fixed_at: string | null; fix_reason: string | null }
function sampleMe() {
  return staffMembers.find((m) => m.role === demoRole())!
}
// a few made-up shifts so the owner's attendance page has something to show
const shifts: SampleShift[] = (() => {
  const at = (daysAgo: number, time: string) => manilaWallClock(addDays(manilaToday(), -daysAgo), time).toISOString()
  return [
    { id: 'sh1', staff_id: 'st1', clock_in: at(1, '08:52'), clock_out: at(1, '18:05'), fixed_at: null, fix_reason: null },
    { id: 'sh2', staff_id: 'st2', clock_in: at(1, '09:10'), clock_out: at(1, '19:58'), fixed_at: null, fix_reason: null },
    { id: 'sh3', staff_id: 'st3', clock_in: at(2, '09:02'), clock_out: null, fixed_at: null, fix_reason: null },
  ]
})()

// sample two-step state (a fresh page load signs you out in sample mode anyway)
const twoStep = { on: false, verified: false }
const SAMPLE_QR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/><path d="M1 1h3v3H1zM6 1h3v3H6zM1 6h3v3H1zM5 5h1v1H5zM7 6h1v2H7z" fill="#000"/></svg>',
  )
