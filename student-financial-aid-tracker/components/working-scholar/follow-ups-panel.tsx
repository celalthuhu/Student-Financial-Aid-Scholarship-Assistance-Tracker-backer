'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/dashboard/status-badge';
import { ResolveFollowUpButton } from '@/components/working-scholar/resolve-follow-up-button';
import { api } from '@/lib/client-api';
import { formatDateTime } from '@/lib/utils';
import type { FollowUpRow, RequirementRow } from '@/lib/types';

export function FollowUpsPanel({
  applicationId, followUps, requirements,
}: { applicationId: string; followUps: FollowUpRow[]; requirements: RequirementRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const res = await api('/api/follow-ups', 'POST', {
      application_id: applicationId, message: f.get('message'), requirement_id: f.get('requirement_id') || null,
    });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-semibold">Follow-ups</h2>
        <button type="button" className="btn-secondary btn-sm" onClick={() => { setError(null); setOpen(true); }}><Plus className="h-4 w-4" />Request follow-up</button>
      </div>
      {followUps.length === 0 ? (
        <EmptyState title="No follow-ups" description="Request a follow-up to ask for a missing or corrected document." />
      ) : (
        <ul className="divide-y divide-line">
          {followUps.map((f) => (
            <li key={f.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={f.status === 'OPEN' ? 'orange' : 'green'}>{f.status === 'OPEN' ? 'Open' : 'Resolved'}</Badge>
                  {f.requirement && <span className="text-xs text-muted">{f.requirement.name}</span>}
                </div>
                {f.status === 'OPEN' && <ResolveFollowUpButton id={f.id} />}
              </div>
              <p className="mt-2">{f.message}</p>
              <p className="mt-1 text-xs text-muted">Requested {formatDateTime(f.created_at)}{f.resolved_at && ` · resolved ${formatDateTime(f.resolved_at)}`}</p>
              {f.resolution_note && <p className="mt-1 text-muted">Resolution: {f.resolution_note}</p>}
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Request follow-up">
        <form onSubmit={create} className="space-y-4">
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div>
            <label className="label" htmlFor="fu_requirement">Related requirement (optional)</label>
            <select id="fu_requirement" name="requirement_id" className="input" defaultValue="">
              <option value="">None</option>
              {requirements.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="fu_message">Message *</label>
            <textarea id="fu_message" name="message" required minLength={3} maxLength={2000} className="input min-h-28" placeholder="What does the student need to submit or correct?" />
            <p className="mt-1 text-xs text-muted">This records the request and sets the application to For Follow-up. It does not send an email or notification.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create follow-up</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
