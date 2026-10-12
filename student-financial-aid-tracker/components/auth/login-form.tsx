'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { loginAction, requestPasswordReset } from '@/lib/auth/actions';
import type { ActionState } from '@/lib/types';

const initial: ActionState = {};

export function LoginForm() {
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [show, setShow] = useState(false);
  const [loginState, loginDispatch, loginPending] = useActionState(loginAction, initial);
  const [resetState, resetDispatch, resetPending] = useActionState(requestPasswordReset, initial);

  if (mode === 'reset') {
    return (
      <form action={resetDispatch} className="space-y-5" noValidate>
        <div>
          <h2 className="text-2xl font-semibold">Reset your password</h2>
          <p className="mt-1 text-sm text-muted">Enter your account email and we will send a reset link.</p>
        </div>
        {resetState.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{resetState.error}</p>}
        {resetState.message && <p role="status" className="rounded-lg bg-brand-light p-3 text-sm text-brand-deep">{resetState.message}</p>}
        <div>
          <label htmlFor="reset-email" className="label">Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input id="reset-email" name="email" type="email" autoComplete="email" required className="input pl-9" placeholder="you@school.edu" />
          </div>
          {resetState.fieldErrors?.email && <p className="field-error">{resetState.fieldErrors.email}</p>}
        </div>
        <button type="submit" className="btn-primary w-full" disabled={resetPending}>
          {resetPending && <Loader2 className="h-4 w-4 animate-spin" />}Send reset link
        </button>
        <button type="button" className="w-full text-sm font-medium text-brand-deep hover:underline" onClick={() => setMode('login')}>
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form action={loginDispatch} className="space-y-5" noValidate>
      <div>
        <h2 className="text-2xl font-semibold">Account sign in</h2>
        <p className="mt-1 text-sm text-muted">Sign in with your Supabase email and password.</p>
      </div>
      {loginState.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{loginState.error}</p>}
      <div>
        <label htmlFor="email" className="label">Email</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input id="email" name="email" type="email" autoComplete="email" required className="input pl-9" placeholder="you@school.edu" />
        </div>
        {loginState.fieldErrors?.email && <p className="field-error">{loginState.fieldErrors.email}</p>}
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required className="input px-9" />
          <button
            type="button" onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1.5 rounded p-1 text-muted hover:text-ink"
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {loginState.fieldErrors?.password && <p className="field-error">{loginState.fieldErrors.password}</p>}
      </div>
      <button type="submit" className="btn-primary w-full" disabled={loginPending}>
        {loginPending && <Loader2 className="h-4 w-4 animate-spin" />}{loginPending ? 'Signing in…' : 'Sign in'}
      </button>
      <button type="button" className="w-full text-sm font-medium text-brand-deep hover:underline" onClick={() => setMode('reset')}>
        Forgot your password?
      </button>
    </form>
  );
}
