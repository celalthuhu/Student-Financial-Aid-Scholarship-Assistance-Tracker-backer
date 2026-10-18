'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { passwordSchema } from '@/lib/validations/auth';
import { fieldErrorsOf } from '@/lib/utils';

export function PasswordForm({ redirectTo, submitLabel = 'Update password' }: { redirectTo?: string; submitLabel?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setSuccess(null); setFields({});
    const form = new FormData(e.currentTarget);
    const parsed = passwordSchema.safeParse({ password: form.get('password'), confirm: form.get('confirm') });
    if (!parsed.success) { setFields(fieldErrorsOf(parsed.error)); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? 'Could not update the password. Please try again.');
        return;
      }
      setSuccess('Your password has been updated.');
      (e.target as HTMLFormElement).reset();
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      }
    } catch {
      setError('Could not update the password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-brand-light p-3 text-sm text-brand-deep">{success}</p>}
      <div>
        <label htmlFor="new-password" className="label">New password</label>
        <input id="new-password" name="password" type="password" autoComplete="new-password" className="input" />
        {fields.password && <p className="field-error">{fields.password}</p>}
      </div>
      <div>
        <label htmlFor="confirm-password" className="label">Confirm new password</label>
        <input id="confirm-password" name="confirm" type="password" autoComplete="new-password" className="input" />
        {fields.confirm && <p className="field-error">{fields.confirm}</p>}
      </div>
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}{submitLabel}
      </button>
    </form>
  );
}
