'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/client-api';

export function ResolveFollowUpButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(note: string) {
    setBusy(true); setError(null);
    const res = await api(`/api/follow-ups/${id}`, 'PATCH', { resolution_note: note || undefined });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn-secondary btn-sm" onClick={() => { setError(null); setOpen(true); }}>Mark resolved</button>
      <ConfirmDialog
        open={open} loading={busy} error={error} title="Mark follow-up as resolved?"
        message="If this was the last open follow-up, the application returns to Under Review."
        confirmLabel="Mark resolved" reasonLabel="Resolution note (optional)"
        onConfirm={resolve} onCancel={() => setOpen(false)}
      />
    </>
  );
}
