import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `npm run dev:sample` skips .env.local, so the screens run on sample data
// without touching the real database. A build in this mode has no keys and refuses to start.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  envDir: mode === 'sample' ? false : undefined,
}))
