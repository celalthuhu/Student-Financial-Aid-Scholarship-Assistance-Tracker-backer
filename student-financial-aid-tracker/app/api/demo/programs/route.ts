import { NextRequest, NextResponse } from 'next/server';
import { getDemoSession, isDemoModeEnabled } from '@/lib/demo-auth';
import { createDemoProgram, getDemoPrograms, type DemoCategory } from '@/lib/demo-store';

export const runtime = 'nodejs';

type ProgramInput = { name: string; category: DemoCategory; description: string; eligibility: string; requirements: string[]; isActive: boolean };

function validProgram(value: unknown): value is ProgramInput {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.name === 'string' && candidate.name.trim().length > 2 && candidate.name.length <= 100
    && (candidate.category === 'ACADEMIC' || candidate.category === 'WORKING_SCHOLAR')
    && typeof candidate.description === 'string' && candidate.description.length <= 500
    && typeof candidate.eligibility === 'string' && candidate.eligibility.trim().length > 2 && candidate.eligibility.length <= 500
    && Array.isArray(candidate.requirements) && candidate.requirements.length <= 20
    && candidate.requirements.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 120)
    && typeof candidate.isActive === 'boolean';
}

export async function GET() {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  const session = await getDemoSession();
  if (!session) return NextResponse.json({ error: 'Please sign in to the local demo.' }, { status: 401 });
  return NextResponse.json({ programs: getDemoPrograms(session.role) });
}

export async function POST(request: NextRequest) {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  const session = await getDemoSession();
  if (!session) return NextResponse.json({ error: 'Please sign in to the local demo.' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Only Super Admin can create demo scholarship programs.' }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid program data.' }, { status: 400 }); }
  if (!validProgram(body)) return NextResponse.json({ error: 'Enter a program name, category, eligibility, description, and valid requirement list.' }, { status: 400 });
  const program = createDemoProgram({
    name: body.name.trim(), category: body.category as DemoCategory, description: body.description,
    eligibility: body.eligibility.trim(), requirements: body.requirements.map((item) => (item as string).trim()), isActive: body.isActive,
  });
  return NextResponse.json({ program }, { status: 201 });
}
