import { redirect } from 'next/navigation';
import { PasswordForm } from '@/components/auth/password-form';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/env';

export default async function ResetPasswordPage() {
  if (!getSupabaseEnv()) redirect('/login');
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login?error=link');

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-softer px-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">Set a new password</h1>
        <p className="mb-5 mt-1 text-sm text-muted">Choose a password with at least 10 characters.</p>
        <PasswordForm redirectTo="/" submitLabel="Save password and continue" />
      </div>
    </div>
  );
}
