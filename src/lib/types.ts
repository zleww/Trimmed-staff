// Shapes of the data the screens use. Money is always whole centavos (25000 = P250.00).

export type Service = {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price_centavos: number
}

/** A location. Each has its own barbers and opening hours. */
export type Branch = {
  id: string
  name: string
  address: string | null
  phone: string | null
  /** a few lines the owner writes about this location */
  description: string | null
}

export type Barber = {
  id: string
  branch_id: string
  display_name: string
  bio: string | null
  photo_url: string | null
}

/** weekday: 0 = Sunday. Times are "HH:MM:SS" in Manila. One row per branch per open day. */
export type OpeningHours = { branch_id: string; weekday: number; opens_at: string; closes_at: string }

export type BookingRules = {
  slot_step_minutes: number
  booking_days_ahead: number
  min_notice_minutes: number
  cancel_cutoff_minutes: number
}

/** requested = waiting for the shop to confirm; declined = the shop said no (with a reason) */
export type BookingStatus = 'requested' | 'booked' | 'checked_in' | 'in_chair' | 'done' | 'cancelled' | 'declined' | 'no_show'

export type Booking = {
  id: string
  code: string
  starts_at: string
  ends_at: string
  status: BookingStatus
  service_id: string
  service: string
  branch_id?: string
  branch?: string | null
  barber_id: string | null
  barber: string | null
  price_centavos: number
  /** the shop's reason, when a request was declined */
  reason?: string | null
  /** a confirmed booking the customer asked to cancel; the shop hasn't answered yet */
  cancel_requested?: boolean
  /** the shop's reason when it kept a booking the customer asked to cancel */
  cancel_answer?: string | null
  /** on a request for a new time: the confirmed time it would replace */
  replaces_starts_at?: string | null
  /** on a confirmed booking: the new time asked for, while the shop decides */
  moving_to?: string | null
}

export type StaffRole = 'owner' | 'desk' | 'barber'

/** A customer's request as the desk sees it, with what helps to decide. */
export type BookingRequest = {
  id: string
  /** new = a first booking, move = a new time for a confirmed booking, cancel = asks to cancel a confirmed booking */
  kind: 'new' | 'move' | 'cancel'
  /** on a move: the confirmed time it would replace */
  replaces_starts_at: string | null
  code: string
  starts_at: string
  ends_at: string
  service: string
  price_centavos: number
  branch_id: string
  branch: string
  barber_id: string | null
  barber: string | null
  customer: string
  username: string | null
  mobile: string
  requested_at: string
  visits: number
  no_shows: number
  inspo: number
}

export type Theme = 'dark' | 'light' | 'system'
export type TimeFormat = '12h' | '24h'

export type Profile = {
  id: string
  /** public handle shown on reviews; older profiles may have none */
  username: string | null
  /** the name the shop calls you */
  full_name: string
  mobile: string
  avatar_path: string | null
  avatar_url: string | null
  preferred_barber: string | null
  theme: Theme
  time_format: TimeFormat
  promo_opt_in: boolean
  member_since: string
}

export type Settings = Pick<Profile, 'theme' | 'time_format' | 'preferred_barber' | 'promo_opt_in'>

/** What the sign-up form collected, kept on the login until the profile is made. */
export type SignupDetails = { username: string; full_name: string; mobile: string }

export type Session = { userId: string; email: string; pending: SignupDetails | null }

export type Rating = { average: number | null; reviews: number }

export type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  edited: boolean
  username: string | null
  mine: boolean
}

export type BarberReviews = { reviews: Review[]; can_review: boolean }

/** Same shape for a branch: the newest reviews and whether you may write one. */
export type BranchReviews = BarberReviews

/** A note sent from the contact form, as the owner or front desk sees it. */
export type ContactMessage = {
  id: string
  branch_id: string | null
  branch: string | null
  email: string | null
  mobile: string | null
  note: string
  created_at: string
  read: boolean
}

export type ContactForm = { email: string; mobile: string; note: string; branchId: string | null; consent: boolean }

/** A photo or short video the customer added to a booking for the barber. */
export type Inspo = { id: string; kind: 'image' | 'video'; url: string | null }

