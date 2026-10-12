import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { DEMO_ACCOUNTS } from '@/lib/demo-accounts';
import {
  createDemoToken, demoCookieName, demoCookieOptions, demoSigningIsAvailable,
  createDemoSessionForRole, getDemoSession, isDemoModeEnabled,
} from '@/lib/demo-auth';
import { isDemoUserActive } from '@/lib/demo-store';

export const runtime = 'nodejs';

export async function GET() {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  const session = await getDemoSession();
  if (!session) return NextResponse.json({ error: 'Please sign in to the local demo.' }, { status: 401 });
  return NextResponse.json({ session });
}

export async function POST(request: NextRequest) {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  let body: { role?: unknown; accessCode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid sign-in request.' }, { status: 400 });
  }

  const accessCode = typeof body.accessCode === 'string' ? Buffer.from(body.accessCode) : Buffer.alloc(0);
  const expectedCode = Buffer.from(process.env.DEMO_ACCESS_PASSWORD ?? '');
  if (!expectedCode.length || accessCode.length !== expectedCode.length || !timingSafeEqual(accessCode, expectedCode)) {
    return NextResponse.json({ error: 'Enter the configured demo access code.' }, { status: 401 });
  }
  if (typeof body.role === 'string') {
    const account = DEMO_ACCOUNTS.find((candidate) => candidate.role === body.role);
    if (account && !isDemoUserActive(account.email)) {
      return NextResponse.json({ error: 'This demo account is deactivated. Ask Super Admin to reactivate it.' }, { status: 403 });
    }
  }
  const session = createDemoSessionForRole(body.role);
  if (!session) return NextResponse.json({ error: 'Choose one of the available local demo roles.' }, { status: 400 });
  if (!demoSigningIsAvailable()) {
    return NextResponse.json({ error: 'Set DEMO_SESSION_SECRET to enable local demo authentication.' }, { status: 503 });
  }
  const token = createDemoToken(session);
  if (!token) return NextResponse.json({ error: 'Could not create a local demo session.' }, { status: 503 });
  const response = NextResponse.json({ session });
  response.cookies.set(demoCookieName(), token, demoCookieOptions());
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(demoCookieName(), '', { ...demoCookieOptions(), maxAge: 0 });
  return response;
}
