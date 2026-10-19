import Link from 'next/link';
import { Search } from 'lucide-react';
import { requireRole } from '@/lib/auth/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { ApplicationFormDialog } from '@/components/working-scholar/application-form-dialog';
import { PAGE_SIZE } from '@/lib/constants';
import { APPLICATION_STATUSES, STATUS_LABELS, isApplicationStatus } from '@/lib/status';
import { getFilterOptions } from '@/lib/queries';
import { firstParam, formatDate, formatDateTime, sanitizeSearch } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; application_no: string; student_name: string; course: string; year_level: number;
  assigned_office: string | null; application_date: string; status: string; updated_at: string;
};

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await requireRole('WORKING_SCHOLAR_ADMIN');
  const sp = await searchParams;
  const q = sanitizeSearch(firstParam(sp.q) ?? '');
  const status = firstParam(sp.status);
  const office = firstParam(sp.office);
  const page = Math.max(1, parseInt(firstParam(sp.page) ?? '1', 10) || 1);

  let query = supabase
    .from('working_scholar_applications')
    .select('id,application_no,student_name,course,year_level,assigned_office,application_date,status,updated_at', { count: 'exact' })
    .order('application_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (isApplicationStatus(status)) query = query.eq('status', status);
  if (office) query = query.eq('assigned_office', office);
  if (q) query = query.or(`student_name.ilike.%${q}%,application_no.ilike.%${q}%,student_number.ilike.%${q}%`);

  const [{ data, error, count }, options] = await Promise.all([query, getFilterOptions(supabase)]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const filtered = !!(q || status || office);

  return (
    <>
      <PageHeader
        title="Applications"
        description="Search, filter and review working scholar applications."
        actions={<ApplicationFormDialog mode="create" offices={options.offices} />}
      />

      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_200px_200px_auto]" method="get">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input name="q" defaultValue={q} className="input pl-9" placeholder="Search name, application ID or student number" aria-label="Search applications" />
        </div>
        <select name="status" defaultValue={status ?? ''} className="input" aria-label="Filter by status">
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select name="office" defaultValue={office ?? ''} className="input" aria-label="Filter by assigned office">
          <option value="">All offices</option>
          {options.offices.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">Apply</button>
          {filtered && <Link href="/working-scholar/applications" className="btn-secondary">Clear</Link>}
        </div>
      </form>

      <div className="card">
        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? 'No applications match your filters' : 'No application records yet'}
            description={filtered ? 'Try a different search or clear the filters.' : 'Student submissions arrive in a later phase. For now, use "New application record" to add one.'}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Application ID</th><th>Student name</th><th>Course</th><th>Year</th><th>Assigned office</th><th>Applied</th><th>Status</th><th>Last updated</th><th className="text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap font-medium">{r.application_no}</td>
                      <td>{r.student_name}</td>
                      <td>{r.course}</td>
                      <td>{r.year_level}</td>
                      <td>{r.assigned_office ?? '—'}</td>
                      <td className="whitespace-nowrap">{formatDate(r.application_date)}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="whitespace-nowrap">{formatDateTime(r.updated_at)}</td>
                      <td className="text-right"><Link className="btn-secondary btn-sm" href={`/working-scholar/applications/${r.id}`}>View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/working-scholar/applications" params={{ q: q || undefined, status, office }} />
          </>
        )}
      </div>
    </>
  );
}
