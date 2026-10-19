import Link from 'next/link';
import { requireRole } from '@/lib/auth/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Badge } from '@/components/dashboard/status-badge';
import { ResolveFollowUpButton } from '@/components/working-scholar/resolve-follow-up-button';
import { PAGE_SIZE } from '@/lib/constants';
import { cn, firstParam, formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; message: string; status: 'OPEN' | 'RESOLVED'; created_at: string; resolved_at: string | null;
  application: { id: string; application_no: string; student_name: string } | null; requirement: { name: string } | null;
};
const TABS = [{ key: 'OPEN', label: 'Open' }, { key: 'RESOLVED', label: 'Resolved' }, { key: 'ALL', label: 'All' }];

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await requireRole('WORKING_SCHOLAR_ADMIN');
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === firstParam(sp.status)) ? (firstParam(sp.status) as string) : 'OPEN';
  const page = Math.max(1, parseInt(firstParam(sp.page) ?? '1', 10) || 1);

  let query = supabase.from('follow_ups')
    .select('id,message,status,created_at,resolved_at,application:working_scholar_applications(id,application_no,student_name),requirement:document_requirements(name)', { count: 'exact' })
    .order('created_at', { ascending: tab === 'OPEN' })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (tab !== 'ALL') query = query.eq('status', tab);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Follow-ups" description="Requests for missing or corrected documents. Create them from an application." />
      <div className="mb-4 flex gap-1 rounded-lg bg-brand-light p-1 sm:w-fit" role="tablist">
        {TABS.map((t) => (
          <Link key={t.key} href={`/working-scholar/follow-ups?status=${t.key}`} role="tab" aria-selected={tab === t.key}
            className={cn('rounded-md px-4 py-1.5 text-sm font-medium', tab === t.key ? 'bg-white text-brand-deep shadow-sm' : 'text-slate-600 hover:text-ink')}>{t.label}</Link>
        ))}
      </div>
      <div className="card">
        {rows.length === 0 ? (
          <EmptyState title={tab === 'OPEN' ? 'No open follow-ups' : 'No follow-ups found'} description="Follow-ups appear here when you request one from an application." />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {rows.map((f) => (
                <li key={f.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 text-sm">
                  <div className="min-w-0 max-w-2xl">
                    {f.application && <Link href={`/working-scholar/applications/${f.application.id}`} className="font-medium hover:underline">{f.application.student_name} <span className="text-xs font-normal text-muted">{f.application.application_no}</span></Link>}
                    <p className="mt-1">{f.message}</p>
                    <p className="mt-1 text-xs text-muted">{f.requirement?.name ?? 'General'} · requested {formatDateTime(f.created_at)}{f.resolved_at && ` · resolved ${formatDateTime(f.resolved_at)}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={f.status === 'OPEN' ? 'orange' : 'green'}>{f.status === 'OPEN' ? 'Open' : 'Resolved'}</Badge>
                    {f.status === 'OPEN' && <ResolveFollowUpButton id={f.id} />}
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/working-scholar/follow-ups" params={{ status: tab }} />
          </>
        )}
      </div>
    </>
  );
}
