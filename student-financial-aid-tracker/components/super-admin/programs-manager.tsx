'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Program = {
  id: string;
  name: string;
  application_type: 'WORKING_SCHOLAR' | 'FINANCIAL_AID';
  description: string;
  eligibility: string;
  requirements: string[];
  is_active: boolean;
};

export function ProgramsManager() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [editing, setEditing] = useState<Program | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const response = await fetch('/api/scholarship-programs');
      const result = await response.json() as { programs?: Program[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not load scholarship programs.');
      setPrograms(result.programs ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load scholarship programs.');
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values = {
      name: String(form.get('name') ?? ''),
      application_type: String(form.get('application_type') ?? ''),
      description: String(form.get('description') ?? ''),
      eligibility: String(form.get('eligibility') ?? ''),
      requirements: String(form.get('requirements') ?? '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      is_active: true,
    };
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/scholarship-programs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not create program.');
      formElement.reset();
      setNotice('Scholarship program created.');
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create program.');
    } finally {
      setBusy(false);
    }
  }

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/scholarship-programs/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(form.get('name') ?? ''),
          description: String(form.get('description') ?? ''),
          eligibility: String(form.get('eligibility') ?? ''),
          requirements: String(form.get('requirements') ?? '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not update program.');
      setEditing(null);
      setNotice('Scholarship program updated.');
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update program.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(program: Program) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/scholarship-programs/${program.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !program.is_active }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not update program.');
      setNotice(`${program.name} is now ${program.is_active ? 'closed' : 'open'} for applications.`);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update program.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(program: Program) {
    if (!window.confirm(`Delete ${program.name}?`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/scholarship-programs/${program.id}`, { method: 'DELETE' });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not delete program.');
      setNotice('Scholarship program deleted.');
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete program.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="border-b border-line px-4 py-3 font-semibold">Scholarship programs</h1>
        {error && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="m-4 rounded-lg bg-brand-light p-3 text-sm text-brand-deep">{notice}</p>}
        {programs.length === 0 ? <p className="p-4 text-sm text-muted">No programs created yet.</p> : (
          <ul className="divide-y divide-line">
            {programs.map((program) => (
              <li key={program.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">{program.name}</h2>
                    <p className="text-xs uppercase text-brand-deep">{program.application_type.replaceAll('_', ' ')} · {program.is_active ? 'Open' : 'Closed'}</p>
                    <p className="mt-1 text-sm text-muted">{program.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary btn-sm" type="button" disabled={busy} onClick={() => setEditing(program)}>Edit</button>
                    <button className="btn-secondary btn-sm" type="button" disabled={busy} onClick={() => void toggle(program)}>{program.is_active ? 'Close' : 'Open'}</button>
                    <button className="btn-secondary btn-sm" type="button" disabled={busy} onClick={() => void remove(program)}>Delete</button>
                  </div>
                </div>
                {editing?.id === program.id && (
                  <form className="mt-4 grid gap-3" onSubmit={update}>
                    <input className="input" name="name" aria-label="Edit program name" defaultValue={program.name} required minLength={3} />
                    <textarea className="input" name="description" aria-label="Edit program description" defaultValue={program.description} />
                    <textarea className="input" name="eligibility" aria-label="Edit program eligibility" defaultValue={program.eligibility} required />
                    <textarea className="input" name="requirements" aria-label="Edit program requirements" defaultValue={program.requirements.join('\n')} />
                    <div className="flex gap-2"><button className="btn-primary btn-sm" disabled={busy}>Save changes</button><button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(null)}>Cancel</button></div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card p-4">
        <h2 className="font-semibold">Create scholarship program</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={save}>
          <input className="input" name="name" aria-label="Program name" placeholder="Program name" minLength={3} maxLength={120} required />
          <select className="input" name="application_type" aria-label="Application type">
            <option value="FINANCIAL_AID">Finance / financial aid</option>
            <option value="WORKING_SCHOLAR">Working scholar</option>
          </select>
          <textarea className="input sm:col-span-2" name="description" aria-label="Program description" placeholder="Description" maxLength={2000} />
          <textarea className="input sm:col-span-2" name="eligibility" aria-label="Program eligibility" placeholder="Eligibility criteria" minLength={2} maxLength={2000} required />
          <textarea className="input sm:col-span-2" name="requirements" aria-label="Program requirements" placeholder="Requirements, one per line" />
          <button className="btn-primary sm:col-span-2" disabled={busy}>Create program</button>
        </form>
      </section>
    </div>
  );
}
