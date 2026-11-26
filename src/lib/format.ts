/** 25000 -> "₱250", 25050 -> "₱250.50" */
export function peso(centavos: number): string {
  const whole = centavos % 100 === 0
  return `₱${(centavos / 100).toLocaleString('en-PH', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

/** 30 -> "30 min", 60 -> "1 hr", 75 -> "1 hr 15 min" */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

/** "09171234567" -> "0917 123 4567" */
export function prettyMobile(mobile: string): string {
  return mobile.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3')
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

export function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Something went wrong. Please try again.'
}

/** "+63 917 123 4567" or "0917-123-4567" -> "09171234567", or null if it isn't a PH mobile */
export function cleanMobile(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^63/, '0')
  return /^09\d{9}$/.test(digits) ? digits : null
}

/** Same rule as the database: 3 to 20 lowercase letters, numbers, dots or underscores. */
export function cleanUsername(input: string): string | null {
  const name = input.trim().toLowerCase()
  return /^[a-z0-9._]{3,20}$/.test(name) ? name : null
}

/** At least 10 characters with a letter and a number. Returns the problem, or null when fine. */
export function passwordProblem(password: string): string | null {
  return /^(?=.*[A-Za-z])(?=.*\d).{10,}$/.test(password) ? null : 'Use at least 10 characters, with letters and numbers.'
}
