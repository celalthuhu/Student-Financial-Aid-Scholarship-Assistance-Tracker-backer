import { NextRequest, NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { jsonError, parseJson } from '@/lib/api';
import { studentProfileSchema } from '@/lib/validations/student';

export async function GET() {
  const auth = await requireApiRole('STUDENT');
  if (auth.error) return auth.error;
  return NextResponse.json({ profile: auth.ctx.profile });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiRole('STUDENT');
  if (auth.error) return auth.error;
  const parsed = await parseJson(request, studentProfileSchema);
  if (parsed.error) return parsed.error;
  const { data, error } = await auth.ctx.supabase.rpc('update_student_profile', {
    p_full_name: parsed.data.full_name,
  });
  if (error) {
    console.error('Student profile update failed:', error.message);
    return jsonError('Could not update your profile. Ensure the role-expansion SQL migration is applied.', 500);
  }
  return NextResponse.json({ profile: data });
}
