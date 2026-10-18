import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { dbError } from '@/lib/api';

export async function GET() {
  const auth = await requireApiRole(['FINANCE_ADMIN', 'SUPER_ADMIN']);
  if (auth.error) return auth.error;
  let query = auth.ctx.supabase
    .from('working_scholar_applications')
    .select('id,status,application_date,assigned_office,course,application_type');
  if (auth.ctx.profile.role === 'FINANCE_ADMIN') query = query.eq('application_type', 'FINANCIAL_AID');
  const { data, error } = await query;
  if (error) return dbError(error);
  const rows = data ?? [];
  return NextResponse.json({
    report: {
      total: rows.length,
      pending: rows.filter((row) => ['PENDING', 'UNDER_REVIEW', 'FOR_FOLLOW_UP'].includes(row.status)).length,
      approved: rows.filter((row) => row.status === 'APPROVED' || row.status === 'COMPLETED').length,
      denied: rows.filter((row) => row.status === 'DENIED').length,
      byOffice: Object.entries(rows.reduce<Record<string, number>>((totals, row) => {
        const office = row.assigned_office ?? 'Unassigned';
        totals[office] = (totals[office] ?? 0) + 1;
        return totals;
      }, {})).map(([office, count]) => ({ office, count })),
    },
  });
}
