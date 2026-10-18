import { NextRequest, NextResponse } from 'next/server';
import { getDemoSession, isDemoModeEnabled } from '@/lib/demo-auth';
import { getDemoUsers, setDemoUserActive } from '@/lib/demo-store';

export const runtime = 'nodejs';

export async function GET() {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  const session = await getDemoSession();
  if (!session) return NextResponse.json({ error: 'Please sign in to the local demo.' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Only Super Admin can manage users.' }, { status: 403 });
  return NextResponse.json({ users: getDemoUsers() });
}

export async function PATCH(request: NextRequest) {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  const session = await getDemoSession();
  if (!session) return NextResponse.json({ error: 'Please sign in to the local demo.' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Only Super Admin can manage users.' }, { status: 403 });
  let body: { email?: unknown; isActive?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid user update.' }, { status: 400 }); }
  if (typeof body.email !== 'string' || typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'Provide a demo email and active state.' }, { status: 400 });
  }
  if (body.email === session.email) return NextResponse.json({ error: 'You cannot deactivate your own demo account.' }, { status: 400 });
  const user = setDemoUserActive(body.email, body.isActive);
  if (!user) return NextResponse.json({ error: 'Demo account not found.' }, { status: 404 });
  return NextResponse.json({ user });
}
