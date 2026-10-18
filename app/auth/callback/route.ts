import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/env';

// Handles password-reset and invite links (PKCE `code` or email `token_hash`).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  if (!getSupabaseEnv()) return NextResponse.redirect(`${origin}/login?error=config`);

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const rawNext = searchParams.get('next') ?? '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  const supabase = await createClient();
  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  }
  return NextResponse.redirect(`${origin}${ok ? next : '/login?error=link'}`);
}
