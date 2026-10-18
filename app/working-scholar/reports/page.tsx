import { Download } from 'lucide-react';
import { FileText, Gauge, UserCheck, UserMinus } from 'lucide-react';
import { requireRole } from '@/lib/auth/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatusBadge, Badge } from '@/components/dashboard/status-badge';
import { getFilterOptions } from '@/lib/queries';
import { fetchReport, type ReportRow } from '@/lib/reports';
import { firstParam, monthLabel } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function Table({ title, rows, showActive, labelFn }: { title: string; rows: ReportRow[]; showActive?: boolean; labelFn?: (l: string) => React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="border-b border-line px-4 py-3 font-semibold">{title}</h2>
      {rows.length === 0 ? <EmptyState title="No data for these filters" /> : (
        <div className="table-wrap">
          <table className="data-table min-w-0">
            <thead><tr><th>Label</th><th className="text-right">Total</th>{showActive && <th className="text-right">Active</th>}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.label}><td>{labelFn ? labelFn(r.label) : r.label}</td><td className="text-right tabular-nums">{r.total}</td>{showActive && <td className="text-right tabular-nums">{r.active ?? 0}</td>}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await requireRole('WORKING_SCHOLAR_ADMIN');
  const sp = await searchParams;
  const filters = { from: firstParam(sp.from), to: firstParam(sp.to), course: firstParam(sp.course), office: firstParam(sp.office) };

  const [result, options] = await Promise.all([fetchReport(supabase, filters), getFilterOptions(supabase)]);
  if (result.error) throw new Error(result.error.message);
  const r = result.report;

  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v); });
  qs.set('format', 'csv');

  const active = r.participation.find((p) => p.label === 'ACTIVE')?.total ?? 0;
  const inactive = r.participation.find((p) => p.label === 'INACTIVE')?.total ?? 0;
  const slots = r.slots;
  const util = slots.configured && slots.max_slots > 0 ? Math.round((slots.active_scholars / slots.max_slots) * 100) : null;

  return (
    <>
      <PageHeader title="Reports" description="Figures calculated from your database. Date filters apply to applications; course and office apply to everything."
        actions={<a href={`/api/reports?${qs.toString()}`} className="btn-secondary"><Download className="h-4 w-4" />Export CSV</a>} />

      <form method="get" className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <div><label className="label" htmlFor="from">From</label><input id="from" name="from" type="date" defaultValue={filters.from} className="input" /></div>
        <div><label className="label" htmlFor="to">To</label><input id="to" name="to" type="date" defaultValue={filters.to} className="input" /></div>
        <div><label className="label" htmlFor="course">Course</label>
          <select id="course" name="course" defaultValue={filters.course ?? ''} className="input"><option value="">All courses</option>{options.courses.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div><label className="label" htmlFor="office">Assigned office</label>
          <select id="office" name="office" defaultValue={filters.office ?? ''} className="input"><option value="">All offices</option>{options.offices.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
        <div className="flex items-end"><button type="submit" className="btn-primary w-full">Apply</button></div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total applications" value={r.total_applications} icon={FileText} />
        <StatCard label="Active scholars" value={active} icon={UserCheck} />
        <StatCard label="Inactive scholars" value={inactive} icon={UserMinus} />
        <StatCard label="Slot utilization" value={util === null ? '—' : `${util}%`} icon={Gauge} hint={slots.configured ? `${slots.active_scholars} of ${slots.max_slots} slots` : 'Slots not configured'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Table title="Applications by status" rows={r.by_status} labelFn={(l) => <StatusBadge status={l} />} />
        <Table title="Applications by month" rows={r.by_month} labelFn={monthLabel} />
        <Table title="Scholars by course" rows={r.by_course} showActive />
        <Table title="Scholars by assigned office" rows={r.by_office} showActive />
      </div>

      <section className="card mt-6">
        <h2 className="border-b border-line px-4 py-3 font-semibold">Fourth-year scholars (approaching graduation)</h2>
        {r.fourth_year.length === 0 ? <EmptyState title="No fourth-year scholars" /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Scholar ID</th><th>Student</th><th>Course</th><th>Year</th><th>Office</th><th>Participation</th></tr></thead>
              <tbody>{r.fourth_year.map((s) => (
                <tr key={s.scholar_no}><td>{s.scholar_no}</td><td>{s.student_name}</td><td>{s.course}</td><td>{s.year_level}</td><td>{s.assigned_office ?? '—'}</td>
                  <td><Badge tone={s.participation_status === 'ACTIVE' ? 'green' : 'slate'}>{s.participation_status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
