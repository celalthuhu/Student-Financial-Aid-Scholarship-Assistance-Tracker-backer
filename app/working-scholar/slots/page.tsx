import { Gauge, GraduationCap, UserCheck, Users } from 'lucide-react';
import { requireRole } from '@/lib/auth/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/dashboard/status-badge';
import { SlotForm } from '@/components/working-scholar/slot-form';
import { WorkingScholarProgramsManager } from '@/components/working-scholar/programs-manager';
import { getSlotSummary, must } from '@/lib/queries';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Hist = { id: string; max_slots: number; applications_open: boolean; note: string | null; created_at: string; changer: { full_name: string } | null };

export default async function SlotsPage() {
  const { supabase } = await requireRole('WORKING_SCHOLAR_ADMIN');
  const [slots, histRes] = await Promise.all([
    getSlotSummary(supabase),
    supabase.from('slot_settings').select('id,max_slots,applications_open,note,created_at,changer:profiles!changed_by(full_name)')
      .order('created_at', { ascending: false }).limit(30),
  ]);
  const history = must(histRes) as unknown as Hist[];

  return (
    <>
      <PageHeader title="Slot management" description="Remaining slots = maximum slots − active scholars." />
      {!slots.configured && (
        <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No slot capacity has been set. Enter the maximum number of working scholar slots below. Scholars cannot be activated until you do.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Maximum slots" value={slots.configured ? slots.max_slots : '—'} icon={GraduationCap} />
        <StatCard label="Active scholars" value={slots.active_scholars} icon={UserCheck} />
        <StatCard label="Occupied slots" value={slots.active_scholars} icon={Users} hint="One slot per active scholar" />
        <StatCard label="Remaining slots" value={slots.configured ? slots.remaining : '—'} icon={Gauge} />
      </div>
      <p className="mt-4 text-sm">Applications are currently <Badge tone={slots.applications_open ? 'green' : 'slate'}>{slots.applications_open ? 'Open' : 'Closed'}</Badge></p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <SlotForm maxSlots={slots.configured ? slots.max_slots : 0} open={slots.applications_open} activeScholars={slots.active_scholars} />
        <section className="card self-start">
          <h2 className="border-b border-line px-4 py-3 font-semibold">Slot setting history</h2>
          {history.length === 0 ? <EmptyState title="No changes recorded" description="Each change to capacity or application status is logged here." /> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>When</th><th>Max slots</th><th>Applications</th><th>Changed by</th><th>Note</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="whitespace-nowrap">{formatDateTime(h.created_at)}</td><td>{h.max_slots}</td>
                      <td>{h.applications_open ? 'Open' : 'Closed'}</td><td>{h.changer?.full_name ?? 'System'}</td><td>{h.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <section className="mt-8 space-y-4">
        <PageHeader title="Working Scholar opportunities" description="Create opportunities from the shared scholarship program catalog and publish or save drafts for students." />
        <WorkingScholarProgramsManager />
      </section>
    </>
  );
}
