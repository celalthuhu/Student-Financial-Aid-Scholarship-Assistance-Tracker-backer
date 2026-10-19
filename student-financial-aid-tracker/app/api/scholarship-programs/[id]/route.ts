import { NextRequest, NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { dbError, jsonError } from '@/lib/api';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await requireApiRole('SUPER_ADMIN');
  if (auth.error) return auth.error;
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.', 400); }
  const changes: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 3 || body.name.length > 120) return jsonError('Program name must be 3 to 120 characters.', 400);
    changes.name = body.name.trim();
  }
  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.length > 2000) return jsonError('Program description is too long.', 400);
    changes.description = body.description.trim();
  }
  if (body.eligibility !== undefined) {
    if (typeof body.eligibility !== 'string' || body.eligibility.trim().length < 2 || body.eligibility.length > 2000) return jsonError('Provide valid eligibility criteria.', 400);
    changes.eligibility = body.eligibility.trim();
  }
  if (body.requirements !== undefined) {
    if (!Array.isArray(body.requirements) || body.requirements.length > 30
      || !body.requirements.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 200)) {
      return jsonError('Provide up to 30 valid requirement names.', 400);
    }
    changes.requirements = body.requirements.map((item) => (item as string).trim());
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') return jsonError('Program active state must be a boolean.', 400);
    changes.is_active = body.is_active;
  }
  if (Object.keys(changes).length === 0) return jsonError('No program changes were provided.', 400);
  const { data, error } = await auth.ctx.supabase.from('scholarship_programs').update(changes)
    .eq('id', id).select('id,name,application_type,description,eligibility,requirements,is_active').maybeSingle();
  if (error) return dbError(error);
  if (!data) return jsonError('Scholarship program not found.', 404);
  return NextResponse.json({ program: data });
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const auth = await requireApiRole('SUPER_ADMIN');
  if (auth.error) return auth.error;
  const { id } = await params;
  const { error, count } = await auth.ctx.supabase.from('scholarship_programs').delete({ count: 'exact' }).eq('id', id);
  if (error) return dbError(error);
  if (!count) return jsonError('Scholarship program not found.', 404);
  return NextResponse.json({ ok: true });
}
