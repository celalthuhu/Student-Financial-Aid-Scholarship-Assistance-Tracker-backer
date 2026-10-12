import { requireRole } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export default async function FinanceReportsPage() {
  const { supabase } = await requireRole('FINANCE_ADMIN');
  const { data, error } = await supabase
    .from('working_scholar_applications')
    .select('status,assigned_office,application_type')
    .eq('application_type', 'FINANCIAL_AID');
  if (error) throw new Error(`Could not load Finance report: ${error.message}`);
  const applications = data ?? [];
  const counts = applications.reduce<Record<string, number>>((total, app) => {
    total[app.status] = (total[app.status] ?? 0) + 1;
    return total;
  }, {});
  return (
    <section className="card">
      <h1 className="border-b border-line px-4 py-3 font-semibold">Finance reports</h1>
      <p className="px-4 py-3 text-sm text-muted">{applications.length} financial aid applications in your permitted Finance scope.</p>
      <ul className="divide-y divide-line">
        {Object.entries(counts).map(([status, count]) => <li key={status} className="flex justify-between px-4 py-3 text-sm"><span>{status.replaceAll('_', ' ')}</span><strong>{count}</strong></li>)}
      </ul>
    </section>
  );
}
