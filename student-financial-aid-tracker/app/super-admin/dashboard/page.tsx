import { Building2, Gauge, GraduationCap, FileText, ShieldCheck, UserCheck, UserMinus } from 'lucide-react';
import { requireRole } from '@/lib/auth/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { countOf, getSlotSummary, must } from '@/lib/queries';
import { formatDateTime, humanizeAction } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type HistoryRow = {
  id: string; from_status: string | null; to_status: string; created_at: string;
  application: { application_no: string; student_name: string } | null;
};
type AuditRow = {
  id: string; action: string; created_at: string; details: { ref?: string; status?: string } | null;
  actor: { full_name: string } | null;
};

export default async function SuperAdminDashboard() {
  const { supabase } = await requireRole('SUPER_ADMIN');

  const [profilesRes, appsRes, activeRes, inactiveRes, slots, historyRes, auditRes] = await Promise.all([
    supabase.from('profiles').select('role'),
    supabase.from('working_scholar_applications').select('id', { count: 'exact', head: true }),
    supabase.from('working_scholars').select('id', { count: 'exact', head: true }).eq('participation_status', 'ACTIVE'),
    supabase.from('working_scholars').select('id', { count: 'exact', head: true }).eq('participation_status', 'INACTIVE'),
    getSlotSummary(supabase),
    supabase.from('application_status_history')
      .select('id,from_status,to_status,created_at,application:working_scholar_applications(application_no,student_name)')
      .order('created_at', { ascending: false }).limit(8),
    supabase.from('audit_logs')
      .select('id,action,created_at,details,actor:profiles!actor_id(full_name)')
      .order('created_at', { ascending: false }).limit(8),
  ]);

  const profiles = must(profilesRes) as { role: string }[];
  const history = must(historyRes) as unknown as HistoryRow[];
  const audit = must(auditRes) as unknown as AuditRow[];
  const wsaCount = profiles.filter((p) => p.role === 'WORKING_SCHOLAR_ADMIN').length;

  return (
    <>
      <PageHeader title="Super Admin dashboard" description="Overview of administrator accounts and working scholar activity." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Administrator accounts" value={profiles.length} icon={ShieldCheck} />
        <StatCard label="Working Scholar Admins" value={wsaCount} icon={Building2} />
        <StatCard label="Total applications" value={countOf(appsRes)} icon={FileText} />
        <StatCard label="Active scholars" value={countOf(activeRes)} icon={UserCheck} />
        <StatCard label="Inactive scholars" value={countOf(inactiveRes)} icon={UserMinus} />
        <StatCard label="Maximum slots" value={slots.configured ? slots.max_slots : '—'} icon={GraduationCap} hint={slots.configured ? undefined : 'Not configured yet'} />
        <StatCard label="Available slots" value={slots.configured ? slots.remaining : '—'} icon={Gauge} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="border-b border-line px-4 py-3 font-semibold">Recent application activity</h2>
          {history.length === 0 ? (
            <EmptyState title="No application activity yet" description="Status changes appear here once application records exist." />
          ) : (
            <ul className="divide-y divide-line">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{h.application?.student_name ?? 'Unknown student'}</p>
                    <p className="text-xs text-muted">{h.application?.application_no} · {formatDateTime(h.created_at)}</p>
                  </div>
                  <StatusBadge status={h.to_status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="border-b border-line px-4 py-3 font-semibold">Recent administrator activity</h2>
          {audit.length === 0 ? (
            <EmptyState title="No administrator activity yet" description="Account and record changes are logged here." />
          ) : (
            <ul className="divide-y divide-line">
              {audit.map((a) => (
                <li key={a.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">{humanizeAction(a.action)}{a.details?.ref ? ` · ${a.details.ref}` : ''}</p>
                  <p className="text-xs text-muted">{a.actor?.full_name ?? 'System'} · {formatDateTime(a.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
