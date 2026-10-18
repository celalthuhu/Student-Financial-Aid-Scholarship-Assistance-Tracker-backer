'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Program = {
  id: string;
  name: string;
  application_type: 'WORKING_SCHOLAR';
  description: string;
  eligibility: string;
  requirements: string[];
  is_active: boolean;
  category: 'WORKING_SCHOLAR';
  responsible_office: string | null;
  benefits: string | null;
  opens_at: string | null;
  deadline: string | null;
  assigned_office: string | null;
  max_slots: number | null;
};
type ProgramSlots = {
  program_id: string;
  configured: boolean;
  max_slots: number;
  active_scholars: number;
  remaining: number;
  uses_program_limit: boolean;
};

async function readResponse(response: Response) {
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'The Working Scholar program could not be saved.');
}

export function WorkingScholarProgramsManager() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programSlots, setProgramSlots] = useState<Record<string, ProgramSlots>>({});
  const [editing, setEditing] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/scholarship-programs');
      const result = await response.json() as { programs?: Program[]; workingScholarProgramSlots?: ProgramSlots[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Working Scholar programs could not be loaded.');
      setPrograms((result.programs ?? []).filter((program) => program.application_type === 'WORKING_SCHOLAR'));
      setProgramSlots(Object.fromEntries((result.workingScholarProgramSlots ?? []).map((slots) => [slots.program_id, slots])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Working Scholar programs could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const values = new FormData(formElement, submitter instanceof HTMLElement ? submitter : undefined);
    const publish = values.get('publish') === 'true';
    const body = {
      name: String(values.get('name') ?? ''),
      application_type: 'WORKING_SCHOLAR',
      description: String(values.get('description') ?? ''),
      eligibility: String(values.get('eligibility') ?? ''),
      requirements: String(values.get('requirements') ?? '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      category: 'WORKING_SCHOLAR',
      responsible_office: String(values.get('responsible_office') ?? ''),
      assigned_office: String(values.get('assigned_office') ?? ''),
      benefits: String(values.get('benefits') ?? ''),
      opens_at: String(values.get('opens_at') ?? '') || null,
      deadline: String(values.get('deadline') ?? '') || null,
      max_slots: String(values.get('max_slots') ?? '').trim() === '' ? null : Number(values.get('max_slots')),
      is_active: publish,
    };

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(editing ? `/api/scholarship-programs/${editing.id}` : '/api/scholarship-programs', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await readResponse(response);
      setNotice(editing
        ? `Program details saved${publish ? ' and published' : ' as a draft'}.`
        : `Working Scholar program ${publish ? 'published' : 'saved as a draft'}.`);
      setEditing(null);
      if (!editing) formElement.reset();
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Working Scholar program could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function setPublished(program: Program, isActive: boolean) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/scholarship-programs/${program.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      });
      await readResponse(response);
      setNotice(`${program.name} is now ${isActive ? 'published' : 'a draft'}.`);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The program status could not be changed.');
    } finally {
      setBusy(false);
    }
  }

  function editor(program?: Program) {
    return (
      <form key={program?.id ?? 'new'} className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Program title
          <input className="input mt-1" name="name" defaultValue={program?.name ?? ''} minLength={3} maxLength={120} required />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Description and duties
          <textarea className="input mt-1" name="description" defaultValue={program?.description ?? ''} maxLength={2000} />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Qualifications
          <textarea className="input mt-1" name="eligibility" defaultValue={program?.eligibility ?? ''} minLength={2} maxLength={2000} required />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Required documents (one per line)
          <textarea className="input mt-1" name="requirements" defaultValue={program?.requirements.join('\n') ?? ''} />
        </label>
        <label className="text-sm font-medium text-slate-700">Assigned office or department
          <input className="input mt-1" name="assigned_office" defaultValue={program?.assigned_office ?? ''} maxLength={150} />
        </label>
        <label className="text-sm font-medium text-slate-700">Responsible office
          <input className="input mt-1" name="responsible_office" defaultValue={program?.responsible_office ?? ''} maxLength={150} />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Confirmed benefits (optional)
          <textarea className="input mt-1" name="benefits" defaultValue={program?.benefits ?? ''} maxLength={2000} />
        </label>
        <label className="text-sm font-medium text-slate-700">Application opens
          <input className="input mt-1" name="opens_at" type="date" defaultValue={program?.opens_at ?? ''} />
        </label>
        <label className="text-sm font-medium text-slate-700">Application deadline
          <input className="input mt-1" name="deadline" type="date" defaultValue={program?.deadline ?? ''} />
        </label>
        <label className="text-sm font-medium text-slate-700">Opportunity slot limit (optional)
          <input className="input mt-1" name="max_slots" type="number" min="0" max="100000" step="1" defaultValue={program?.max_slots ?? ''} />
        </label>
        <p className="text-xs leading-5 text-slate-500 sm:col-span-2">When set, this opportunity has its own limit in addition to the existing schoolwide Slot Management cap. Leave blank to use only the shared cap. Slots count scholars when activated under the current workflow; pending applications do not occupy slots.</p>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button className="btn-secondary" type="submit" name="publish" value="false" disabled={busy}>Save draft</button>
          <button className="btn-primary" type="submit" name="publish" value="true" disabled={busy}>{program?.is_active ? 'Save and keep published' : 'Publish opportunity'}</button>
          {program && <button className="btn-secondary" type="button" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>}
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}<button type="button" className="ml-2 font-semibold underline" onClick={() => void reload()}>Try again</button></p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      <section className="card">
        <h2 className="border-b border-line px-4 py-3 font-semibold">Working Scholar opportunities</h2>
        {loading ? <p role="status" className="p-4 text-sm text-muted">Loading Working Scholar opportunities…</p>
          : programs.length === 0 ? <p className="p-4 text-sm text-muted">No Working Scholar opportunities have been configured.</p>
            : <ul className="divide-y divide-line">{programs.map((program) => <li key={program.id} className="p-4">
              {editing?.id === program.id ? editor(program) : <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{program.name}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase text-brand-deep">{program.is_active ? 'Published' : 'Draft'} · {program.assigned_office || 'Office not specified'}</p>
                  <p className="mt-2 text-sm text-muted">{program.description || 'No description provided.'}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted">Qualifications: {program.eligibility}</p>
                  <p className="mt-1 text-sm text-muted">Opportunity limit: {program.max_slots === null ? 'Uses shared schoolwide cap' : `${program.max_slots} slots`}</p>
                  {programSlots[program.id]?.configured && <p className="mt-1 text-sm text-muted">Capacity: {programSlots[program.id].active_scholars} activated · {programSlots[program.id].remaining} remaining</p>}
                  {program.deadline && <p className="mt-1 text-xs text-muted">Deadline: {program.deadline}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => setEditing(program)}>Edit</button>
                  <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => void setPublished(program, !program.is_active)}>{program.is_active ? 'Unpublish' : 'Publish'}</button>
                </div>
              </div>}
            </li>)}</ul>}
      </section>
      {!editing && <section className="card p-4">
        <h2 className="font-semibold">Create Working Scholar opportunity</h2>
        <div className="mt-4">{editor()}</div>
      </section>}
    </div>
  );
}
