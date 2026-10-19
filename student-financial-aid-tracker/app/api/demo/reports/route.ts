import { NextResponse } from 'next/server';
import { getDemoSession, isDemoModeEnabled } from '@/lib/demo-auth';
import { getDemoReport } from '@/lib/demo-store';

export const runtime = 'nodejs';

export async function GET() {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  const session = await getDemoSession();
  if (!session) return NextResponse.json({ error: 'Please sign in to the local demo.' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Only Super Admin can view system-wide reports.' }, { status: 403 });
  return NextResponse.json({ report: getDemoReport() });
}
