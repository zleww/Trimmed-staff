import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// One client for the whole app. The publishable key is public on purpose;
// row-level security in the database decides what each person can see.
export const supabase: SupabaseClient | null = url && publishableKey ? createClient(url, publishableKey) : null
