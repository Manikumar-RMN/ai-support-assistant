import { createClient } from '@supabase/supabase-js'

export function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error('Supabase environment variables are missing.')
  }

  return createClient(url, key)
}
