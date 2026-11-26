import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyStaffTheme } from './theme'

// set the saved theme before the first paint
applyStaffTheme()

const root = document.getElementById('root')!

// load after the setup check, so a missing setting shows a message, not a blank page
import('./App')
  .then(({ default: App }) => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((error: unknown) => {
    const message = document.createElement('p')
    message.className = 'mx-auto max-w-md px-6 py-20 text-center text-[15px] text-ink-2'
    message.textContent =
      error instanceof Error && error.message.startsWith('Missing VITE_')
        ? 'The staff app is not connected to the database yet.'
        : "The app couldn't load. Reload and try again."
    root.replaceChildren(message)
  })
