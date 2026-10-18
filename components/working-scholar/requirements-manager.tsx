'use client';

import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ExternalLink, FileCheck2, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge, DocumentStatusBadge } from '@/components/dashboard/status-badge';
import { api } from '@/lib/client-api';
import { ALLOWED_UPLOAD_TYPES, APP_TIME_ZONE, MAX_UPLOAD_BYTES } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/utils';
import type { DocumentReviewStatus } from '@/lib/status';
import type { RequirementRow } from '@/lib/types';

type ReviewRecord = {
  id: string;
  review_status: DocumentReviewStatus;
  review_remarks: string | null;
  reviewed_at: string;
  reviewer: { full_name: string } | null;
};
type QueueRecord = {
  id: string;
  file_name: string;
  storage_path: string | null;
  review_status: DocumentReviewStatus;
  review_remarks: string | null;
  created_at: string;
  reviewed_at: string | null;
  application: { id: string; application_no: string; student_name: string; application_date: string } | null;
  requirement: { id: string; name: string } | null;
  reviews: ReviewRecord[];
};

const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
};
const REVIEW_OPTIONS: { value: 'ALL' | DocumentReviewStatus; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING', label: 'Awaiting review' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'NEEDS_CORRECTION', label: 'Needs correction' },
];

export function RequirementsManager({ requirements, documents, pendingCount, correctionCount }: { requirements: RequirementRow[]; documents: QueueRecord[]; pendingCount: number; correctionCount: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState<RequirementRow | 'new' | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reviewing, setReviewing] = useState<QueueRecord | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'ACCEPTED' | 'NEEDS_CORRECTION'>('ACCEPTED');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [requirementSearch, setRequirementSearch] = useState('');
  const [requirementFilter, setRequirementFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [requirementType, setRequirementType] = useState<'ALL' | 'REQUIRED' | 'OPTIONAL'>('ALL');
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentStatus, setDocumentStatus] = useState<'ALL' | DocumentReviewStatus>('PENDING');
  const [documentRequirement, setDocumentRequirement] = useState('ALL');
  const [submissionDate, setSubmissionDate] = useState('');
  const [newestFirst, setNewestFirst] = useState(false);
  const current = editing && editing !== 'new' ? editing : null;
  const filteredRequirements = useMemo(() => requirements.filter((requirement) => {
    const searchMatches = `${requirement.name} ${requirement.description ?? ''}`.toLowerCase().includes(requirementSearch.toLowerCase());
    const statusMatches = requirementFilter === 'ALL' || (requirementFilter === 'ACTIVE' ? requirement.is_active : !requirement.is_active);
    const typeMatches = requirementType === 'ALL' || (requirementType === 'REQUIRED' ? requirement.is_required : !requirement.is_required);
    return searchMatches && statusMatches && typeMatches;
  }), [requirementFilter, requirementSearch, requirementType, requirements]);
  const filteredDocuments = useMemo(() => documents
    .filter((document) => documentStatus === 'ALL' || document.review_status === documentStatus)
    .filter((document) => documentRequirement === 'ALL' || document.requirement?.id === documentRequirement)
    .filter((document) => !submissionDate || dateKey(document.created_at) === submissionDate)
    .filter((document) => `${document.file_name} ${document.application?.student_name ?? ''} ${document.application?.application_no ?? ''} ${document.requirement?.name ?? ''}`
      .toLowerCase().includes(documentSearch.toLowerCase()))
    .sort((a, b) => newestFirst
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  [documentRequirement, documentSearch, documentStatus, documents, newestFirst, submissionDate]);

  async function saveRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const acceptedMimeTypes = form.getAll('accepted_mime_types').map(String);
    if (acceptedMimeTypes.length === 0) {
      setError('Select at least one accepted file type.');
      return;
    }
    const maxFileSize = Number(form.get('max_file_size_mb'));
    if (!Number.isFinite(maxFileSize) || maxFileSize <= 0 || maxFileSize > 10) {
      setError('Maximum file size must be greater than 0 MB and no more than 10 MB.');
      return;
    }
    const body = {
      name: form.get('name'),
      description: form.get('description'),
      sort_order: form.get('sort_order') || 0,
      is_required: form.get('is_required') === 'required',
      is_active: form.get('is_active') === 'active',
      accepted_mime_types: acceptedMimeTypes,
      max_file_size_bytes: Math.floor(maxFileSize * 1024 * 1024),
    };
    setBusy(true);
    const result = current
      ? await api('/api/requirements', 'PATCH', { id: current.id, ...body })
      : await api('/api/requirements', 'POST', body);
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setEditing(null);
    setNotice(current ? 'Requirement updated.' : 'Requirement saved.');
    router.refresh();
  }

  async function toggleRequirement(requirement: RequirementRow) {
    setBusy(true);
    setError(null);
    const result = await api('/api/requirements', 'PATCH', { id: requirement.id, is_active: !requirement.is_active });
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setNotice(requirement.is_active ? 'Requirement deactivated.' : 'Requirement activated.');
    router.refresh();
  }

  async function moveRequirement(requirement: RequirementRow, delta: -1 | 1) {
    const position = requirements.findIndex((item) => item.id === requirement.id);
    if (position < 0 || !requirements[position + delta]) return;
    const reordered = [...requirements];
    [reordered[position], reordered[position + delta]] = [reordered[position + delta], reordered[position]];
    setBusy(true);
    setError(null);
    const results = await Promise.all(reordered.map((item, index) =>
      api('/api/requirements', 'PATCH', { id: item.id, sort_order: index }),
    ));
    setBusy(false);
    const failure = results.find((result) => result.error)?.error;
    if (failure) { setError(failure); return; }
    router.refresh();
  }

  async function deleteRequirement(requirement: RequirementRow) {
    if (!window.confirm(`Delete "${requirement.name}"? Requirements tied to application history cannot be deleted and must be deactivated instead.`)) return;
    setBusy(true);
    setError(null);
    const result = await api(`/api/requirements?id=${encodeURIComponent(requirement.id)}`, 'DELETE');
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setNotice('Requirement deleted.');
    router.refresh();
  }

  async function openDocument(document: QueueRecord) {
    setReviewing(document);
    setReviewStatus('ACCEPTED');
    setReviewRemarks('');
    setError(null);
  }

  async function openPrivateFile(documentId: string) {
    const preview = window.open('about:blank', '_blank');
    setError(null);
    const result = await api<{ url: string }>(`/api/documents/${documentId}`, 'GET');
    if (result.error || !result.data) {
      preview?.close();
      setError(result.error ?? 'Could not open the secure document.');
      return;
    }
    if (preview) {
      preview.opener = null;
      preview.location.href = result.data.url;
    } else {
      setError('Allow pop-ups to open this private document.');
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewing) return;
    if (reviewStatus === 'NEEDS_CORRECTION' && !reviewRemarks.trim()) {
      setError('Enter correction instructions for the student.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await api(`/api/documents/${reviewing.id}`, 'PATCH', {
      review_status: reviewStatus,
      review_remarks: reviewRemarks.trim() || null,
    });
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setReviewing(null);
    setNotice(reviewStatus === 'ACCEPTED' ? 'Document accepted.' : 'Correction request sent.');
    router.refresh();
  }

  function applyQueueFilter(status: 'ALL' | DocumentReviewStatus) {
    setDocumentStatus(status);
    setDocumentSearch('');
    setDocumentRequirement('ALL');
    setSubmissionDate('');
  }

  return (
    <div className="space-y-6">
      {error && !editing && !reviewing && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</div>}

      <section aria-label="Requirement and document summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="Configured requirements" value={requirements.length} onClick={() => { setRequirementFilter('ALL'); setRequirementType('ALL'); setRequirementSearch(''); }} />
        <SummaryCard title="Mandatory" value={requirements.filter((item) => item.is_required).length} onClick={() => { setRequirementType('REQUIRED'); setRequirementFilter('ALL'); setRequirementSearch(''); }} />
        <SummaryCard title="Optional" value={requirements.filter((item) => !item.is_required).length} onClick={() => { setRequirementType('OPTIONAL'); setRequirementFilter('ALL'); setRequirementSearch(''); }} />
        <SummaryCard title="Awaiting review" value={pendingCount} onClick={() => applyQueueFilter('PENDING')} />
        <SummaryCard title="Needs correction" value={correctionCount} onClick={() => applyQueueFilter('NEEDS_CORRECTION')} />
      </section>

      <section className="card">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold">Document requirements</h2><p className="text-xs text-muted">Defined by Support Services. Nothing is preconfigured.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={() => setPreviewOpen(true)}>Preview student checklist</button>
            <button type="button" className="btn-primary btn-sm" onClick={() => { setError(null); setEditing('new'); }}><Plus className="h-4 w-4" />Add requirement</button>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <label className="relative flex-1"><span className="sr-only">Search requirements</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" /><input className="input pl-9" placeholder="Search requirements" value={requirementSearch} onChange={(event) => setRequirementSearch(event.target.value)} /></label>
          <div className="flex gap-2">
            <select className="input sm:w-40" aria-label="Filter requirements by status" value={requirementFilter} onChange={(event) => setRequirementFilter(event.target.value as typeof requirementFilter)}>
              <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
            </select>
            <select className="input sm:w-40" aria-label="Filter requirement type" value={requirementType} onChange={(event) => setRequirementType(event.target.value as typeof requirementType)}>
              <option value="ALL">All types</option><option value="REQUIRED">Mandatory</option><option value="OPTIONAL">Optional</option>
            </select>
          </div>
        </div>
        {requirements.length === 0 ? (
          <EmptyState title="No requirements configured" description="Add the documents your office requires. Active requirements will appear in the student checklist." />
        ) : filteredRequirements.length === 0 ? <p className="p-6 text-center text-sm text-muted">No requirements match your search.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-brand-softer text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Requirement</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">File settings</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-line">
                {filteredRequirements.map((requirement) => (
                  <tr key={requirement.id}>
                    <td className="max-w-[300px] px-4 py-3"><p className="font-medium">{requirement.name}</p><p className="mt-1 truncate text-xs text-muted">{requirement.description || 'No instructions provided.'}</p></td>
                    <td className="px-4 py-3"><Badge tone={requirement.is_required ? 'sky' : 'slate'}>{requirement.is_required ? 'Required' : 'Optional'}</Badge></td>
                    <td className="px-4 py-3 text-xs text-muted">{(requirement.accepted_mime_types ?? ALLOWED_UPLOAD_TYPES).map((type) => MIME_LABELS[type] ?? type).join(', ')}<br />Up to {(requirement.max_file_size_bytes ?? MAX_UPLOAD_BYTES) / 1024 / 1024} MB</td>
                    <td className="px-4 py-3"><Badge tone={requirement.is_active ? 'green' : 'slate'}>{requirement.is_active ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="px-4 py-3 text-xs text-muted">{requirement.updated_at ? formatDate(requirement.updated_at) : '—'}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => { setError(null); setEditing(requirement); }}>Edit</button>
                      <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => void toggleRequirement(requirement)}>{requirement.is_active ? 'Deactivate' : 'Activate'}</button>
                      <button type="button" className="btn-secondary btn-sm" aria-label={`Move ${requirement.name} up`} title="Move up" disabled={busy || requirements.indexOf(requirement) === 0} onClick={() => void moveRequirement(requirement, -1)}>↑</button>
                      <button type="button" className="btn-secondary btn-sm" aria-label={`Move ${requirement.name} down`} title="Move down" disabled={busy || requirements.indexOf(requirement) === requirements.length - 1} onClick={() => void moveRequirement(requirement, 1)}>↓</button>
                      <button type="button" className="btn-secondary btn-sm text-red-700" aria-label={`Delete ${requirement.name}`} onClick={() => void deleteRequirement(requirement)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="border-b border-line px-4 py-4">
          <h2 className="font-semibold">Documents for review</h2>
          <p className="text-xs text-muted">Only submitted document records are shown. Select a record to review its private file and saved review history.</p>
        </div>
        <div className="grid gap-3 border-b border-line p-4 lg:grid-cols-[1fr_190px_210px_170px_auto_auto]">
          <label className="relative"><span className="sr-only">Search by student or application</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" /><input className="input pl-9" placeholder="Student or application ID" value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} /></label>
          <select className="input" aria-label="Filter review status" value={documentStatus} onChange={(event) => setDocumentStatus(event.target.value as typeof documentStatus)}>{REVIEW_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          <select className="input" aria-label="Filter requirement" value={documentRequirement} onChange={(event) => setDocumentRequirement(event.target.value)}><option value="ALL">All requirements</option>{requirements.map((requirement) => <option key={requirement.id} value={requirement.id}>{requirement.name}</option>)}</select>
          <input className="input" type="date" aria-label="Filter submission date" value={submissionDate} onChange={(event) => setSubmissionDate(event.target.value)} />
          <button type="button" className="btn-secondary btn-sm" onClick={() => setNewestFirst((value) => !value)}>{newestFirst ? 'Newest first' : 'Oldest first'}</button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => { setDocumentSearch(''); setDocumentStatus('ALL'); setDocumentRequirement('ALL'); setSubmissionDate(''); }}>Clear filters</button>
        </div>
        {filteredDocuments.length === 0 ? (
          documentStatus === 'PENDING' && !documentSearch && documentRequirement === 'ALL' && !submissionDate
            ? <EmptyState title="No documents waiting for review." description="Student submissions will appear here when applications and uploaded requirements are recorded in the system." />
            : <p className="p-6 text-center text-sm text-muted">No documents match these filters.</p>
        ) : (
          <div className="divide-y divide-line">
            {filteredDocuments.map((document) => (
              <article key={document.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="rounded-lg bg-brand-softer p-2 text-brand"><FileCheck2 className="h-5 w-5" /></span>
                  <div className="min-w-0"><p className="font-medium">{document.application?.student_name ?? 'Student record unavailable'} · {document.requirement?.name ?? 'Other document'}</p>
                    <p className="mt-1 truncate text-xs text-muted">{document.file_name} · {document.application?.application_no ?? 'No reference'} · submitted {formatDateTime(document.created_at)}</p>
                    <p className="text-xs text-muted">Application submitted {document.application?.application_date ? formatDate(document.application.application_date) : 'date unavailable'}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2"><DocumentStatusBadge status={document.review_status} /><button type="button" className="btn-primary btn-sm" onClick={() => void openDocument(document)}>Review document</button></div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Student checklist preview">
        <p className="mb-3 text-sm text-muted">Active Working Scholar requirements are displayed in this order to students.</p>
        {requirements.filter((item) => item.is_active).length ? <ol className="list-decimal space-y-3 pl-5">{requirements.filter((item) => item.is_active).map((item) => <li key={item.id} className="text-sm"><strong>{item.name}</strong> · {item.is_required ? 'Required' : 'Optional'}<p className="text-muted">{item.description || 'No instructions provided.'}</p><p className="text-xs text-muted">{(item.accepted_mime_types ?? ALLOWED_UPLOAD_TYPES).map((type) => MIME_LABELS[type] ?? type).join(', ')} · up to {(item.max_file_size_bytes ?? MAX_UPLOAD_BYTES) / 1024 / 1024} MB</p></li>)}</ol>
          : <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No active requirements are configured. Students will be told that the official checklist is not yet configured.</p>}
      </Modal>

      <Modal open={editing !== null} onClose={() => !busy && setEditing(null)} title={current ? 'Edit requirement' : 'Add requirement'} size="lg">
        <form onSubmit={saveRequirement} className="space-y-4" key={current?.id ?? 'new'}>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div><label className="label" htmlFor="rq_name">Requirement name *</label><input id="rq_name" name="name" required minLength={2} maxLength={120} defaultValue={current?.name} className="input" /></div>
          <div><label className="label" htmlFor="rq_desc">Description / instructions</label><textarea id="rq_desc" name="description" defaultValue={current?.description ?? ''} maxLength={500} className="input min-h-20" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label">Requirement type</span><select name="is_required" className="input" defaultValue={current?.is_required === false ? 'optional' : 'required'}><option value="required">Required</option><option value="optional">Optional</option></select></label>
            <label className="block"><span className="label">Maximum file size (MB)</span><input name="max_file_size_mb" type="number" min="0.1" max="10" step="0.1" required defaultValue={((current?.max_file_size_bytes ?? MAX_UPLOAD_BYTES) / 1024 / 1024).toString()} className="input" /><span className="mt-1 block text-xs text-muted">Maximum supported limit is 10 MB.</span></label>
          </div>
          <fieldset><legend className="label">Accepted file types</legend><div className="flex flex-wrap gap-x-5 gap-y-2">
            {ALLOWED_UPLOAD_TYPES.map((type) => <label key={type} className="flex items-center gap-2 text-sm"><input type="checkbox" name="accepted_mime_types" value={type} defaultChecked={(current?.accepted_mime_types ?? ALLOWED_UPLOAD_TYPES).includes(type)} />{MIME_LABELS[type]}</label>)}
          </div></fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label">Display order</span><input name="sort_order" type="number" min={0} max={10000} defaultValue={current?.sort_order ?? requirements.length} className="input" /></label>
            <label className="block"><span className="label">Status</span><select name="is_active" className="input" defaultValue={current?.is_active === false ? 'inactive' : 'active'}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save requirement</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!reviewing} onClose={() => !busy && setReviewing(null)} title="Review submitted document" size="lg">
        <form onSubmit={submitReview} className="space-y-4">
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {reviewing && <>
            <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <p><span className="text-muted">Student</span><br /><strong>{reviewing.application?.student_name ?? 'Student record unavailable'}</strong></p>
              <p><span className="text-muted">Application</span><br />{reviewing.application ? <Link href={`/working-scholar/applications/${reviewing.application.id}`} className="font-semibold text-brand hover:underline">{reviewing.application.application_no}</Link> : 'Unavailable'}</p>
              <p><span className="text-muted">Requirement</span><br /><strong>{reviewing.requirement?.name ?? 'Other document'}</strong></p>
              <p><span className="text-muted">Submitted</span><br />{formatDateTime(reviewing.created_at)}</p>
              <p className="sm:col-span-2"><span className="text-muted">File</span><br /><span className="break-all">{reviewing.file_name}</span></p>
            </div>
            <div className="flex items-center gap-2"><DocumentStatusBadge status={reviewing.review_status} />{reviewing.storage_path && <button type="button" className="btn-secondary btn-sm" onClick={() => void openPrivateFile(reviewing.id)}><ExternalLink className="h-3.5 w-3.5" />Open private file</button>}</div>
            {reviewing.review_remarks && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Previous remarks:</strong> {reviewing.review_remarks}</p>}
            {reviewing.reviews?.length > 0 && <section><h3 className="text-sm font-semibold">Review history</h3><ol className="mt-2 space-y-2">{[...reviewing.reviews].sort((a, b) => new Date(a.reviewed_at).getTime() - new Date(b.reviewed_at).getTime()).map((entry) => <li key={entry.id} className="rounded-lg border border-line p-3 text-sm"><p className="font-medium">{entry.review_status.replaceAll('_', ' ')} · {entry.reviewer?.full_name ?? 'Administrator'} · {formatDateTime(entry.reviewed_at)}</p>{entry.review_remarks && <p className="mt-1 text-muted">{entry.review_remarks}</p>}</li>)}</ol></section>}
            <div><span className="label">Decision</span><div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className={reviewStatus === 'ACCEPTED' ? 'btn-primary' : 'btn-secondary'} onClick={() => setReviewStatus('ACCEPTED')}><Check className="h-4 w-4" />Accept document</button>
              <button type="button" className={reviewStatus === 'NEEDS_CORRECTION' ? 'btn-primary' : 'btn-secondary'} onClick={() => setReviewStatus('NEEDS_CORRECTION')}>Request correction</button>
            </div></div>
            <div><label className="label" htmlFor="review_remarks">Remarks {reviewStatus === 'NEEDS_CORRECTION' && '*'}</label><textarea id="review_remarks" className="input min-h-24" value={reviewRemarks} onChange={(event) => setReviewRemarks(event.target.value)} maxLength={1000} required={reviewStatus === 'NEEDS_CORRECTION'} placeholder="Explain what the student should correct." /></div>
          </>}
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setReviewing(null)} disabled={busy}>Cancel</button><button type="submit" className="btn-primary" disabled={busy || !reviewing}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save review</button></div>
        </form>
      </Modal>
    </div>
  );
}

function SummaryCard({ title, value, onClick }: { title: string; value: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
    <p className="text-sm text-muted">{title}</p><p className="mt-1 text-2xl font-semibold">{value}</p><span className="sr-only">Filter related records</span>
  </button>;
}

function dateKey(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
