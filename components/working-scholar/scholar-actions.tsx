'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/client-api';

export function ScholarActions({ id, status, name }: { id: string; status: 'ACTIVE' | 'INACTIVE'; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

  async function confirm() {
    setBusy(true); setError(null);
    const res = await api(`/api/scholars/${id}`, 'PATCH', { participation_status: next });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn-secondary btn-sm" onClick={() => { setError(null); setOpen(true); }}>{status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
      <ConfirmDialog
        open={open} loading={busy} error={error} danger={status === 'ACTIVE'}
        title={status === 'ACTIVE' ? 'Deactivate scholar?' : 'Activate scholar?'}
        message={status === 'ACTIVE' ? `${name} will stop occupying a slot.` : `${name} will occupy one slot. Activation fails if no slot is available.`}
        confirmLabel={status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        onConfirm={confirm} onCancel={() => setOpen(false)}
      />
    </>
  );
}
