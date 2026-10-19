import { NextRequest, NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { dbError, jsonError } from '@/lib/api';

export async function GET() {
  const auth = await requireApiRole(['SUPER_ADMIN', 'WORKING_SCHOLAR_ADMIN', 'FINANCE_ADMIN', 'STUDENT']);
  if (auth.error) return auth.error;
  const { data, error } = await auth.ctx.supabase
    .from('scholarship_programs')
    .select('id,name,application_type,description,eligibility,requirements,is_active')
    .order('name');
  if (error) return dbError(error);
  return NextResponse.json({ programs: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole('SUPER_ADMIN');
  if (auth.error) return auth.error;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.', 400); }
  const { name, application_type, description, eligibility, requirements, is_active } = body;
  if (typeof name !== 'string' || name.trim().length < 3 || name.length > 120
    || (application_type !== 'WORKING_SCHOLAR' && application_type !== 'FINANCIAL_AID')
    || typeof description !== 'string' || description.length > 2000
    || typeof eligibility !== 'string' || eligibility.trim().length < 2 || eligibility.length > 2000
    || !Array.isArray(requirements) || requirements.length > 30
    || !requirements.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 200)
    || typeof is_active !== 'boolean') {
    return jsonError('Provide a valid program name, type, description, eligibility, requirements, and active state.', 400);
  }
  const { data, error } = await auth.ctx.supabase.from('scholarship_programs').insert({
    name: name.trim(), application_type, description: description.trim(), eligibility: eligibility.trim(),
    requirements: requirements.map((item) => (item as string).trim()), is_active, created_by: auth.ctx.profile.id,
  }).select('id,name,application_type,description,eligibility,requirements,is_active').single();
  if (error) return dbError(error);
  return NextResponse.json({ program: data }, { status: 201 });
}
