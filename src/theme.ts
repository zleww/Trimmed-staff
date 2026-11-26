// The staff app's own light/dark choice, saved on this device.
const KEY = 'trimmed-staff-theme'
export type StaffTheme = 'dark' | 'light'

export function savedStaffTheme(): StaffTheme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyStaffTheme(theme: StaffTheme = savedStaffTheme()) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#ececee' : '#09090b')
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // private browsing can block storage; the theme still applies for this visit
  }
}
