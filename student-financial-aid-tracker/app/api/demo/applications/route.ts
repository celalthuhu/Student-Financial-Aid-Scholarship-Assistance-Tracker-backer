import { NextRequest, NextResponse } from 'next/server';
import { getDemoSession, isDemoModeEnabled } from '@/lib/demo-auth';
import { createDemoApplication, getDemoApplications, getDemoProgram, getDemoSettings } from '@/lib/demo-store';

export const runtime = 'nodejs';

export async function GET() {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  const session = await getDemoSession();
  if (!session) return NextResponse.json({ error: 'Please sign in to the local demo.' }, { status: 401 });
  return NextResponse.json({ applications: getDemoApplications(session.role, session.email) });
}

export async function POST(request: NextRequest) {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  const session = await getDemoSession();
  if (!session) return NextResponse.json({ error: 'Please sign in to the local demo.' }, { status: 401 });
  if (session.role !== 'STUDENT') return NextResponse.json({ error: 'Only students can submit demo applications.' }, { status: 403 });
  if (!getDemoSettings().applicationsOpen) return NextResponse.json({ error: 'Applications are currently closed.' }, { status: 409 });
  let body: { programId?: unknown; course?: unknown; yearLevel?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid application request.' }, { status: 400 });
  }
  if (typeof body.programId !== 'string'
    || typeof body.course !== 'string' || body.course.trim().length < 2 || body.course.trim().length > 120
    || !Number.isInteger(body.yearLevel) || Number(body.yearLevel) < 1 || Number(body.yearLevel) > 8) {
    return NextResponse.json({ error: 'Select a scholarship program and enter a valid course and year level (1–8).' }, { status: 400 });
  }
  const program = getDemoProgram(body.programId);
  if (!program || !program.isActive) return NextResponse.json({ error: 'That scholarship program is not available for applications.' }, { status: 400 });
  const application = createDemoApplication({
    programId: program.id, category: program.category, studentEmail: session.email, studentName: session.name,
    course: body.course.trim(), yearLevel: Number(body.yearLevel),
  });
  return NextResponse.json({ application }, { status: 201 });
}
