import Link from 'next/link';
import {
  CheckCircle2, ClipboardCheck, Clock, FileText, Gauge, MessageSquareWarning, Search, UserCheck, UserMinus,
} from 'lucide-react';
import { requireRole } from '@/lib/auth/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatusBadge, Badge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { countOf, getSlotSummary, getStatusCounts, must } from '@/lib/queries';
import { fetchReport } from '@/lib/reports';
import { formatDate, formatDateTime, monthLabel } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type AppLite = { id: string; application_no: string; student_name: string; course: string; application_date: string; status: string };
type FollowLite = { id: string; message: string; created_at: string; application: { id: string; application_no: string; student_name: string } | null };
type ScholarLite = { id: string; scholar_no: string; participation_status: string; updated_at: string; application: { student_name: string } | null };

export default async function WorkingScholarDashboard() {
  const { supabase } = await requireRole('WORKING_SCHOLAR_ADMIN');

  const since = new Date();
  since.setUTCDate(1);
  since.setUTCMonth(since.getUTCMonth() - 5);
  const sinceStr = since.toISOString().slice(0, 10);

  const [counts, slots, activeRes, inactiveRes, recentRes, awaitingRes, followRes, scholarRes, report] = await Promise.all([
    getStatusCounts(supabase),
    getSlotSummary(supabase),
    supabase.from('working_scholars').select('id', { count: 'exact', head: true }).eq('participation_status', 'ACTIVE'),
    supabase.from('working_scholars').select('id', { count: 'exact', head: true }).eq('participation_status', 'INACTIVE'),
    supabase.from('working_scholar_applications').select('id,application_no,student_name,course,application_date,status')
      .order('created_at', { ascending: false }).limit(6),
    supabase.from('working_scholar_applications').select('id,application_no,student_name,course,application_date,status')
      .in('status', ['PENDING', 'UNDER_REVIEW']).order('application_date', { ascending: true }).limit(6),
    supabase.from('follow_ups').select('id,message,created_at,application:working_scholar_applications(id,application_no,student_name)')
      .eq('status', 'OPEN').order('created_at', { ascending: true }).limit(6),
    supabase.from('working_scholars').select('id,scholar_no,participation_status,updated_at,application:working_scholar_applications(student_name)')
      .order('updated_at', { ascending: false }).limit(5),
    fetchReport(supabase, { from: sinceStr }),
  ]);
  if (report.error) throw new Error(report.error.message);

  const recent = must(recentRes) as AppLite[];
  const awaiting = must(awaitingRes) as AppLite[];
  const follow = must(followRes) as unknown as FollowLite[];
  const scholarChanges = must(scholarRes) as unknown as ScholarLite[];
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const n = (s: string) => counts[s] ?? 0;
  const monthly = report.report.by_month;
  const maxMonth = Math.max(1, ...monthly.map((m) => m.total));
  const pct = slots.configured && slots.max_slots > 0 ? Math.min(100, Math.round((slots.active_scholars / slots.max_slots) * 100)) : 0;

  return (
    <>
      <PageHeader title="Dashboard" description="Applications, follow-ups, scholars and slots at a glance." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total applications" value={total} icon={FileText} />
        <StatCard label="Pending" value={n('PENDING')} icon={Clock} />
        <StatCard label="Under review" value={n('UNDER_REVIEW')} icon={Search} />
        <StatCard label="Completed" value={n('COMPLETED')} icon={ClipboardCheck} />
        <StatCard label="For follow-up" value={n('FOR_FOLLOW_UP')} icon={MessageSquareWarning} />
        <StatCard label="Approved" value={n('APPROVED')} icon={CheckCircle2} />
        <StatCard label="Active scholars" value={countOf(activeRes)} icon={UserCheck} />
        <StatCard label="Inactive scholars" value={countOf(inactiveRes)} icon={UserMinus} />
        <StatCard label="Available slots" value={slots.configured ? slots.remaining : '—'} icon={Gauge} hint={slots.configured ? undefined : 'Not configured yet'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold">Recent applications</h2>
            <Link href="/working-scholar/applications" className="text-sm font-medium text-brand-deep hover:underline">View all</Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState title="No applications yet" description="Add an application record from the Applications page." />
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <Link href={`/working-scholar/applications/${a.id}`} className="min-w-0 hover:underline">
                    <p className="truncate font-medium">{a.student_name}</p>
                    <p className="text-xs text-muted">{a.application_no} · {a.course} · {formatDate(a.application_date)}</p>
                  </Link>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="border-b border-line px-4 py-3 font-semibold">Applications awaiting review</h2>
          {awaiting.length === 0 ? (
            <EmptyState title="Nothing waiting for review" />
          ) : (
            <ul className="divide-y divide-line">
              {awaiting.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <Link href={`/working-scholar/applications/${a.id}`} className="min-w-0 hover:underline">
                    <p className="truncate font-medium">{a.student_name}</p>
                    <p className="text-xs text-muted">Submitted {formatDate(a.application_date)}</p>
                  </Link>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold">Follow-ups needing attention</h2>
            <Link href="/working-scholar/follow-ups" className="text-sm font-medium text-brand-deep hover:underline">View all</Link>
          </div>
          {follow.length === 0 ? (
            <EmptyState title="No open follow-ups" />
          ) : (
            <ul className="divide-y divide-line">
              {follow.map((f) => (
                <li key={f.id} className="px-4 py-3 text-sm">
                  <Link href={f.application ? `/working-scholar/applications/${f.application.id}` : '#'} className="font-medium hover:underline">
                    {f.application?.student_name ?? 'Unknown'} <span className="text-xs font-normal text-muted">{f.application?.application_no}</span>
                  </Link>
                  <p className="line-clamp-2 text-muted">{f.message}</p>
                  <p className="text-xs text-muted">Opened {formatDateTime(f.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold">Slot availability</h2>
            <Link href="/working-scholar/slots" className="text-sm font-medium text-brand-deep hover:underline">Manage</Link>
          </div>
          {!slots.configured ? (
            <EmptyState title="Slots are not configured" description="Set the maximum number of working scholar slots to begin activating scholars." />
          ) : (
            <div className="p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-semibold tabular-nums">{slots.remaining}</p>
                <p className="text-sm text-muted">of {slots.max_slots} slots available</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-light" role="img" aria-label={`${pct}% of slots in use`}>
                <div className="h-full rounded-full bg-brand-deep" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">{slots.active_scholars} active scholars · applications are {slots.applications_open ? 'open' : 'closed'}</p>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="border-b border-line px-4 py-3 font-semibold">Recent scholar status changes</h2>
          {scholarChanges.length === 0 ? (
            <EmptyState title="No scholar records yet" description="Approved applications can be registered as scholars." />
          ) : (
            <ul className="divide-y divide-line">
              {scholarChanges.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.application?.student_name ?? 'Unknown'}</p>
                    <p className="text-xs text-muted">{s.scholar_no} · {formatDateTime(s.updated_at)}</p>
                  </div>
                  <Badge tone={s.participation_status === 'ACTIVE' ? 'green' : 'slate'}>{s.participation_status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="border-b border-line px-4 py-3 font-semibold">Monthly application summary</h2>
          {monthly.length === 0 ? (
            <EmptyState title="No applications in the last 6 months" />
          ) : (
            <ul className="space-y-3 p-4">
              {monthly.map((m) => (
                <li key={m.label} className="text-sm">
                  <div className="mb-1 flex justify-between"><span>{monthLabel(m.label)}</span><span className="tabular-nums text-muted">{m.total}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-brand-light"><div className="h-full rounded-full bg-brand" style={{ width: `${(m.total / maxMonth) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
