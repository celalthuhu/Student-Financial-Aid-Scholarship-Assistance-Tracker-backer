import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Gauge,
  MessageSquareWarning,
  Search,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';
import { requireRole } from '@/lib/auth/permissions';
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

  const statCards = [
    { label: 'Total applications', value: total, icon: FileText, href: '/working-scholar/applications', tone: 'navy' as const },
    { label: 'Pending', value: n('PENDING'), icon: Clock, href: '/working-scholar/applications?status=PENDING', tone: 'amber' as const },
    { label: 'Under review', value: n('UNDER_REVIEW'), icon: Search, href: '/working-scholar/applications?status=UNDER_REVIEW', tone: 'sky' as const },
    { label: 'Completed', value: n('COMPLETED'), icon: ClipboardCheck, href: '/working-scholar/applications?status=COMPLETED', tone: 'green' as const },
    { label: 'For follow-up', value: n('FOR_FOLLOW_UP'), icon: MessageSquareWarning, href: '/working-scholar/follow-ups', tone: 'orange' as const },
    { label: 'Approved', value: n('APPROVED'), icon: CheckCircle2, href: '/working-scholar/applications?status=APPROVED', tone: 'green' as const },
    { label: 'Active scholars', value: countOf(activeRes), icon: UserCheck, href: '/working-scholar/scholars?status=ACTIVE', tone: 'sky' as const },
    { label: 'Inactive scholars', value: countOf(inactiveRes), icon: UserMinus, href: '/working-scholar/scholars?status=INACTIVE', tone: 'amber' as const },
    { label: 'Available slots', value: slots.configured ? slots.remaining : '—', icon: Gauge, href: '/working-scholar/slots', hint: slots.configured ? undefined : 'Not configured yet', tone: 'navy' as const },
  ];

  const quickActions = [
    { label: 'Review Applications', href: '/working-scholar/applications', icon: FileText },
    { label: 'Manage Requirements', href: '/working-scholar/requirements', icon: ClipboardCheck },
    { label: 'View Follow-ups', href: '/working-scholar/follow-ups', icon: MessageSquareWarning },
    { label: 'Manage Slots', href: '/working-scholar/slots', icon: Gauge },
    { label: 'Generate Report', href: '/working-scholar/reports', icon: Users },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-sky-200 bg-sky-50 p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
              Program overview
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Welcome back, Working Scholar Admin!</h1>
            <p className="mt-1.5 max-w-xl text-sm text-slate-600">Here&apos;s your program overview and the applications that need your attention.</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {quickActions.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800">
                  <Icon className="h-4 w-4" />
                  {label}
                  <ArrowRight className="h-3.5 w-3.5 text-sky-600" />
                </Link>
              ))}
            </div>
          </div>

          <div className="grid w-full max-w-md gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="text-xs font-medium text-slate-600">Needs action</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{n('PENDING') + n('UNDER_REVIEW') + n('FOR_FOLLOW_UP')}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="text-xs font-medium text-slate-600">Active scholars</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{countOf(activeRes)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-slate-600">Slots available</p>
                <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                  {slots.configured ? 'Configured' : 'Open'}
                </span>
              </div>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{slots.configured ? slots.remaining : '—'}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map(({ label, value, icon: Icon, href, hint, tone }) => (
          <StatCard key={label} label={label} value={value} icon={Icon} href={href} hint={hint} tone={tone} />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-sky-100 px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-slate-800">Recent applications</h2>
            <Link href="/working-scholar/applications" className="text-sm font-medium text-sky-700 hover:text-sky-800">View all</Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState title="No applications yet" description="Add an application record from the Applications page." />
          ) : (
            <ul className="divide-y divide-sky-100">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                  <Link href={`/working-scholar/applications/${a.id}`} className="min-w-0 hover:text-sky-700">
                    <p className="truncate font-semibold text-slate-800">{a.student_name}</p>
                    <p className="text-xs text-slate-500">{a.application_no} · {a.course} · {formatDate(a.application_date)}</p>
                  </Link>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-sky-100 px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-slate-800">Applications awaiting review</h2>
          </div>
          {awaiting.length === 0 ? (
            <EmptyState title="Nothing waiting for review" />
          ) : (
            <ul className="divide-y divide-sky-100">
              {awaiting.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                  <Link href={`/working-scholar/applications/${a.id}`} className="min-w-0 hover:text-sky-700">
                    <p className="truncate font-semibold text-slate-800">{a.student_name}</p>
                    <p className="text-xs text-slate-500">Submitted {formatDate(a.application_date)}</p>
                  </Link>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-sky-100 px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-slate-800">Follow-ups needing attention</h2>
            <Link href="/working-scholar/follow-ups" className="text-sm font-medium text-sky-700 hover:text-sky-800">View all</Link>
          </div>
          {follow.length === 0 ? (
            <EmptyState title="No open follow-ups" />
          ) : (
            <ul className="divide-y divide-sky-100">
              {follow.map((f) => (
                <li key={f.id} className="px-4 py-3 text-sm sm:px-5">
                  <Link href={f.application ? `/working-scholar/applications/${f.application.id}` : '#'} className="font-semibold text-slate-800 hover:text-sky-700">
                    {f.application?.student_name ?? 'Unknown'} <span className="text-xs font-normal text-slate-500">{f.application?.application_no}</span>
                  </Link>
                  <p className="mt-1 line-clamp-2 text-slate-600">{f.message}</p>
                  <p className="mt-2 text-xs text-slate-500">Opened {formatDateTime(f.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-sky-100 px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-slate-800">Slot availability</h2>
            <Link href="/working-scholar/slots" className="text-sm font-medium text-sky-700 hover:text-sky-800">Manage</Link>
          </div>
          {!slots.configured ? (
            <EmptyState title="Slots are not configured" description="Set the maximum number of working scholar slots to begin activating scholars." />
          ) : (
            <div className="p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-3xl font-bold tracking-[-0.05em] text-slate-900">{slots.remaining}</p>
                <p className="text-sm text-slate-500">of {slots.max_slots} slots available</p>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-sky-100" role="img" aria-label={`${pct}% of slots in use`}>
                <div className="h-full rounded-full bg-gradient-to-r from-sky-600 to-cyan-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-3 text-xs text-slate-500">{slots.active_scholars} active scholars · applications are {slots.applications_open ? 'open' : 'closed'}</p>
            </div>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-sky-100 px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-slate-800">Recent scholar status changes</h2>
          </div>
          {scholarChanges.length === 0 ? (
            <EmptyState title="No scholar records yet" description="Approved applications can be registered as scholars." />
          ) : (
            <ul className="divide-y divide-sky-100">
              {scholarChanges.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">{s.application?.student_name ?? 'Unknown'}</p>
                    <p className="text-xs text-slate-500">{s.scholar_no} · {formatDateTime(s.updated_at)}</p>
                  </div>
                  <Badge tone={s.participation_status === 'ACTIVE' ? 'green' : 'slate'}>{s.participation_status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-sky-100 px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-slate-800">Monthly application summary</h2>
          </div>
          {monthly.length === 0 ? (
            <EmptyState title="No applications in the last 6 months" />
          ) : (
            <ul className="space-y-3 p-4 sm:p-5">
              {monthly.map((m) => (
                <li key={m.label} className="text-sm">
                  <div className="mb-1 flex justify-between gap-2 text-slate-600">
                    <span>{monthLabel(m.label)}</span>
                    <span className="tabular-nums text-slate-500">{m.total}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-sky-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-500" style={{ width: `${(m.total / maxMonth) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
