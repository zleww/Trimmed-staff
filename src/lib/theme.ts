import type { Theme } from './types'

const KEY = 'trimmed-theme'

export function savedTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'system' ? value : 'dark'
  } catch {
    return 'dark'
  }
}

/** Puts the theme on <html>, where the CSS variables read it. "system" follows the phone. */
export function applyTheme(theme: Theme = savedTheme()) {
  const light = theme === 'light' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches)
  document.documentElement.dataset.theme = light ? 'light' : 'dark'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f3eee4' : '#0b0a14')
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // private browsing can block storage; the theme still applies for this visit
  }
}
