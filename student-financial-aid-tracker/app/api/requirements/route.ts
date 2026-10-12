import { NextResponse, type NextRequest } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { dbError, jsonError, parseJson } from '@/lib/api';
import { requirementCreateSchema, requirementUpdateSchema } from '@/lib/validations/applications';

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(['STUDENT', 'WORKING_SCHOLAR_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN']);
  if (auth.error) return auth.error;
  const type = request.nextUrl.searchParams.get('application_type');
  if (type !== 'WORKING_SCHOLAR' && type !== 'FINANCIAL_AID') {
    return jsonError('Choose a valid application type.', 400);
  }
  const { data, error } = await auth.ctx.supabase
    .from('document_requirements')
    .select('id,name,description,is_required,is_active,sort_order,application_type')
    .eq('application_type', type)
    .eq('is_active', true)
    .order('sort_order')
    .order('name');
  if (error) return dbError(error);
  return NextResponse.json({ requirements: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(['WORKING_SCHOLAR_ADMIN', 'FINANCE_ADMIN']);
  if (auth.error) return auth.error;
  const parsed = await parseJson(request, requirementCreateSchema);
  if (parsed.error) return parsed.error;
  const { data, error } = await auth.ctx.supabase
    .from('document_requirements').insert({
      ...parsed.data,
      application_type: auth.ctx.profile.role === 'FINANCE_ADMIN' ? 'FINANCIAL_AID' : 'WORKING_SCHOLAR',
      created_by: auth.ctx.profile.id,
    }).select('id').single();
  if (error) return dbError(error);
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiRole(['WORKING_SCHOLAR_ADMIN', 'FINANCE_ADMIN']);
  if (auth.error) return auth.error;
  const parsed = await parseJson(request, requirementUpdateSchema);
  if (parsed.error) return parsed.error;
  const { id, ...rest } = parsed.data;
  const changes = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  if (Object.keys(changes).length === 0) return jsonError('Nothing to update.', 422);
  const { data, error } = await auth.ctx.supabase.from('document_requirements').update(changes).eq('id', id).select('id').maybeSingle();
  if (error) return dbError(error);
  if (!data) return jsonError('Requirement not found.', 404);
  return NextResponse.json({ ok: true });
}
