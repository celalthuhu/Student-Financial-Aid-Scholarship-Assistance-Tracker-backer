'use client';

import { useCallback, useEffect, useState } from 'react';

type Application = {
  id: string;
  application_no: string;
  student_name: string;
  course: string;
  year_level: number;
  assigned_office: string | null;
  application_date: string;
  status: string;
  application_type: string;
};

export function FinanceWorkspace() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/applications?page=1');
      const result = await response.json() as { applications?: Application[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not load Finance applications.');
      setApplications(result.applications ?? []);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load Finance applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function changeStatus(id: string, status: string) {
    setBusyId(id);
    setError('');
    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_status', status }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not update application status.');
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update application status.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="card">
      <div className="border-b border-line px-4 py-3">
        <h1 className="font-semibold">Finance applications</h1>
        <p className="mt-1 text-sm text-muted">Only financial aid applications allowed by your Finance role are shown.</p>
      </div>
      {error && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p className="p-4 text-sm text-muted">Loading applications…</p> : applications.length === 0 ? (
        <p className="p-4 text-sm text-muted">No financial aid applications are currently assigned to Finance.</p>
      ) : (
        <ul className="divide-y divide-line">
          {applications.map((application) => (
            <li key={application.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{application.student_name} · {application.application_no}</p>
                <p className="text-sm text-muted">{application.course}, Year {application.year_level} · {application.application_date}</p>
                <p className="text-sm">Status: {application.status}</p>
              </div>
              <label className="text-sm">
                Update status
                <select
                  className="input mt-1"
                  value={application.status}
                  disabled={busyId === application.id}
                  onChange={(event) => void changeStatus(application.id, event.target.value)}
                >
                  {['PENDING', 'UNDER_REVIEW', 'COMPLETED', 'FOR_FOLLOW_UP', 'APPROVED', 'DENIED', 'INACTIVE'].map((status) => (
                    <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
