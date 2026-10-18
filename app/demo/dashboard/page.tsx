'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { DemoSession } from '@/lib/demo-accounts';
import type { DemoApplication, DemoCategory, DemoProgram, DemoStatus, DemoUser, DemoSettings } from '@/lib/demo-store';

const STATUSES: DemoStatus[] = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'COMPLETED'];

async function demoRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'The local demo request failed.');
  return result;
}

export default function DemoDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<DemoSession | null>(null);
  const [applications, setApplications] = useState<DemoApplication[]>([]);
  const [programs, setPrograms] = useState<DemoProgram[]>([]);
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [report, setReport] = useState<{ totalApplications: number; pending: number; approved: number; denied: number; byCategory: Record<DemoCategory, number> } | null>(null);
  const [settings, setSettings] = useState<DemoSettings | null>(null);
  const [section, setSection] = useState('overview');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [editingProgram, setEditingProgram] = useState<DemoProgram | null>(null);
  const [programForm, setProgramForm] = useState({ name: '', category: 'ACADEMIC' as DemoCategory, description: '', eligibility: '', requirements: '', isActive: true });
  const [ready, setReady] = useState(false);
  const [actionError, setActionError] = useState('');
  const [formError, setFormError] = useState('');
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState('1');

  useEffect(() => {
    async function loadDemo() {
      try {
        const { session: current } = await demoRequest<{ session: DemoSession }>('/api/demo/session');
        setSession(current);
        const { applications: rows } = await demoRequest<{ applications: DemoApplication[] }>('/api/demo/applications');
        setApplications(rows);
        const { programs: catalog } = await demoRequest<{ programs: DemoProgram[] }>('/api/demo/programs');
        setPrograms(catalog);
        if (current.role === 'STUDENT') {
          setSelectedProgramId((selected) => selected || catalog.find((program) => program.isActive)?.id || '');
        }
        if (current.role === 'SUPER_ADMIN') {
          const [userResult, reportResult, settingsResult] = await Promise.all([
            demoRequest<{ users: DemoUser[] }>('/api/demo/users'),
            demoRequest<{ report: NonNullable<typeof report> }>('/api/demo/reports'),
            demoRequest<{ settings: DemoSettings }>('/api/demo/settings'),
          ]);
          setUsers(userResult.users);
          setReport(reportResult.report);
          setSettings(settingsResult.settings);
        } else {
          const settingsResult = await demoRequest<{ settings: Pick<DemoSettings, 'applicationsOpen' | 'academicMinGpa'> }>('/api/demo/settings/public');
          setSettings({ ...settingsResult.settings, notice: '' });
        }
      } catch {
        router.replace('/login');
      } finally {
        setReady(true);
      }
    }
    void loadDemo();
  }, [router]);

  async function refreshApplications() {
    const { applications: rows } = await demoRequest<{ applications: DemoApplication[] }>('/api/demo/applications');
    setApplications(rows);
    setActionError('');
    if (session?.role === 'SUPER_ADMIN') {
      const { report: updatedReport } = await demoRequest<{ report: NonNullable<typeof report> }>('/api/demo/reports');
      setReport(updatedReport);
    }
  }

  async function refreshPrograms() {
    const { programs: rows } = await demoRequest<{ programs: DemoProgram[] }>('/api/demo/programs');
    setPrograms(rows);
  }

  async function signOut() {
    await fetch('/api/demo/session', { method: 'DELETE' });
    router.replace('/login');
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || session.role !== 'STUDENT') return;
    const trimmedCourse = course.trim();
    const level = Number(yearLevel);
    if (trimmedCourse.length < 2 || trimmedCourse.length > 120 || !Number.isInteger(level) || level < 1 || level > 8) {
      setFormError('Enter a valid course and year level (1–8).');
      return;
    }
    try {
      const programId = selectedProgramId || programs.find((item) => item.isActive)?.id;
      if (!programId) {
        setFormError('There are no active scholarship programs to apply for.');
        return;
      }
      await demoRequest('/api/demo/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId, course: trimmedCourse, yearLevel: level }),
      });
      await refreshApplications();
      setCourse('');
      setYearLevel('1');
      setFormError('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not submit the application.');
    }
  }

  async function changeStatus(id: string, status: DemoStatus) {
    try {
      await demoRequest(`/api/demo/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_status', status }),
      });
      await refreshApplications();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update the application status.');
    }
  }

  async function deleteApplication(id: string) {
    if (window.confirm('Delete this demo application and its uploaded files?')) {
      try {
        const response = await fetch(`/api/demo/applications/${id}`, { method: 'DELETE' });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error ?? 'Could not delete the application.');
        await refreshApplications();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Could not delete the application.');
      }
    }
  }

  function uploadDocument(id: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setActionError('Local demo uploads are limited to 1 MB per file.');
      return;
    }
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setActionError('Choose a PDF, PNG, JPEG, or WebP file.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setActionError('The selected file could not be read.');
    reader.onload = async () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') {
        setActionError('The selected file could not be read.');
        return;
      }
      try {
        await demoRequest(`/api/demo/applications/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add_document', name: file.name, mimeType: file.type, dataUrl }),
        });
        await refreshApplications();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'The file could not be uploaded.');
      }
    };
    reader.readAsDataURL(file);
  }

  async function removeDocument(applicationId: string, documentId: string) {
    try {
      await demoRequest(`/api/demo/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_document', documentId }),
      });
      await refreshApplications();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The requirement could not be removed.');
    }
  }

  async function reviewEligibility(id: string, eligibility: string) {
    try {
      await demoRequest(`/api/demo/applications/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review_eligibility', eligibility }),
      });
      await refreshApplications();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not save the eligibility review.');
    }
  }

  async function saveProgram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      name: programForm.name,
      category: programForm.category,
      description: programForm.description,
      eligibility: programForm.eligibility,
      requirements: programForm.requirements.split('\n').map((item) => item.trim()).filter(Boolean),
      isActive: programForm.isActive,
    };
    try {
      await demoRequest(editingProgram ? `/api/demo/programs/${editingProgram.id}` : '/api/demo/programs', {
        method: editingProgram ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      await refreshPrograms();
      setEditingProgram(null);
      setProgramForm({ name: '', category: 'ACADEMIC', description: '', eligibility: '', requirements: '', isActive: true });
      setActionError('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not save this program.');
    }
  }

  async function deleteProgram(id: string) {
    try {
      const response = await fetch(`/api/demo/programs/${id}`, { method: 'DELETE' });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not delete this program.');
      await refreshPrograms();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete this program.');
    }
  }

  async function toggleUser(user: DemoUser) {
    try {
      await demoRequest('/api/demo/users', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, isActive: !user.isActive }),
      });
      const { users: updated } = await demoRequest<{ users: DemoUser[] }>('/api/demo/users');
      setUsers(updated);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update demo account.');
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    try {
      const { settings: updated } = await demoRequest<{ settings: DemoSettings }>('/api/demo/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSettings(updated);
      setActionError('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not save system settings.');
    }
  }

  if (!ready || !session) return <main className="p-8 text-sm text-muted">Loading local demo…</main>;
  const navigation = session.role === 'SUPER_ADMIN'
    ? [['overview', 'Overview'], ['programs', 'Programs'], ['applications', 'Applications'], ['users', 'Users'], ['reports', 'Reports'], ['settings', 'Settings']]
    : session.role === 'WORKING_SCHOLAR_ADMIN'
      ? [['overview', 'Dashboard'], ['applications', 'Applications'], ['requirements', 'Requirements']]
      : session.role === 'ACADEMIC_ADMIN'
        ? [['overview', 'Dashboard'], ['applications', 'Applications'], ['requirements', 'Eligibility & requirements']]
        : [['overview', 'Dashboard'], ['programs', 'Scholarships'], ['applications', 'My applications']];

  return (
    <main className="min-h-screen bg-brand-softer px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-deep">Local demo · {session.role.replaceAll('_', ' ')}</p>
            <h1 className="mt-1 text-xl font-semibold">Welcome, {session.name}</h1>
            <p className="text-sm text-muted">{session.email}</p>
          </div>
          <button type="button" className="btn-secondary" onClick={signOut}>Sign out of demo</button>
        </header>

        <aside className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Demo mode uses server-verified sessions and role-checked routes, isolated from Supabase. Development demo changes are saved locally in the ignored .demo-data folder; do not use this demo for real student data.
        </aside>

        {actionError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}

        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Demo navigation">
          {navigation.map(([key, label]) => (
            <button key={key} type="button" className={section === key ? 'btn-primary' : 'btn-secondary'} onClick={() => setSection(key)}>{label}</button>
          ))}
        </nav>

        {session.role === 'STUDENT' && section === 'applications' && settings?.applicationsOpen && (
          <section className="card mb-6 p-5">
            <h2 className="text-lg font-semibold">Submit an application</h2>
            <form onSubmit={submitApplication} className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="demo-program" className="label">Scholarship program</label>
                <select id="demo-program" className="input" value={selectedProgramId} onChange={(event) => setSelectedProgramId(event.target.value)} required>
                  <option value="">Select a program</option>
                  {programs.filter((program) => program.isActive).map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="demo-course" className="label">Course</label>
                <input id="demo-course" className="input" value={course} onChange={(event) => setCourse(event.target.value)} required minLength={2} maxLength={120} />
              </div>
              <div>
                <label htmlFor="demo-year" className="label">Year level</label>
                <input id="demo-year" className="input" type="number" value={yearLevel} onChange={(event) => setYearLevel(event.target.value)} required min={1} max={8} />
              </div>
              <div className="flex items-end">
                <button type="submit" className="btn-primary">Submit application</button>
              </div>
              {formError && <p role="alert" className="field-error sm:col-span-2">{formError}</p>}
            </form>
          </section>
        )}

        {session.role === 'STUDENT' && section === 'applications' && !settings?.applicationsOpen && (
          <p className="card mb-6 p-5 text-sm text-muted">Applications are currently closed. You can still track submitted applications.</p>
        )}

        {section === 'programs' && (
          <section className="card mb-6 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{session.role === 'STUDENT' ? 'Available scholarships' : 'Scholarship programs'}</h2>
                <p className="mt-1 text-sm text-muted">Browse program details, eligibility, and required documents.</p>
              </div>
              {session.role === 'SUPER_ADMIN' && <button type="button" className="btn-primary" onClick={() => {
                setEditingProgram(null);
                setProgramForm({ name: '', category: 'ACADEMIC', description: '', eligibility: '', requirements: '', isActive: true });
                setSection('requirements');
              }}>Add program</button>}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {programs.map((program) => {
                const canEdit = session.role === 'SUPER_ADMIN'
                  || (session.role === 'ACADEMIC_ADMIN' && program.category === 'ACADEMIC')
                  || (session.role === 'WORKING_SCHOLAR_ADMIN' && program.category === 'WORKING_SCHOLAR');
                return (
                  <article key={program.id} className="rounded-lg border border-line p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><h3 className="font-semibold">{program.name}</h3><p className="mt-1 text-xs text-muted">{program.category === 'ACADEMIC' ? 'Academic scholarship' : 'Working scholar'} · {program.isActive ? 'Open' : 'Inactive'}</p></div>
                      {canEdit && <button type="button" className="btn-secondary btn-sm" onClick={() => {
                        setEditingProgram(program);
                        setProgramForm({ name: program.name, category: program.category, description: program.description, eligibility: program.eligibility, requirements: program.requirements.join('\n'), isActive: program.isActive });
                        setSection('requirements');
                      }}>Edit</button>}
                    </div>
                    <p className="mt-3 text-sm text-muted">{program.description}</p>
                    <p className="mt-3 text-sm"><span className="font-medium">Eligibility:</span> {program.eligibility}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Requirements</p>
                    <ul className="mt-1 list-inside list-disc text-sm">{program.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
                    {session.role === 'STUDENT' && program.isActive && (
                      <button type="button" className="btn-primary btn-sm mt-4" onClick={() => {
                        setSelectedProgramId(program.id);
                        setSection('applications');
                      }}>Apply for this scholarship</button>
                    )}
                    {session.role === 'SUPER_ADMIN' && <button type="button" className="ml-2 mt-4 text-xs text-red-600 hover:underline" onClick={() => void deleteProgram(program.id)}>Delete program</button>}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {session.role === 'SUPER_ADMIN' && section === 'overview' && (
          <section className="card mb-6 p-5">
            <h2 className="text-lg font-semibold">System overview</h2>
            <p className="mt-3 text-sm text-muted">{report?.totalApplications ?? applications.length} applications · {programs.length} scholarship programs · {users.filter((user) => user.isActive).length} active demo accounts</p>
          </section>
        )}

        {(session.role === 'SUPER_ADMIN' || session.role === 'WORKING_SCHOLAR_ADMIN' || session.role === 'ACADEMIC_ADMIN') && section === 'requirements' && (
          <section className="card mb-6 p-5">
            <h2 className="text-lg font-semibold">{session.role === 'ACADEMIC_ADMIN' ? 'Eligibility & requirements' : 'Requirements management'}</h2>
            {session.role !== 'WORKING_SCHOLAR_ADMIN' && session.role !== 'ACADEMIC_ADMIN' && (
              <p className="mt-1 text-sm text-muted">Program eligibility and requirements are maintained by the relevant scholarship admin.</p>
            )}
            {programs.filter((program) => session.role === 'SUPER_ADMIN'
              || (session.role === 'ACADEMIC_ADMIN' && program.category === 'ACADEMIC')
              || (session.role === 'WORKING_SCHOLAR_ADMIN' && program.category === 'WORKING_SCHOLAR')).map((program) => (
                <div key={program.id} className="mt-4 rounded-lg border border-line p-4">
                  <h3 className="font-semibold">{program.name}</h3>
                  <p className="mt-1 text-sm"><span className="font-medium">Eligibility:</span> {program.eligibility}</p>
                  <ul className="mt-2 list-inside list-disc text-sm">{program.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
                  <button type="button" className="btn-secondary btn-sm mt-3" onClick={() => {
                    setEditingProgram(program);
                    setProgramForm({ name: program.name, category: program.category, description: program.description, eligibility: program.eligibility, requirements: program.requirements.join('\n'), isActive: program.isActive });
                  }}>Edit eligibility & requirements</button>
                </div>
            ))}
            {(session.role === 'SUPER_ADMIN' || !!editingProgram) && (
              <form onSubmit={saveProgram} className="mt-5 space-y-3 border-t border-line pt-5">
                <h3 className="font-semibold">{editingProgram ? `Update ${editingProgram.name}` : 'Add scholarship program'}</h3>
                <input className="input" placeholder="Program name" value={programForm.name} onChange={(event) => setProgramForm({ ...programForm, name: event.target.value })} required minLength={3} maxLength={100} />
                {!editingProgram && session.role === 'SUPER_ADMIN' && <select className="input" value={programForm.category} onChange={(event) => setProgramForm({ ...programForm, category: event.target.value as DemoCategory })}><option value="ACADEMIC">Academic</option><option value="WORKING_SCHOLAR">Working scholar</option></select>}
                <textarea className="input" placeholder="Program description" value={programForm.description} onChange={(event) => setProgramForm({ ...programForm, description: event.target.value })} maxLength={500} rows={2} />
                <textarea className="input" placeholder="Eligibility criteria" value={programForm.eligibility} onChange={(event) => setProgramForm({ ...programForm, eligibility: event.target.value })} required maxLength={500} rows={2} />
                <textarea className="input" placeholder="One requirement per line" value={programForm.requirements} onChange={(event) => setProgramForm({ ...programForm, requirements: event.target.value })} rows={3} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={programForm.isActive} onChange={(event) => setProgramForm({ ...programForm, isActive: event.target.checked })} />Open for applications</label>
                <button className="btn-primary" type="submit">{editingProgram ? 'Save program changes' : 'Create program'}</button>
                {editingProgram && <button type="button" className="btn-secondary ml-2" onClick={() => { setEditingProgram(null); setProgramForm({ name: '', category: session.role === 'WORKING_SCHOLAR_ADMIN' ? 'WORKING_SCHOLAR' : 'ACADEMIC', description: '', eligibility: '', requirements: '', isActive: true }); }}>Cancel edit</button>}
              </form>
            )}
          </section>
        )}

        {session.role === 'SUPER_ADMIN' && section === 'users' && (
          <section className="card p-5">
            <h2 className="text-lg font-semibold">Demo user management</h2>
            <p className="mt-1 text-sm text-muted">Deactivate and reactivate local demo identities. The current Super Admin cannot deactivate itself.</p>
            <ul className="mt-4 divide-y divide-line">
              {users.map((user) => <li key={user.email} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div><p className="font-medium">{user.name}</p><p className="text-xs text-muted">{user.email} · {user.role.replaceAll('_', ' ')}</p></div>
                <div className="flex items-center gap-3"><span className="text-xs">{user.isActive ? 'Active' : 'Inactive'}</span><button type="button" className="btn-secondary btn-sm" disabled={user.email === session.email} onClick={() => void toggleUser(user)}>{user.isActive ? 'Deactivate' : 'Reactivate'}</button></div>
              </li>)}
            </ul>
          </section>
        )}

        {session.role === 'SUPER_ADMIN' && section === 'reports' && report && (
          <section className="card p-5">
            <h2 className="text-lg font-semibold">Application reports</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[['Total', report.totalApplications], ['Pending/review', report.pending], ['Approved/completed', report.approved], ['Denied', report.denied], ['Academic', report.byCategory.ACADEMIC], ['Working scholar', report.byCategory.WORKING_SCHOLAR]].map(([label, value]) => <div key={label} className="rounded-lg bg-brand-softer p-4"><p className="text-sm text-muted">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}
            </div>
          </section>
        )}

        {session.role === 'SUPER_ADMIN' && section === 'settings' && settings && (
          <section className="card p-5">
            <h2 className="text-lg font-semibold">System settings</h2>
            <form onSubmit={saveSettings} className="mt-4 max-w-2xl space-y-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.applicationsOpen} onChange={(event) => setSettings({ ...settings, applicationsOpen: event.target.checked })} />Accept new applications</label>
              <div><label className="label" htmlFor="minimum-gpa">Academic minimum GPA</label><input id="minimum-gpa" className="input" type="number" min={0} max={4} step={0.1} value={settings.academicMinGpa} onChange={(event) => setSettings({ ...settings, academicMinGpa: Number(event.target.value) })} /></div>
              <div><label className="label" htmlFor="system-notice">System notice</label><textarea id="system-notice" className="input" rows={3} maxLength={500} value={settings.notice} onChange={(event) => setSettings({ ...settings, notice: event.target.value })} /></div>
              <button className="btn-primary" type="submit">Save settings</button>
            </form>
          </section>
        )}

        {(section === 'overview' || section === 'applications') && <section className="card overflow-hidden">
          <div className="border-b border-line p-5">
            <h2 className="text-lg font-semibold">{session.role === 'STUDENT' ? 'My applications' : 'Authorized applications'}</h2>
            <p className="mt-1 text-sm text-muted">
              {session.role === 'WORKING_SCHOLAR_ADMIN' ? 'Working scholar applications only.' :
                session.role === 'ACADEMIC_ADMIN' ? 'Academic scholarship applications only.' :
                  session.role === 'STUDENT' ? 'Track your applications and manage requirements.' : 'All demo applications across the system.'}
            </p>
          </div>
          {applications.length === 0 ? (
            <p className="p-6 text-sm text-muted">No applications are available for this account.</p>
          ) : (
            <ul className="divide-y divide-line">
              {applications.map((application) => {
                const studentOwns = session.role === 'STUDENT' && application.studentEmail === session.email;
                const studentCanEdit = studentOwns && application.status === 'PENDING';
                const adminCanManage = session.role !== 'STUDENT' && (
                  session.role === 'SUPER_ADMIN'
                  || (session.role === 'WORKING_SCHOLAR_ADMIN' && application.category === 'WORKING_SCHOLAR')
                  || (session.role === 'ACADEMIC_ADMIN' && application.category === 'ACADEMIC')
                );
                return (
                  <li key={application.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{programs.find((item) => item.id === application.programId)?.name ?? (application.category === 'ACADEMIC' ? 'Academic scholarship' : 'Working scholar')}</p>
                        <p className="mt-1 text-sm text-muted">{application.studentName} · {application.course} · Year {application.yearLevel}</p>
                        <p className="mt-1 text-xs text-muted">Submitted {application.submittedAt} · {application.studentEmail}</p>
                        <p className="mt-2 text-xs text-muted">Eligibility review: {application.eligibility}</p>
                        <p className="mt-2 text-xs text-muted">Required: {(programs.find((item) => item.id === application.programId)?.requirements ?? []).join(', ')}</p>
                        {adminCanManage && (
                          <label className="mt-2 block max-w-xl text-xs font-medium text-muted">
                            Eligibility review note
                            <input className="input mt-1" defaultValue={application.eligibility} key={`${application.id}:${application.eligibility}`} maxLength={500} onBlur={(event) => {
                              if (event.target.value.trim() !== application.eligibility) void reviewEligibility(application.id, event.target.value);
                            }} />
                          </label>
                        )}
                      </div>
                      <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand-deep">{application.status.replaceAll('_', ' ')}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      {adminCanManage && (
                        <label className="text-xs font-medium text-muted">
                          Update status
                          <select className="input mt-1 min-w-40" value={application.status} onChange={(event) => changeStatus(application.id, event.target.value as DemoStatus)}>
                            {STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                          </select>
                        </label>
                      )}
                      {(studentCanEdit || adminCanManage) && (
                        <label className="text-xs font-medium text-muted">
                          Upload requirement (PDF/image, max 1 MB)
                          <input className="mt-1 block max-w-64 text-xs" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => uploadDocument(application.id, event)} />
                        </label>
                      )}
                      {(studentCanEdit || adminCanManage) && (
                        <button type="button" className="btn-danger btn-sm" onClick={() => deleteApplication(application.id)}>Delete</button>
                      )}
                    </div>
                    {application.documents.length > 0 && (
                      <ul className="mt-4 space-y-2 text-sm">
                        {application.documents.map((document) => (
                          <li key={document.id} className="flex flex-wrap items-center gap-3">
                            <a className="font-medium text-brand-deep underline" href={document.dataUrl} download={document.name}>{document.name}</a>
                            {(studentCanEdit || adminCanManage) && (
                              <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeDocument(application.id, document.id)}>Remove</button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>}
        <p className="mt-5 text-center text-xs text-muted">This local demo is not connected to Supabase. Development changes persist locally, not to Supabase.</p>
      </div>
    </main>
  );
}
