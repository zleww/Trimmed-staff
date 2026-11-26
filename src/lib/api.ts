import { createSupabaseApi } from './api.supabase'
import { supabase } from './supabase'
import type { Api } from './types'

// The one object every screen talks to. With keys in .env.local it's the real
// database. Without keys, `npm run dev` uses sample data so the screens can be
// worked on. The sample data is only loaded in development, and a production
// build without keys refuses to start instead of showing fake data.
async function pickApi(): Promise<Api> {
  if (supabase) return createSupabaseApi(supabase)
  if (import.meta.env.DEV) return (await import('./api.demo')).demoApi
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY for this build.')
}

export const api: Api = await pickApi()

/** True when the screens are running on sample data (development only). */
export const isDemo = !supabase
