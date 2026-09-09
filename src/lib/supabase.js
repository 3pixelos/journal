import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Create a .env.local with VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY (see .env.example), then restart the dev server.'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const SCREENSHOT_BUCKET = 'trade-screenshots'
