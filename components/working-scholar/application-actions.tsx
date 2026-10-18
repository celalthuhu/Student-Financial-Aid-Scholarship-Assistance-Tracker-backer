'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/client-api';
import { STATUS_LABELS, STATUS_TRANSITIONS, type ApplicationStatus } from '@/lib/status';
import type { ApplicationRow } from '@/lib/types';

const ACTION_LABEL: Partial<Record<ApplicationStatus, string>> = {
  UNDER_REVIEW: 'Move to Under Review', COMPLETED: 'Mark requirements Completed',
  APPROVED: 'Approve application', DENIED: 'Deny application', INACTIVE: 'Mark Inactive',
};
const CONFIRM_TEXT: Partial<Record<ApplicationStatus, string>> = {
  APPROVED: 'Approve this application? Approval does not make the student an active scholar. Activation is a separate step and uses a slot.',
  DENIED: 'Deny this application? The reason is saved and shown on the record.',
  INACTIVE: 'Mark this application Inactive?',
};

export function ApplicationActions({
  application, scholar,
}: { application: ApplicationRow; scholar: { id: string; scholar_no: string; participation_status: string } | null }) {
  const router = useRouter();
  const [target, setTarget] = useState<ApplicationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remarks, setRemarks] = useState(application.review_remarks ?? '');
  const [remarksMsg, setRemarksMsg] = useState<string | null>(null);
  const [type, setType] = useState<'NEW' | 'PREVIOUS'>('NEW');
  const [registering, setRegistering] = useState(false);

  // For follow-up status, use "Request follow-up" below: it needs a message.
  const allowed = STATUS_TRANSITIONS[application.status].filter((s) => s !== 'FOR_FOLLOW_UP');

  async function changeStatus(reason: string) {
    if (!target) return;
    setBusy(true); setError(null);
    const res = await api(`/api/applications/${application.id}`, 'PATCH', { action: 'change_status', status: target, reason: reason || undefined });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setTarget(null);
    router.refresh();
  }

  async function saveRemarks() {
    setBusy(true); setRemarksMsg(null);
    const res = await api(`/api/applications/${application.id}`, 'PATCH', { action: 'update_fields', review_remarks: remarks });
    setBusy(false);
    setRemarksMsg(res.error ?? 'Remarks saved.');
    if (!res.error) router.refresh();
  }

  async function register() {
    setBusy(true); setError(null);
    const res = await api('/api/scholars', 'POST', { application_id: application.id, scholar_type: type });
    setBusy(false);
    if (res.error) { setError(res.error); setRegistering(false); return; }
    setRegistering(false);
    router.refresh();
  }

  return (
    <>
      <section className="card">
        <h2 className="border-b border-line px-4 py-3 font-semibold">Decision and status</h2>
        <div className="space-y-2 p-4">
          <p className="text-sm text-muted">Current status: <strong className="text-ink">{STATUS_LABELS[application.status]}</strong></p>
          {allowed.length === 0 ? <p className="text-sm text-muted">No further status changes are available from here.</p> : allowed.map((s) => (
            <button
              key={s} type="button" disabled={busy}
              className={s === 'DENIED' ? 'btn-danger w-full' : s === 'APPROVED' ? 'btn-primary w-full' : 'btn-secondary w-full'}
              onClick={() => { setError(null); setTarget(s); }}
            >{ACTION_LABEL[s] ?? STATUS_LABELS[s]}</button>
          ))}
          {error && !target && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
      </section>

      {application.status === 'APPROVED' && (
        <section className="card">
          <h2 className="border-b border-line px-4 py-3 font-semibold">Scholar participation</h2>
          <div className="space-y-3 p-4 text-sm">
            {scholar ? (
              <p>Registered as <strong>{scholar.scholar_no}</strong> ({scholar.participation_status === 'ACTIVE' ? 'active' : 'not yet active'}). <Link href="/working-scholar/scholars" className="font-medium text-brand-deep hover:underline">Manage on Scholars page</Link></p>
            ) : (
              <>
                <p className="text-muted">This application is approved but the student is not yet a scholar. Registering creates an inactive scholar record. It does not use a slot until you activate it.</p>
                <select className="input" value={type} onChange={(e) => setType(e.target.value as 'NEW' | 'PREVIOUS')} aria-label="Scholar type">
                  <option value="NEW">New scholar</option><option value="PREVIOUS">Previous scholar</option>
                </select>
                <button type="button" className="btn-primary w-full" onClick={() => setRegistering(true)} disabled={busy}>Register as scholar</button>
              </>
            )}
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="border-b border-line px-4 py-3 font-semibold">Review remarks</h2>
        <div className="space-y-2 p-4">
          <textarea className="input min-h-28" value={remarks} maxLength={2000} onChange={(e) => setRemarks(e.target.value)} aria-label="Review remarks" placeholder="Notes for other administrators" />
          <button type="button" className="btn-secondary btn-sm" onClick={saveRemarks} disabled={busy}>{busy && <Loader2 className="h-3 w-3 animate-spin" />}Save remarks</button>
          {remarksMsg && <p role="status" className="text-xs text-muted">{remarksMsg}</p>}
        </div>
      </section>

      <ConfirmDialog
        open={!!target} loading={busy} error={error}
        danger={target === 'DENIED'}
        title={target ? ACTION_LABEL[target] ?? STATUS_LABELS[target] : ''}
        message={target ? CONFIRM_TEXT[target] ?? `Change status to ${STATUS_LABELS[target]}?` : ''}
        confirmLabel={target === 'DENIED' ? 'Deny application' : target === 'APPROVED' ? 'Approve' : 'Confirm'}
        reasonLabel={target === 'DENIED' ? 'Reason for denial' : 'Note (optional)'}
        reasonRequired={target === 'DENIED'}
        onConfirm={changeStatus} onCancel={() => setTarget(null)}
      />
      <ConfirmDialog
        open={registering} loading={busy} error={error}
        title="Register as scholar?" message="A scholar record will be created as inactive. You can activate it from the Scholars page when a slot is available."
        confirmLabel="Register" onConfirm={register} onCancel={() => setRegistering(false)}
      />
    </>
  );
}
