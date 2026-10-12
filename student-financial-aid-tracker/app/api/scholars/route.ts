import { NextResponse, type NextRequest } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { dbError, parseJson } from '@/lib/api';
import { scholarRegisterSchema } from '@/lib/validations/applications';

// Registers an APPROVED application as a scholar. The scholar starts INACTIVE:
// approval never activates a scholar automatically.
export async function POST(request: NextRequest) {
  const auth = await requireApiRole('WORKING_SCHOLAR_ADMIN');
  if (auth.error) return auth.error;
  const parsed = await parseJson(request, scholarRegisterSchema);
  if (parsed.error) return parsed.error;
  const { data, error } = await auth.ctx.supabase.rpc('register_scholar', {
    p_application_id: parsed.data.application_id, p_type: parsed.data.scholar_type,
  });
  if (error) return dbError(error);
  return NextResponse.json({ scholar: data }, { status: 201 });
}
