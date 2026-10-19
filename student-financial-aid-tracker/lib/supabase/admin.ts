import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Service-role client. SERVER ONLY: bypasses Row Level Security.
// Use it only after verifying the caller is a Super Admin.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.startsWith('YOUR-')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
