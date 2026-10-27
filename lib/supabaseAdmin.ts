import { createClient } from '@supabase/supabase-js'
import { FRONTEND_ONLY, offlineFetch } from './frontendOnly'

// Server-side only — never import in client components or expose to browser
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false }, ...(FRONTEND_ONLY && { global: { fetch: offlineFetch } }) }
)
