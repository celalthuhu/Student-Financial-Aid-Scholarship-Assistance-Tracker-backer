import { NextResponse, type NextRequest } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { dbError, jsonError, parseJson } from '@/lib/api';
import { scholarParticipationSchema } from '@/lib/validations/applications';
import { isUuid } from '@/lib/utils';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole('WORKING_SCHOLAR_ADMIN');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('Scholar not found.', 404);
  const parsed = await parseJson(request, scholarParticipationSchema);
  if (parsed.error) return parsed.error;
  // Slot availability is checked atomically inside the database function.
  const { data, error } = await auth.ctx.supabase.rpc('set_scholar_participation', {
    p_scholar_id: id, p_status: parsed.data.participation_status,
  });
  if (error) return dbError(error);
  return NextResponse.json({ scholar: data });
}
