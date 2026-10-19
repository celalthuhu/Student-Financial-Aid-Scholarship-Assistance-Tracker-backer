import { NextResponse } from 'next/server';
import { getDemoSession, isDemoModeEnabled } from '@/lib/demo-auth';
import { getDemoSettings } from '@/lib/demo-store';

export const runtime = 'nodejs';

export async function GET() {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  const session = await getDemoSession();
  if (!session) return NextResponse.json({ error: 'Please sign in to the local demo.' }, { status: 401 });
  const { applicationsOpen, academicMinGpa } = getDemoSettings();
  return NextResponse.json({ settings: { applicationsOpen, academicMinGpa } });
}
