import { NextResponse, type NextRequest } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { dbError, parseJson } from '@/lib/api';
import { followUpCreateSchema } from '@/lib/validations/applications';

export async function POST(request: NextRequest) {
  const auth = await requireApiRole('WORKING_SCHOLAR_ADMIN');
  if (auth.error) return auth.error;
  const parsed = await parseJson(request, followUpCreateSchema);
  if (parsed.error) return parsed.error;
  const { data, error } = await auth.ctx.supabase.rpc('create_follow_up', {
    p_application_id: parsed.data.application_id, p_message: parsed.data.message,
    p_requirement_id: parsed.data.requirement_id ?? null, p_document_id: parsed.data.document_id ?? null,
  });
  if (error) return dbError(error);
  return NextResponse.json({ followUp: data }, { status: 201 });
}
