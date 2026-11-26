// Every date the customer sees is Manila time, whatever the phone's own time zone is.
// Dates are kept as "YYYY-MM-DD" strings; moments as ISO strings from the database.
// Manila has no daylight saving, so it is always UTC+08:00.

const TZ = 'Asia/Manila'

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

/** Today's date in Manila, like "2026-11-19". */
export function manilaToday(): string {
  return ymd.format(new Date())
}

/** The Manila date of a moment. 11:30 PM in Manila is still that day. */
export function manilaDateOf(iso: string): string {
  return ymd.format(new Date(iso))
}

/** A Manila date plus a wall-clock time ("09:00" or "09:00:00") as a real moment. */
export function manilaWallClock(date: string, time: string): Date {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}+08:00`)
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 0 = Sunday, like the database. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function formatTime(iso: string, timeFormat: '12h' | '24h' = '12h'): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: timeFormat === '12h',
  }).format(new Date(iso))
}

/** "09:00:00" -> "9:00 AM" (or "09:00"). */
export function formatClock(time: string, timeFormat: '12h' | '24h' = '12h'): string {
  return formatTime(manilaWallClock('2026-01-01', time).toISOString(), timeFormat)
}

/** "Thu, Nov 20" */
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(
    new Date(`${date}T00:00:00Z`),
  )
}

/** "Thursday, November 20" */
export function formatDayLong(date: string): string {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(
    new Date(`${date}T00:00:00Z`),
  )
}

/** "Today", "Tomorrow", or "Thu, Nov 20" */
export function relativeDay(date: string): string {
  const today = manilaToday()
  if (date === today) return 'Today'
  if (date === addDays(today, 1)) return 'Tomorrow'
  return formatDay(date)
}
