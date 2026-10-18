import { NextResponse, type NextRequest } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { dbError } from '@/lib/api';
import { escapeCsv } from '@/lib/utils';
import { fetchReport, reportToCsvRows } from '@/lib/reports';

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(['WORKING_SCHOLAR_ADMIN', 'SUPER_ADMIN']);
  if (auth.error) return auth.error;
  const sp = request.nextUrl.searchParams;

  const result = await fetchReport(auth.ctx.supabase, {
    from: sp.get('from') ?? undefined, to: sp.get('to') ?? undefined,
    course: sp.get('course') ?? undefined, office: sp.get('office') ?? undefined,
  });
  if (result.error) return dbError(result.error);

  if (sp.get('format') === 'csv') {
    const csv = reportToCsvRows(result.report).map((r) => r.map(escapeCsv).join(',')).join('\r\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="working-scholar-report-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }
  return NextResponse.json({ report: result.report });
}
