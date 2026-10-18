'use client';

import { AlertTriangle } from 'lucide-react';

export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold">We could not load this page</h2>
      <p className="mt-2 text-sm text-muted">
        The data could not be read from Supabase. Check your connection and confirm that <code>supabase/schema.sql</code> has been applied, then try again.
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>}
      <button type="button" className="btn-primary mt-5" onClick={reset}>Try again</button>
    </div>
  );
}
