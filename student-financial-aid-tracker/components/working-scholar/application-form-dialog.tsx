'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/client-api';
import type { ApplicationRow } from '@/lib/types';

type Props =
  | { mode: 'create'; offices: string[]; application?: undefined }
  | { mode: 'edit'; offices: string[]; application: ApplicationRow };

export function ApplicationFormDialog({ mode, offices, application }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = application;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      student_number: f.get('student_number'), student_name: f.get('student_name'), email: f.get('email'),
      course: f.get('course'), year_level: f.get('year_level'), assigned_office: f.get('assigned_office'),
    };
    setBusy(true);
    if (mode === 'create') {
      if (f.get('application_date')) body.application_date = f.get('application_date');
      const res = await api<{ id: string }>('/api/applications', 'POST', body);
      setBusy(false);
      if (res.error) { setError(res.error); return; }
      setOpen(false);
      router.push(`/working-scholar/applications/${res.data?.id}`);
    } else {
      const res = await api(`/api/applications/${a!.id}`, 'PATCH', { action: 'update_fields', ...body });
      setBusy(false);
      if (res.error) { setError(res.error); return; }
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <button type="button" className={mode === 'create' ? 'btn-primary' : 'btn-secondary btn-sm'} onClick={() => { setError(null); setOpen(true); }}>
        {mode === 'create' ? <><Plus className="h-4 w-4" />New application record</> : <><Pencil className="h-4 w-4" />Edit</>}
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={mode === 'create' ? 'New application record' : 'Edit application'} size="lg">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2"><label className="label" htmlFor="student_name">Student name *</label><input id="student_name" name="student_name" required defaultValue={a?.student_name} className="input" /></div>
          <div><label className="label" htmlFor="student_number">Student number</label><input id="student_number" name="student_number" defaultValue={a?.student_number ?? ''} className="input" /></div>
          <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={a?.email ?? ''} className="input" /></div>
          <div><label className="label" htmlFor="course">Course *</label><input id="course" name="course" required defaultValue={a?.course} className="input" /></div>
          <div><label className="label" htmlFor="year_level">Year level *</label><input id="year_level" name="year_level" type="number" min={1} max={8} required defaultValue={a?.year_level} className="input" /></div>
          <div>
            <label className="label" htmlFor="assigned_office">Assigned office</label>
            <input id="assigned_office" name="assigned_office" list="office-options" defaultValue={a?.assigned_office ?? ''} className="input" />
            <datalist id="office-options">{offices.map((o) => <option key={o} value={o} />)}</datalist>
          </div>
          {mode === 'create' && (
            <div><label className="label" htmlFor="application_date">Application date</label><input id="application_date" name="application_date" type="date" className="input" /><p className="mt-1 text-xs text-muted">Leave blank for today.</p></div>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === 'create' ? 'Create record' : 'Save changes'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
