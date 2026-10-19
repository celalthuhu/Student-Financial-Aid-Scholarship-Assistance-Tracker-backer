import Link from 'next/link';
import { requireRole } from '@/lib/auth/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Badge } from '@/components/dashboard/status-badge';
import { ScholarActions } from '@/components/working-scholar/scholar-actions';
import { getSlotSummary } from '@/lib/queries';
import { cn, firstParam, formatDate, formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
const SIZE = 15;

type Row = {
  id: string; scholar_no: string; scholar_type: string; participation_status: 'ACTIVE' | 'INACTIVE';
  accepted_at: string; activated_at: string | null; updated_at: string;
  application: { id: string; student_name: string; course: string; year_level: number; assigned_office: string | null };
};
const FILTERS = [
  { key: 'all', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'inactive', label: 'Inactive / former' },
  { key: 'new', label: 'New' }, { key: 'previous', label: 'Previous' }, { key: 'fourth_year', label: 'Fourth year+' },
];

export default async function ScholarsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await requireRole('WORKING_SCHOLAR_ADMIN');
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.key === firstParam(sp.filter)) ? (firstParam(sp.filter) as string) : 'all';
  const page = Math.max(1, parseInt(firstParam(sp.page) ?? '1', 10) || 1);

  let query = supabase.from('working_scholars')
    .select('id,scholar_no,scholar_type,participation_status,accepted_at,activated_at,updated_at,application:working_scholar_applications!inner(id,student_name,course,year_level,assigned_office)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range((page - 1) * SIZE, page * SIZE - 1);
  if (filter === 'active') query = query.eq('participation_status', 'ACTIVE');
  if (filter === 'inactive') query = query.eq('participation_status', 'INACTIVE');
  if (filter === 'new') query = query.eq('scholar_type', 'NEW');
  if (filter === 'previous') query = query.eq('scholar_type', 'PREVIOUS');
  if (filter === 'fourth_year') query = query.gte('application.year_level', 4);

  const [{ data, error, count }, slots] = await Promise.all([query, getSlotSummary(supabase)]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Scholars" description="Monitor participation. Approving an application never activates a scholar automatically." />
      <p className="mb-4 text-sm text-muted">
        {slots.configured ? <>{slots.active_scholars} of {slots.max_slots} slots in use · {slots.remaining} remaining.</> : <>Slots are not configured yet. <Link className="font-medium text-brand-deep hover:underline" href="/working-scholar/slots">Set the maximum slots</Link> before activating scholars.</>}
      </p>
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-brand-light p-1" role="tablist">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/working-scholar/scholars?filter=${f.key}`} role="tab" aria-selected={filter === f.key}
            className={cn('rounded-md px-3 py-1.5 text-sm font-medium', filter === f.key ? 'bg-white text-brand-deep shadow-sm' : 'text-slate-600 hover:text-ink')}>{f.label}</Link>
        ))}
      </div>
      <div className="card">
        {rows.length === 0 ? (
          <EmptyState title="No scholars found" description="Register an approved application as a scholar from its detail page." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Scholar ID</th><th>Student name</th><th>Course</th><th>Year</th><th>Assigned office</th><th>Participation</th><th>Accepted</th><th>Activated</th><th>Last update</th><th className="text-right">Action</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap font-medium">{r.scholar_no}</td>
                      <td><Link href={`/working-scholar/applications/${r.application.id}`} className="hover:underline">{r.application.student_name}</Link>{r.scholar_type === 'PREVIOUS' && <span className="ml-2 text-xs text-muted">(previous)</span>}</td>
                      <td>{r.application.course}</td>
                      <td>{r.application.year_level}{r.application.year_level >= 4 && <span className="ml-1"><Badge tone="amber">Nearing graduation</Badge></span>}</td>
                      <td>{r.application.assigned_office ?? '—'}</td>
                      <td><Badge tone={r.participation_status === 'ACTIVE' ? 'green' : 'slate'}>{r.participation_status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="whitespace-nowrap">{formatDate(r.accepted_at)}</td>
                      <td className="whitespace-nowrap">{formatDate(r.activated_at)}</td>
                      <td className="whitespace-nowrap">{formatDateTime(r.updated_at)}</td>
                      <td className="text-right"><ScholarActions id={r.id} status={r.participation_status} name={r.application.student_name} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={SIZE} total={count ?? 0} basePath="/working-scholar/scholars" params={{ filter }} />
          </>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">Fourth-year scholars keep their slot until you deactivate them. Slots are never freed automatically.</p>
    </>
  );
}
