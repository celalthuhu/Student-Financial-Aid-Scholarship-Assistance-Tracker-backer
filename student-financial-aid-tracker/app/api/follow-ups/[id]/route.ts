import { NextResponse, type NextRequest } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { dbError, jsonError, parseJson } from '@/lib/api';
import { followUpResolveSchema } from '@/lib/validations/applications';
import { isUuid } from '@/lib/utils';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole('WORKING_SCHOLAR_ADMIN');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('Follow-up not found.', 404);
  const parsed = await parseJson(request, followUpResolveSchema);
  if (parsed.error) return parsed.error;
  const { data, error } = await auth.ctx.supabase.rpc('resolve_follow_up', {
    p_follow_up_id: id, p_note: parsed.data.resolution_note ?? null,
  });
  if (error) return dbError(error);
  return NextResponse.json({ followUp: data });
}
