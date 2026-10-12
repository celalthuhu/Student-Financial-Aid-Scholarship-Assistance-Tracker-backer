'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/dashboard/status-badge';
import { api } from '@/lib/client-api';
import type { RequirementRow } from '@/lib/types';

export function RequirementsManager({ requirements }: { requirements: RequirementRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<RequirementRow | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = editing && editing !== 'new' ? editing : null;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const body = {
      name: f.get('name'), description: f.get('description'), sort_order: f.get('sort_order') || 0,
      is_required: f.get('is_required') === 'on', is_active: f.get('is_active') === 'on',
    };
    setBusy(true);
    const res = current ? await api('/api/requirements', 'PATCH', { id: current.id, ...body }) : await api('/api/requirements', 'POST', body);
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setEditing(null);
    router.refresh();
  }

  return (
    <section className="card self-start">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div><h2 className="font-semibold">Document requirements</h2><p className="text-xs text-muted">Defined by your office. Nothing is preset.</p></div>
        <button type="button" className="btn-primary btn-sm" onClick={() => { setError(null); setEditing('new'); }}><Plus className="h-4 w-4" />Add requirement</button>
      </div>
      {requirements.length === 0 ? (
        <EmptyState title="No requirements configured" description="Add the documents your office requires from applicants. They then appear on each application." />
      ) : (
        <ul className="divide-y divide-line">
          {requirements.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{r.name}</p>
                {r.description && <p className="text-muted">{r.description}</p>}
                <div className="mt-1 flex gap-2"><Badge tone={r.is_required ? 'sky' : 'slate'}>{r.is_required ? 'Required' : 'Optional'}</Badge><Badge tone={r.is_active ? 'green' : 'slate'}>{r.is_active ? 'In use' : 'Hidden'}</Badge></div>
              </div>
              <button type="button" className="btn-secondary btn-sm" onClick={() => { setError(null); setEditing(r); }}>Edit</button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => !busy && setEditing(null)} title={current ? 'Edit requirement' : 'Add requirement'}>
        <form onSubmit={save} className="space-y-4" key={current?.id ?? 'new'}>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div><label className="label" htmlFor="rq_name">Name *</label><input id="rq_name" name="name" required defaultValue={current?.name} className="input" /></div>
          <div><label className="label" htmlFor="rq_desc">Description</label><textarea id="rq_desc" name="description" defaultValue={current?.description ?? ''} maxLength={500} className="input min-h-20" /></div>
          <div><label className="label" htmlFor="rq_order">Display order</label><input id="rq_order" name="sort_order" type="number" min={0} defaultValue={current?.sort_order ?? 0} className="input" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_required" defaultChecked={current?.is_required ?? true} />Required for every application</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={current?.is_active ?? true} />In use (uncheck to hide without deleting)</label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
