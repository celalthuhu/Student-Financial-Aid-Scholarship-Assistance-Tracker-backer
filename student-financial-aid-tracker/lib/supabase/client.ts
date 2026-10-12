import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseEnv } from '@/lib/env';

export function createClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error('Supabase environment variables are missing.');
  return createBrowserClient(env.url, env.key);
}
