import { redirect } from 'next/navigation';
import { GraduationCap, ShieldCheck, TriangleAlert } from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';
import { getSupabaseEnv } from '@/lib/env';
import { getCurrentAdmin, ROLE_HOME } from '@/lib/auth/permissions';
import { logoutAction } from '@/lib/auth/actions';
import { createClient } from '@/lib/supabase/server';

const ERRORS: Record<string, string> = {
  unauthorized: 'Your account is inactive or is not authorized for the administrator area. Sign in with an active administrator account.',
  link: 'That sign-in link is invalid or has expired. Request a new one.',
  config: 'The system is not connected to Supabase yet.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const env = getSupabaseEnv();
  let staleSession = false;

  if (env) {
    const ctx = await getCurrentAdmin();
    if (ctx?.user.app_metadata?.require_password_change === true) redirect('/reset-password');
    if (ctx) redirect(ROLE_HOME[ctx.profile.role]);
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    staleSession = !!data.user;
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-deep via-sky-500 to-brand p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
          <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/10" />
          <div className="absolute right-16 top-1/2 h-40 w-40 rotate-12 rounded-3xl border border-white/30" />
          <div className="absolute bottom-40 right-40 h-20 w-20 rounded-full border border-white/30" />
        </div>
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand-deep"><GraduationCap className="h-6 w-6" /></div>
          <span className="text-lg font-semibold">Aid Tracker</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight">Student Financial Aid &amp; Scholarship Assistance Tracker</h1>
          <p className="mt-4 text-sky-50">Review applications, follow up on requirements and keep working scholar slots accurate, all in one place.</p>
        </div>
        <p className="relative flex items-center gap-2 text-sm text-sky-50"><ShieldCheck className="h-4 w-4" />Secure role-based access</p>
      </section>

      <section className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-deep text-white"><GraduationCap className="h-5 w-5" /></div>
            <span className="font-semibold">Student Financial Aid Tracker</span>
          </div>

          {!env && (
            <div role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-semibold"><TriangleAlert className="h-4 w-4" />Supabase is not configured</p>
              <p className="mt-2">Configure your Supabase URL and anon or publishable key in .env.local for live email-and-password authentication and database access.</p>
            </div>
          )}
          {env && (
            <>
              {error && ERRORS[error] && <p role="alert" className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{ERRORS[error]}</p>}
              <LoginForm />
              {staleSession && (
                <form action={logoutAction} className="mt-6 border-t border-line pt-4 text-center text-sm text-muted">
                  You are signed in with an account that has no administrator access.{' '}
                  <button type="submit" className="font-medium text-brand-deep hover:underline">Sign out</button>
                </form>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
