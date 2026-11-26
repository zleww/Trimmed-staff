import type { AuthError, PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Api, Barber, BarberReviews, Branch, BranchReviews, Booking, BookingRequest, ContactMessage, BranchStats, CloseResult, Earnings, InventoryItem, Inspo, OwnerDashboard, Product, Profile, QueueItem, Rating, StaffMember, Session, SignupDetails, StaffRole } from './types'

// Turns database and sign-in errors into plain sentences.
// Our own database functions already raise plain messages (code P0001), so
// those are shown as they are. Anything else gets a general message, never the
// raw database text.
function friendly(error: PostgrestError | AuthError | Error): Error {
  const code = 'code' in error ? error.code : undefined
  const message = error.message ?? ''
  if (code === 'P0001') return new Error(message)
  // the unique rule on usernames, if two people grab the same one at once
  if (code === '23505' && /username/i.test(message)) return new Error('That username is taken. Try another.')
  if (code === '42501') return new Error("You don't have access to that.")
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return new Error('Wrong email or password.')
  }
  if (code === 'email_not_confirmed') return new Error('Confirm your email first. Check your inbox for the link.')
  if (code === 'user_already_exists') return new Error('There is already an account with that email. Sign in instead.')
  if (code === 'weak_password') return new Error('Pick a stronger password: at least 10 characters with letters and numbers.')
  if (code === 'same_password') return new Error('Pick a password different from your old one.')
  if (code === 'reauthentication_needed') return new Error('For safety, sign in again before changing your password.')
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
    return new Error('Too many tries. Wait a few minutes and try again.')
  }
  if (/fetch|network/i.test(message)) return new Error("Can't reach the server. Check your connection.")
  return new Error('Something went wrong. Please try again.')
}

function check<T>(result: { data: T; error: PostgrestError | null }): T {
  if (result.error) throw friendly(result.error)
  return result.data
}

const AVATARS = 'avatars'
const BARBER_PHOTOS = 'barber-photos'
const INSPO = 'inspo'

type User = { id: string; email?: string; user_metadata?: Record<string, unknown> } | null | undefined

// the sign-up form's details ride along on the login until the profile is made
function pendingFrom(user: User): SignupDetails | null {
  const raw = user?.user_metadata?.signup as Partial<SignupDetails> | undefined
  if (!raw || typeof raw.username !== 'string' || typeof raw.full_name !== 'string' || typeof raw.mobile !== 'string') return null
  return { username: raw.username, full_name: raw.full_name, mobile: raw.mobile }
}

