'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEMO_ACCOUNTS } from '@/lib/demo-accounts';

export function DemoLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function signIn() {
    const role = DEMO_ACCOUNTS.find((account) => account.email === email)?.role;
    if (!role) {
      setError('Choose a demo account first.');
      return;
    }
    setError('');
    setPending(true);
    try {
      const response = await fetch('/api/demo/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, accessCode }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? 'Demo sign-in failed. Please try again.');
        return;
      }
      router.push('/demo/dashboard');
    } catch {
      setError('The local demo server could not be reached. Check that npm run dev is running.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-brand/20 bg-brand-softer/60 p-4" aria-label="Local demo sign in">
      <h2 className="font-semibold text-ink">Try the local demo</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Select a demo identity to open its role-specific dashboard. Demo data is separate from Supabase.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="demo-email" className="label">Demo account</label>
          <select id="demo-email" className="input" value={email} onChange={(event) => {
            setEmail(event.target.value);
            setError('');
          }} required>
            <option value="">Choose a role</option>
            {DEMO_ACCOUNTS.map((account) => <option key={account.email} value={account.email}>{account.label}</option>)}
          </select>
        </div>
        {process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED === 'true' && (
          <div>
            <label htmlFor="demo-access-code" className="label">Demo access code</label>
            <input id="demo-access-code" className="input" type="password" autoComplete="off" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} />
          </div>
        )}
        {error && <p role="alert" className="field-error">{error}</p>}
        <button type="button" className="btn-secondary w-full" onClick={signIn} disabled={pending || !email}>
          {pending ? 'Opening demo…' : `Continue as ${DEMO_ACCOUNTS.find((account) => account.email === email)?.label ?? 'demo user'}`}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button key={account.role} type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => {
            setEmail(account.email);
            setError('');
            void (async () => {
              setPending(true);
              try {
                const response = await fetch('/api/demo/session', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ role: account.role, accessCode }),
                });
                const result = await response.json() as { error?: string };
                if (!response.ok) throw new Error(result.error ?? 'Demo sign-in failed.');
                router.push('/demo/dashboard');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'The local demo server could not be reached.');
              } finally {
                setPending(false);
              }
            })();
          }}>
            Sign in: {account.label}
          </button>
        ))}
      </div>
    </section>
  );
}
