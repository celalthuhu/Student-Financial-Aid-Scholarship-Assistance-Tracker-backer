'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl, getSupabaseEnv } from '@/lib/env';
import { loginSchema, resetRequestSchema } from '@/lib/validations/auth';
import { fieldErrorsOf } from '@/lib/utils';
import { ROLE_HOME, isAdminRole } from '@/lib/auth/permissions';
import type { ActionState } from '@/lib/types';

const SETUP_ERROR = 'Supabase is not configured. Add your project values to .env.local (see README.md) and restart the server.';

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!getSupabaseEnv()) return { error: SETUP_ERROR };

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  let destination = '';
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      if (error?.code === 'invalid_credentials' || error?.status === 400) {
        return {
          error: 'Email or password is incorrect. Confirm the account exists in this Supabase project and use its current password.',
        };
      }
      if (error?.code === 'email_not_confirmed') {
        return { error: 'This Supabase account exists but its email is not confirmed. Confirm it in Supabase Authentication > Users or resend the confirmation email.' };
      }
      if (!error || (error.status ?? 0) >= 500 || /fetch|network|timeout/i.test(error.message)) {
        return { error: 'Could not connect to Supabase Auth. Verify the project URL and anon key in .env.local, check the network, and restart the dev server.' };
      }
      console.error('Supabase sign-in failed:', error.message);
      return { error: 'Supabase could not complete sign-in. Check the project Auth configuration and try again.' };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role,is_active')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      await supabase.auth.signOut();
      console.error('Profile lookup failed:', profileError.message);
      if (profileError.code === 'PGRST205' || profileError.code === '42P01'
        || /schema cache|relation .*profiles.*does not exist/i.test(profileError.message)) {
        return { error: 'Supabase sign-in succeeded, but the profiles table is missing from the API schema. Apply supabase/schema.sql in this project and refresh the API schema cache.' };
      }
      return { error: 'Supabase sign-in succeeded, but the user profile could not be loaded. Check database connectivity and Row Level Security policies.' };
    }
    if (!profile) {
      await supabase.auth.signOut();
      return { error: 'This account exists in Supabase Auth but has no public.profiles record. Provision its profile before signing in.' };
    }
    if (!profile.is_active) {
      await supabase.auth.signOut();
      return { error: 'This account is deactivated. Contact the Super Admin.' };
    }
    if (!isAdminRole(profile.role)) {
      await supabase.auth.signOut();
      return { error: 'This account role is not enabled for live Supabase access. Contact the Super Admin to provision an authorized role.' };
    }
    destination = data.user.app_metadata?.require_password_change === true
      ? '/reset-password'
      : ROLE_HOME[profile.role];
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    console.error('Unexpected sign-in failure:', error);
    return { error: 'Could not complete sign-in because the Supabase connection or server configuration failed. Check the server logs and .env.local.' };
  }
  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  if (getSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect('/login');
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!getSupabaseEnv()) return { error: SETUP_ERROR };
  const parsed = resetRequestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the email exists, so accounts cannot be enumerated.
  return { message: 'If that email belongs to an administrator account, a reset link has been sent.' };
}