export function createSupabaseApi(db: SupabaseClient): Api {

  // staff logins go through the "staff-admin" server function, which holds the secret key
  async function staffAdmin(body: Record<string, unknown>) {
    const { data } = await db.auth.getSession()
    let answer: { error?: string }
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staff-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
          Authorization: `Bearer ${data.session?.access_token ?? ''}`,
        },
        body: JSON.stringify(body),
      })
      answer = await response.json().catch(() => ({ error: 'Staff accounts are not working right now. Try again later.' }))
      if (!response.ok) throw new Error(answer.error ?? 'Something went wrong. Try again.')
    } catch (error) {
      if (error instanceof TypeError) throw new Error("Can't reach the server. Check your connection.")
      throw error
    }
  }
  const toSession = (user: User): Session | null =>
    user ? { userId: user.id, email: user.email ?? '', pending: pendingFrom(user) } : null

  async function myUserId(): Promise<string> {
    const { data } = await db.auth.getUser()
    if (!data.user) throw new Error('Sign in first.')
    return data.user.id
  }

  // private files open through a link that works for an hour
  async function signedUrl(bucket: string, path: string): Promise<string | null> {
    const { data } = await db.storage.from(bucket).createSignedUrl(path, 3600)
    return data?.signedUrl ?? null
  }

  // The photo bucket is private, so the app gets a link that works for an hour.
  async function withAvatarUrl(raw: Omit<Profile, 'avatar_url'> | null): Promise<Profile | null> {
    if (!raw) return null
    let avatar_url: string | null = null
    if (raw.avatar_path) {
      const { data } = await db.storage.from(AVATARS).createSignedUrl(raw.avatar_path, 3600)
      avatar_url = data?.signedUrl ?? null
    }
    return { ...raw, avatar_url }
  }

  async function profileOrFail(raw: Omit<Profile, 'avatar_url'>): Promise<Profile> {
    const profile = await withAvatarUrl(raw)
    if (!profile) throw new Error('Something went wrong. Please try again.')
    return profile
  }

  return {
    async listServices() {
      const rows = check(
        await db
          .from('services')
          .select('id, name, description, duration_minutes, price_centavos')
          .eq('active', true)
          .order('sort')
          .order('name'),
      )
      return rows ?? []
    },

    async listBranches() {
      const rows = check(await db.from('branches').select('id, name, address, phone, description').eq('active', true).order('sort').order('name'))
      return (rows ?? []) as Branch[]
    },

    async listBarbers() {
      const rows = check(
        await db.from('barbers').select('id, branch_id, display_name, bio, photo_path').eq('active', true).order('sort'),
      ) as (Omit<Barber, 'photo_url'> & { photo_path: string | null })[]
      return rows.map(({ photo_path, ...barber }) => ({
        ...barber,
        photo_url: photo_path ? db.storage.from(BARBER_PHOTOS).getPublicUrl(photo_path).data.publicUrl : null,
      }))
    },

    async openingHours() {
      return check(await db.rpc('public_shop_hours'))
    },

    async bookingRules() {
      const rows = check(await db.rpc('booking_rules'))
      return rows[0]
    },

    async freeSlots(serviceId, branchId, barberId, date) {
      const rows = check(
        await db.rpc('get_free_slots', { p_service: serviceId, p_branch: branchId, p_barber: barberId, p_date: date }),
      ) as {
        starts_at: string
      }[]
      return rows.map((row) => row.starts_at)
    },

    async getSession() {
      const { data } = await db.auth.getSession()
      return toSession(data.session?.user)
    },

    onSessionChange(listener) {
      const { data } = db.auth.onAuthStateChange((_event, session) => listener(toSession(session?.user)))
      return () => data.subscription.unsubscribe()
    },

    async signIn(login, password) {
      // an email signs in directly, as before
      if (login.includes('@')) {
        const { data, error } = await db.auth.signInWithPassword({ email: login, password })
        if (error) throw friendly(error)
        const session = toSession(data.user)
        if (!session) throw new Error('Something went wrong. Please try again.')
        return session
      }
      // a username goes through the "username-sign-in" Edge Function, which finds the email
      // on the server (it never comes back to the browser) and returns the sign-in tokens
      let answer: { access_token?: string; refresh_token?: string; error?: string }
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/username-sign-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '' },
          body: JSON.stringify({ username: login, password }),
        })
        answer = await response.json().catch(() => ({ error: 'Sign-in is not working right now. Try your email instead.' }))
      } catch {
        throw new Error("Can't reach the server. Check your connection.")
      }
      if (!answer.access_token || !answer.refresh_token) {
        throw new Error(answer.error ?? 'Sign-in is not working right now. Try your email instead.')
      }
      const { data, error } = await db.auth.setSession({ access_token: answer.access_token, refresh_token: answer.refresh_token })
      if (error) throw friendly(error)
      const session = toSession(data.user)
      if (!session) throw new Error('Something went wrong. Please try again.')
      return session
    },

    async signUp(email, password, details) {
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/welcome`, data: { signup: details } },
      })
      if (error) throw friendly(error)
      return { needsConfirm: !data.session }
    },

    async usernameAvailable(username) {
      return check(await db.rpc('username_available', { p_username: username })) as boolean
    },

    async sendPasswordReset(email) {
      // the link lands on the page that asks for the new password
      const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/new-password`,
      })
      if (error) throw friendly(error)
    },

    onPasswordRecovery(listener) {
      const { data } = db.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') listener()
      })
      return () => data.subscription.unsubscribe()
    },

    async updatePassword(password) {
      const { error } = await db.auth.updateUser({ password })
      if (error) throw friendly(error)
    },

    async clearPending() {
      await db.auth.updateUser({ data: { signup: null } })
    },

    async signOut() {
      await db.auth.signOut()
    },

    async myProfile() {
      return withAvatarUrl(check(await db.rpc('my_profile')))
    },

    async saveProfile(username, fullName, mobile, consent) {
      check(
        await db.rpc('save_my_profile', { p_username: username, p_full_name: fullName, p_mobile: mobile, p_consent: consent }),
      )
      return profileOrFail(check(await db.rpc('my_profile')))
    },

    async setFavourite(barberId) {
      return profileOrFail(check(await db.rpc('set_favourite_barber', { p_barber: barberId })))
    },

    async saveSettings(settings) {
      return profileOrFail(
        check(
          await db.rpc('save_my_settings', {
            p_theme: settings.theme,
            p_time_format: settings.time_format,
            p_preferred_barber: settings.preferred_barber,
            p_promo_opt_in: settings.promo_opt_in,
          }),
        ),
      )
    },

    async uploadAvatar(file) {
      const uid = await myUserId()
      // a new file name each time, so an old cached photo never shows
      const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp'
      const path = `${uid}/avatar-${Date.now()}.${type === 'image/jpeg' ? 'jpg' : 'webp'}`
      const upload = await db.storage.from(AVATARS).upload(path, file, { contentType: type, upsert: false })
      if (upload.error) throw new Error("Couldn't upload the photo. Use a JPG, PNG or WebP under 2 MB.")
      const before = check(await db.rpc('my_profile')) as Profile | null
      const after = check(await db.rpc('set_my_avatar', { p_path: path }))
      if (before?.avatar_path) await db.storage.from(AVATARS).remove([before.avatar_path])
      return profileOrFail(after)
    },

    async removeAvatar() {
      const before = check(await db.rpc('my_profile')) as Profile | null
      const after = check(await db.rpc('set_my_avatar', { p_path: null }))
      if (before?.avatar_path) await db.storage.from(AVATARS).remove([before.avatar_path])
      return profileOrFail(after)
    },

    async deleteMyData() {
      const before = check(await db.rpc('my_profile')) as Profile | null
      if (before?.avatar_path) await db.storage.from(AVATARS).remove([before.avatar_path])
      // inspo files sit in the customer's own folder
      const uid = await myUserId()
      const { data: files } = await db.storage.from(INSPO).list(uid, { limit: 1000 })
      if (files?.length) await db.storage.from(INSPO).remove(files.map((f) => `${uid}/${f.name}`))
      check(await db.rpc('delete_my_data'))
      await db.auth.signOut()
    },

    async book(serviceId, branchId, barberId, startsAt) {
      return check(
        await db.rpc('book_appointment', { p_service: serviceId, p_branch: branchId, p_barber: barberId, p_starts_at: startsAt }),
      ) as Booking
    },

    async myBookings() {
      return check(await db.rpc('my_bookings')) as Booking[]
    },

    async cancelBooking(id) {
      return check(await db.rpc('cancel_my_booking', { p_id: id })) as Booking
    },

    async keepBooking(id) {
      return check(await db.rpc('keep_my_booking', { p_id: id })) as Booking
    },

    async rescheduleBooking(id, barberId, startsAt) {
      return check(
        await db.rpc('reschedule_my_booking', { p_id: id, p_barber: barberId, p_starts_at: startsAt }),
      ) as Booking
    },

    async barberRatings() {
      const rows = check(await db.rpc('barber_ratings')) as { barber_id: string; average: number | null; reviews: number }[]
      const out: Record<string, Rating> = {}
      for (const row of rows) out[row.barber_id] = { average: row.average === null ? null : Number(row.average), reviews: row.reviews }
      return out
    },

    async barberReviews(barberId) {
      return check(await db.rpc('barber_reviews', { p_barber: barberId })) as BarberReviews
    },

    async reviewBarber(barberId, rating, comment) {
      return check(await db.rpc('review_barber', { p_barber: barberId, p_rating: rating, p_comment: comment })) as BarberReviews
    },

    async removeMyReview(barberId) {
      return check(await db.rpc('remove_my_review', { p_barber: barberId })) as BarberReviews
    },

    async branchRatings() {
      const rows = check(await db.rpc('branch_ratings')) as { branch_id: string; average: number | null; reviews: number }[]
      const out: Record<string, Rating> = {}
      for (const row of rows) out[row.branch_id] = { average: row.average === null ? null : Number(row.average), reviews: row.reviews }
      return out
    },

    async branchReviews(branchId) {
      return check(await db.rpc('branch_reviews', { p_branch: branchId })) as BranchReviews
    },

    async reviewBranch(branchId, rating, comment) {
      return check(await db.rpc('review_branch', { p_branch: branchId, p_rating: rating, p_comment: comment })) as BranchReviews
    },

    async removeMyBranchReview(branchId) {
      return check(await db.rpc('remove_my_branch_review', { p_branch: branchId })) as BranchReviews
    },

    async sendContactMessage(form) {
      check(
        await db.rpc('send_contact_message', {
          p_email: form.email || null,
          p_mobile: form.mobile || null,
          p_note: form.note,
          p_branch: form.branchId,
          p_consent: form.consent,
        }),
      )
    },

    async contactMessages() {
      return check(await db.rpc('contact_messages')) as ContactMessage[]
    },

    async markContactMessage(id, read) {
      check(await db.rpc('mark_contact_message', { p_id: id, p_read: read }))
    },

    async myStaffRole() {
      return (check(await db.rpc('my_staff_role')) as StaffRole | null) ?? null
    },

    async bookingRequests() {
      return check(await db.rpc('booking_requests')) as BookingRequest[]
    },

    async confirmBooking(id) {
      check(await db.rpc('confirm_booking', { p_id: id }))
    },

    async declineBooking(id, reason) {
      check(await db.rpc('decline_booking', { p_id: id, p_reason: reason }))
    },

    async approveCancel(id) {
      check(await db.rpc('approve_cancel', { p_id: id }))
    },

    async refuseCancel(id, reason) {
      check(await db.rpc('refuse_cancel', { p_id: id, p_reason: reason }))
    },

    async ownerDashboard(days) {
      return check(await db.rpc('owner_dashboard', { p_days: days })) as OwnerDashboard
    },

    async queueForDay(date) {
      return check(await db.rpc('queue_for_day', { p_date: date })) as QueueItem[]
    },

    async addWalkIn(name, serviceId, barberId) {
      check(await db.rpc('add_walk_in', { p_guest_name: name, p_service: serviceId, p_barber: barberId }))
    },

    async checkIn(id) {
      check(await db.rpc('check_in', { p_id: id }))
    },

    async startService(id, barberId) {
      check(await db.rpc('start_service', { p_id: id, p_barber: barberId }))
    },

    async markNoShow(id) {
      check(await db.rpc('mark_no_show', { p_id: id }))
    },

    async cancelAppointment(id, reason) {
      check(await db.rpc('cancel_appointment', { p_id: id, p_reason: reason }))
    },

    async listProducts() {
      return check(await db.from('products').select('id, name, price_centavos, stock_qty').eq('active', true).order('name')) as Product[]
    },

    async recordSale(sale) {
      return check(
        await db.rpc('record_sale', {
          p_appointment: sale.appointmentId,
          p_items: sale.items,
          p_payments: sale.payments,
          p_tips: sale.tips,
        }),
      ) as { total_centavos: number; tips_centavos: number }
    },

    async myEarnings(from, to) {
      return check(await db.rpc('my_earnings', { p_from: from, p_to: to })) as Earnings
    },

    async isDayClosed(date) {
      return check(await db.rpc('is_day_closed', { p_date: date })) as boolean
    },

    async closeDay(count) {
      return check(
        await db.rpc('close_day', {
          p_cash: count.cash_centavos,
          p_gcash: count.gcash_centavos,
          p_maya: count.maya_centavos,
          p_note: count.note || null,
        }),
      ) as CloseResult
    },

    async needsSignInCode() {
      const { data } = await db.auth.mfa.getAuthenticatorAssuranceLevel()
      return data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2'
    },

    async verifySignInCode(code) {
      const { data: factors, error } = await db.auth.mfa.listFactors()
      if (error) throw friendly(error)
      const factor = factors?.totp.find((item) => item.status === 'verified')
      if (!factor) throw new Error('No authenticator app is set up for this account.')
      const result = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() })
      if (result.error) throw new Error('That code is wrong or too old. Type the newest code from the app.')
    },

    async twoStepStatus() {
      const { data, error } = await db.auth.mfa.listFactors()
      if (error) throw friendly(error)
      return { on: Boolean(data?.totp.some((item) => item.status === 'verified')) }
    },

    async startTwoStep() {
      // clear any half-finished setup first, so a new QR code can be made
      const { data: factors } = await db.auth.mfa.listFactors()
      for (const factor of factors?.all ?? []) {
        if (factor.status !== 'verified') await db.auth.mfa.unenroll({ factorId: factor.id })
      }
      const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Trimmed staff' })
      if (error || !data) throw new Error("Couldn't start the setup. Try again.")
      const svg = data.totp.qr_code
      return {
        factorId: data.id,
        qrCode: svg.startsWith('data:') ? svg : `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
        secret: data.totp.secret,
      }
    },

    async confirmTwoStep(factorId, code) {
      const { error } = await db.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
      if (error) throw new Error('That code is wrong or too old. Type the newest code from the app.')
    },

    async turnOffTwoStep() {
      const { data: factors, error } = await db.auth.mfa.listFactors()
      if (error) throw friendly(error)
      for (const factor of factors?.all ?? []) {
        const result = await db.auth.mfa.unenroll({ factorId: factor.id })
        if (result.error) throw new Error("Couldn't turn it off. Sign out, sign in again with your code, and try again.")
      }
      // a fresh token that no longer carries the old sign-in level
      await db.auth.refreshSession()
    },

    async staffList() {
      return check(await db.rpc('staff_list')) as StaffMember[]
    },

    async createStaff(input) {
      await staffAdmin({ action: 'create', ...input })
    },

    async updateStaff(id, fullName, branchId) {
      check(await db.rpc('update_staff', { p_id: id, p_full_name: fullName, p_branch: branchId }))
    },

    async setStaffPassword(id, password) {
      await staffAdmin({ action: 'set_password', staffId: id, password })
    },

    async setStaffActive(id, active) {
      await staffAdmin({ action: 'set_active', staffId: id, active })
    },

    async branchStats(days) {
      return check(await db.rpc('branch_stats', { p_days: days })) as BranchStats[]
    },

    async inventory() {
      return check(
        await db.from('products').select('id, name, price_centavos, stock_qty, low_stock_at, active').order('active', { ascending: false }).order('name'),
      ) as InventoryItem[]
    },

    async saveProduct(product) {
      const fields = { name: product.name, price_centavos: product.price_centavos, low_stock_at: product.low_stock_at, active: product.active }
      if (product.id) check(await db.from('products').update(fields).eq('id', product.id))
      else check(await db.from('products').insert(fields))
    },

    async stockIn(id, qty, note) {
      check(await db.rpc('stock_in', { p_product: id, p_qty: qty, p_note: note || null }))
    },

    async adjustStock(id, counted, reason) {
      check(await db.rpc('adjust_stock', { p_product: id, p_counted: counted, p_reason: reason }))
    },

    async listInspo(bookingId) {
      const rows = check(await db.rpc('booking_inspo', { p_appointment: bookingId })) as { id: string; path: string; kind: Inspo['kind'] }[]
      return Promise.all(rows.map(async (row) => ({ id: row.id, kind: row.kind, url: await signedUrl(INSPO, row.path) })))
    },

    async addInspo(bookingId, file, kind) {
      const uid = await myUserId()
      const ext = ({ 'image/webp': 'webp', 'image/jpeg': 'jpg', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' } as Record<string, string>)[file.type]
      if (!ext) throw new Error('Use a photo, or an MP4, MOV or WebM video.')
      const path = `${uid}/${bookingId}-${crypto.randomUUID()}.${ext}`
      const upload = await db.storage.from(INSPO).upload(path, file, { contentType: file.type, upsert: false })
      if (upload.error) throw new Error("Couldn't upload that file. Keep videos short (under 30 seconds) and try again.")
      try {
        const row = check(await db.rpc('add_booking_inspo', { p_appointment: bookingId, p_path: path, p_kind: kind })) as { id: string }
        return { id: row.id, kind, url: await signedUrl(INSPO, path) }
      } catch (error) {
        // the booking refused it (full, or not yours): don't leave the file behind
        await db.storage.from(INSPO).remove([path])
        throw error
      }
    },

    async removeInspo(id) {
      const path = check(await db.rpc('remove_booking_inspo', { p_id: id })) as string
      await db.storage.from(INSPO).remove([path])
    },
  }
}
