'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/client-api';

export function SlotForm({ maxSlots, open, activeScholars }: { maxSlots: number; open: boolean; activeScholars: number }) {
  const router = useRouter();
  const [max, setMax] = useState(String(maxSlots));
  const [isOpen, setIsOpen] = useState(open);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true); setError(null); setSaved(false);
    const res = await api('/api/slots', 'POST', { max_slots: max, applications_open: isOpen, note: note || null });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setConfirming(false); setSaved(true); setNote('');
    router.refresh();
  }

  return (
    <section className="card self-start">
      <h2 className="border-b border-line px-4 py-3 font-semibold">Update slot settings</h2>
      <form className="space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); setError(null); setConfirming(true); }}>
        <div>
          <label className="label" htmlFor="max_slots">Maximum slots</label>
          <input id="max_slots" type="number" min={activeScholars} step={1} required className="input" value={max} onChange={(e) => setMax(e.target.value)} />
          <p className="mt-1 text-xs text-muted">Cannot be lower than the {activeScholars} active scholar(s).</p>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} />Applications are open</label>
        <div><label className="label" htmlFor="slot_note">Note (optional)</label><input id="slot_note" className="input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for the change" /></div>
        {saved && <p role="status" className="rounded-lg bg-brand-light p-3 text-sm text-brand-deep">Slot settings saved.</p>}
        {error && !confirming && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Review and save</button>
      </form>
      <ConfirmDialog
        open={confirming} loading={busy} error={error} title="Save slot settings?"
        message={`Maximum slots: ${max}. Applications will be ${isOpen ? 'open' : 'closed'}.`}
        confirmLabel="Save settings" onConfirm={save} onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
