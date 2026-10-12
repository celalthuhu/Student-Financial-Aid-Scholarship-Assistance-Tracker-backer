'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Loader2, Paperclip, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { DocumentStatusBadge } from '@/components/dashboard/status-badge';
import { api } from '@/lib/client-api';
import { DOCUMENT_REVIEW_LABELS, DOCUMENT_REVIEW_STATUSES, type DocumentReviewStatus } from '@/lib/status';
import { formatDate } from '@/lib/utils';
import { MAX_UPLOAD_BYTES } from '@/lib/constants';
import type { DocumentRow, RequirementRow } from '@/lib/types';

export function DocumentsPanel({
  applicationId, documents, requirements,
}: { applicationId: string; documents: DocumentRow[]; requirements: RequirementRow[] }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [review, setReview] = useState<DocumentRow | null>(null);
  const [status, setStatus] = useState<DocumentReviewStatus>('ACCEPTED');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = requirements.filter((r) => r.is_required && !documents.some((d) => d.requirement_id === r.id));

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    f.set('application_id', applicationId);
    const file = f.get('file');
    if (file instanceof File && file.size > MAX_UPLOAD_BYTES) { setError('File is too large. The limit is 10 MB.'); return; }
    setBusy(true);
    const res = await api('/api/documents', 'POST', f);
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setAddOpen(false);
    router.refresh();
  }

  async function saveReview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!review) return;
    setError(null);
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const res = await api(`/api/documents/${review.id}`, 'PATCH', { review_status: status, review_remarks: f.get('review_remarks') });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setReview(null);
    router.refresh();
  }

  async function openFile(id: string) {
    setError(null);
    const res = await api<{ url: string }>(`/api/documents/${id}`, 'GET');
    if (res.error || !res.data) { setError(res.error ?? 'Could not open the file.'); return; }
    window.open(res.data.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-semibold">Requirements and documents</h2>
        <button type="button" className="btn-secondary btn-sm" onClick={() => { setError(null); setAddOpen(true); }}><Plus className="h-4 w-4" />Record document</button>
      </div>
      {error && !addOpen && !review && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {missing.length > 0 && (
        <div className="m-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Required documents not yet recorded</p>
          <p>{missing.map((m) => m.name).join(', ')}</p>
        </div>
      )}
      {documents.length === 0 ? (
        <EmptyState title="No documents recorded" description="Documents appear here once they are recorded for this application. Requirements are configured on the Requirements page." />
      ) : (
        <ul className="divide-y divide-line">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">{d.storage_path && <Paperclip className="h-4 w-4 text-muted" />}<span className="truncate">{d.file_name}</span></p>
                <p className="text-xs text-muted">{d.requirement?.name ?? 'Other document'} · recorded {formatDate(d.created_at)}{!d.storage_path && ' · no file stored'}</p>
                {d.review_remarks && <p className="mt-1 text-muted">Remark: {d.review_remarks}</p>}
              </div>
              <div className="flex items-center gap-2">
                <DocumentStatusBadge status={d.review_status} />
                {d.storage_path && <button type="button" className="btn-secondary btn-sm" onClick={() => openFile(d.id)}><ExternalLink className="h-3 w-3" />Open</button>}
                <button type="button" className="btn-secondary btn-sm" onClick={() => { setError(null); setStatus(d.review_status === 'PENDING' ? 'ACCEPTED' : d.review_status); setReview(d); }}>Review</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={addOpen} onClose={() => !busy && setAddOpen(false)} title="Record document">
        <form onSubmit={add} className="space-y-4">
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div>
            <label className="label" htmlFor="requirement_id">Requirement</label>
            <select id="requirement_id" name="requirement_id" className="input" defaultValue="">
              <option value="">Other document</option>
              {requirements.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div><label className="label" htmlFor="file_name">Document name</label><input id="file_name" name="file_name" className="input" placeholder="Required if you do not attach a file" /></div>
          <div>
            <label className="label" htmlFor="file">File (optional)</label>
            <input id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="input" />
            <p className="mt-1 text-xs text-muted">PDF, PNG, JPEG or WebP, up to 10 MB. Stored privately. Leave empty to record a paper document.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save document</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!review} onClose={() => !busy && setReview(null)} title="Review document" size="sm">
        <form onSubmit={saveReview} className="space-y-4">
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <p className="text-sm text-muted">{review?.file_name}</p>
          <div>
            <label className="label" htmlFor="review_status">Result</label>
            <select id="review_status" className="input" value={status} onChange={(e) => setStatus(e.target.value as DocumentReviewStatus)}>
              {DOCUMENT_REVIEW_STATUSES.map((s) => <option key={s} value={s}>{DOCUMENT_REVIEW_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="review_remarks">Remarks{(status === 'REJECTED' || status === 'NEEDS_CORRECTION') && ' *'}</label>
            <textarea id="review_remarks" name="review_remarks" className="input min-h-24" defaultValue={review?.review_remarks ?? ''} maxLength={1000} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setReview(null)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save review</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
