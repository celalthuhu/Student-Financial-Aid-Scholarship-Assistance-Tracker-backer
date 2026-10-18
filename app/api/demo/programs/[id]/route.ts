import { NextRequest, NextResponse } from 'next/server';
import { getDemoSession, isDemoModeEnabled } from '@/lib/demo-auth';
import { canAccessCategory, deleteDemoProgram, getDemoProgram, updateDemoProgram } from '@/lib/demo-store';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
type ProgramUpdate = { name?: unknown; description?: unknown; eligibility?: unknown; requirements?: unknown; isActive?: unknown };

function validUpdate(body: ProgramUpdate) {
  return (body.name === undefined || (typeof body.name === 'string' && body.name.trim().length > 2 && body.name.length <= 100))
    && (body.description === undefined || (typeof body.description === 'string' && body.description.length <= 500))
    && (body.eligibility === undefined || (typeof body.eligibility === 'string' && body.eligibility.trim().length > 2 && body.eligibility.length <= 500))
    && (body.requirements === undefined || (Array.isArray(body.requirements) && body.requirements.length <= 20
      && body.requirements.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 120)))
    && (body.isActive === undefined || typeof body.isActive === 'boolean');
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  const session = await getDemoSession();
  if (!session) return NextResponse.json({ error: 'Please sign in to the local demo.' }, { status: 401 });
  const { id } = await params;
  const program = getDemoProgram(id);
  if (!program) return NextResponse.json({ error: 'Scholarship program not found.' }, { status: 404 });
  if (session.role !== 'SUPER_ADMIN' && !canAccessCategory(session.role, program.category)) {
    return NextResponse.json({ error: 'You do not have access to this scholarship program.' }, { status: 403 });
  }
  if (session.role === 'STUDENT') return NextResponse.json({ error: 'Students can browse programs but cannot edit them.' }, { status: 403 });
  let body: ProgramUpdate;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid program data.' }, { status: 400 }); }
  if (!validUpdate(body)) return NextResponse.json({ error: 'Program changes did not pass validation.' }, { status: 400 });
  const updated = updateDemoProgram(id, (item) => ({
    ...item,
    ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
    ...(typeof body.description === 'string' ? { description: body.description } : {}),
    ...(typeof body.eligibility === 'string' ? { eligibility: body.eligibility.trim() } : {}),
    ...(Array.isArray(body.requirements) ? { requirements: body.requirements.map((value) => (value as string).trim()) } : {}),
    ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
  }));
  return NextResponse.json({ program: updated });
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  const session = await getDemoSession();
  if (!session) return NextResponse.json({ error: 'Please sign in to the local demo.' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Only Super Admin can delete demo programs.' }, { status: 403 });
  const { id } = await params;
  const deleted = deleteDemoProgram(id);
  if (!deleted) return NextResponse.json({ error: 'Program not found or it has applications and cannot be deleted.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
