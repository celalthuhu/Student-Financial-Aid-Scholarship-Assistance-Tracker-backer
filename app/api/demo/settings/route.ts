import { NextRequest, NextResponse } from 'next/server';
import { getDemoSession, isDemoModeEnabled } from '@/lib/demo-auth';
import { getDemoSettings, updateDemoSettings } from '@/lib/demo-store';

export const runtime = 'nodejs';

export async function GET() {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  const session = await getDemoSession();
  if (!session) return NextResponse.json({ error: 'Please sign in to the local demo.' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Only Super Admin can view system settings.' }, { status: 403 });
  return NextResponse.json({ settings: getDemoSettings() });
}

export async function PATCH(request: NextRequest) {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  const session = await getDemoSession();
  if (!session) return NextResponse.json({ error: 'Please sign in to the local demo.' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Only Super Admin can change system settings.' }, { status: 403 });
  let body: { applicationsOpen?: unknown; academicMinGpa?: unknown; notice?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid settings update.' }, { status: 400 }); }
  if (body.applicationsOpen !== undefined && typeof body.applicationsOpen !== 'boolean'
    || body.academicMinGpa !== undefined && (typeof body.academicMinGpa !== 'number' || body.academicMinGpa < 0 || body.academicMinGpa > 4)
    || body.notice !== undefined && (typeof body.notice !== 'string' || body.notice.length > 500)) {
    return NextResponse.json({ error: 'Settings did not pass validation.' }, { status: 400 });
  }
  const settings = updateDemoSettings({
    ...(typeof body.applicationsOpen === 'boolean' ? { applicationsOpen: body.applicationsOpen } : {}),
    ...(typeof body.academicMinGpa === 'number' ? { academicMinGpa: body.academicMinGpa } : {}),
    ...(typeof body.notice === 'string' ? { notice: body.notice } : {}),
  });
  return NextResponse.json({ settings });
}