/** Everything the booking app asks of the backend. */
export type Api = {
  // public
  listServices(): Promise<Service[]>
  listBranches(): Promise<Branch[]>
  listBarbers(): Promise<Barber[]>
  openingHours(): Promise<OpeningHours[]>
  bookingRules(): Promise<BookingRules>
  /** Free start times (ISO strings) for a Manila date "YYYY-MM-DD". branchId null = every branch; barberId null = any barber. */
  freeSlots(serviceId: string, branchId: string | null, barberId: string | null, date: string): Promise<string[]>

  // account
  getSession(): Promise<Session | null>
  onSessionChange(listener: (session: Session | null) => void): () => void
  /** with an email, or a customer's username */
  signIn(login: string, password: string): Promise<Session>
  /** Returns needsConfirm = true when the account must click the email link first. */
  signUp(email: string, password: string, details: SignupDetails): Promise<{ needsConfirm: boolean }>
  /** True when nobody else has this username (and it has the right shape). */
  usernameAvailable(username: string): Promise<boolean>
  sendPasswordReset(email: string): Promise<void>
  /** Calls back when someone opens the "set a new password" link from their email. */
  onPasswordRecovery(listener: () => void): () => void
  updatePassword(password: string): Promise<void>
  /** Forget the sign-up details once the profile exists. */
  clearPending(): Promise<void>
  signOut(): Promise<void>

  // profile
  myProfile(): Promise<Profile | null>
  saveProfile(username: string, fullName: string, mobile: string, consent: boolean): Promise<Profile>
  setFavourite(barberId: string | null): Promise<Profile>
  saveSettings(settings: Settings): Promise<Profile>
  uploadAvatar(file: Blob): Promise<Profile>
  removeAvatar(): Promise<Profile>
  deleteMyData(): Promise<void>

  // bookings
  book(serviceId: string, branchId: string, barberId: string | null, startsAt: string): Promise<Booking>
  myBookings(): Promise<Booking[]>
  /** a waiting request is cancelled at once; a confirmed booking becomes a cancel request for the shop */
  cancelBooking(id: string): Promise<Booking>
  /** take back a cancel request the shop hasn't answered */
  keepBooking(id: string): Promise<Booking>
  rescheduleBooking(id: string, barberId: string | null, startsAt: string): Promise<Booking>

  // reviews
  barberRatings(): Promise<Record<string, Rating>>
  barberReviews(barberId: string): Promise<BarberReviews>
  reviewBarber(barberId: string, rating: number, comment: string): Promise<BarberReviews>
  removeMyReview(barberId: string): Promise<BarberReviews>
  branchRatings(): Promise<Record<string, Rating>>
  branchReviews(branchId: string): Promise<BranchReviews>
  reviewBranch(branchId: string, rating: number, comment: string): Promise<BranchReviews>
  removeMyBranchReview(branchId: string): Promise<BranchReviews>

  // contact form: anyone sends, owner and front desk read
  sendContactMessage(form: ContactForm): Promise<void>
  contactMessages(): Promise<ContactMessage[]>
  markContactMessage(id: string, read: boolean): Promise<void>

  // shop (owner and front desk)
  /** null for customers and anyone who isn't active staff */
  myStaffRole(): Promise<StaffRole | null>
  bookingRequests(): Promise<BookingRequest[]>
  confirmBooking(id: string): Promise<void>
  declineBooking(id: string, reason: string): Promise<void>
  approveCancel(id: string): Promise<void>
  /** keep the booking; the customer sees the reason */
  refuseCancel(id: string, reason: string): Promise<void>
  /** owner only: every number on the owner's home screen */
  ownerDashboard(days: 7 | 30 | 90): Promise<OwnerDashboard>

  // front desk: today's queue, walk-ins, sales, closing the day
  queueForDay(date: string): Promise<QueueItem[]>
  addWalkIn(name: string, serviceId: string, barberId: string | null): Promise<void>
  checkIn(id: string): Promise<void>
  /** barberId is needed for a walk-in that has no barber yet */
  startService(id: string, barberId: string | null): Promise<void>
  markNoShow(id: string): Promise<void>
  cancelAppointment(id: string, reason: string): Promise<void>
  listProducts(): Promise<Product[]>
  /** prices are looked up by the database; we only send what was sold */
  recordSale(sale: SaleInput): Promise<{ total_centavos: number; tips_centavos: number }>
  isDayClosed(date: string): Promise<boolean>
  /** blind count: the desk types what it counted; only the owner gets the differences back */
  closeDay(count: DayCount): Promise<CloseResult>

  // inspo on a booking
  listInspo(bookingId: string): Promise<Inspo[]>
  addInspo(bookingId: string, file: Blob, kind: Inspo['kind']): Promise<Inspo>
  removeInspo(id: string): Promise<void>
}

/** What owner_dashboard() returns. Money is centavos. */
export interface OwnerDashboard {
  days: number
  today: { revenue_centavos: number; sales: number }
  bookings_today: { total: number; done: number; no_show: number }
  waiting_requests: number
  period: { revenue_centavos: number; previous_centavos: number; expenses_centavos: number; sales: number }
  daily: { day: string; revenue_centavos: number }[]
  barbers: { name: string; services: number; revenue_centavos: number }[]
  services: { name: string; count: number }[]
  recent: { id: string; sold_at: string; total_centavos: number; items: string | null; barber: string | null; paid_by: string | null }[]
}

export type QueueStatus = 'requested' | 'booked' | 'checked_in' | 'in_chair' | 'done' | 'cancelled' | 'declined' | 'no_show'

/** One row of today's list at the desk (queue_for_day). */
export type QueueItem = {
  id: string
  code: string
  starts_at: string | null
  ends_at: string | null
  status: QueueStatus
  source: 'online' | 'desk' | 'walk_in'
  service_id: string
  service_name: string
  price_centavos: number
  branch_id: string
  barber_id: string | null
  barber_name: string | null
  customer_name: string
  customer_mobile: string | null
}

export type Product = { id: string; name: string; price_centavos: number; stock_qty: number }

export type PayMethod = 'cash' | 'gcash' | 'maya'

export type SaleInput = {
  appointmentId: string | null
  items: ({ service_id: string; barber_id: string } | { product_id: string; qty: number })[]
  payments: { method: PayMethod; amount_centavos: number; reference?: string }[]
  tips: { barber_id: string; amount_centavos: number }[]
}

export type DayCount = { cash_centavos: number; gcash_centavos: number; maya_centavos: number; note: string }

export type CloseResult = {
  closed: true
  /** owner only: counted minus expected */
  cash_difference_centavos?: number
  gcash_difference_centavos?: number
  maya_difference_centavos?: number
}
