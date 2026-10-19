import { NextRequest, NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { dbError, jsonError, parseJson } from '@/lib/api';
import { studentApplicationSchema } from '@/lib/validations/student';

export async function POST(request: NextRequest) {
  const auth = await requireApiRole('STUDENT');
  if (auth.error) return auth.error;
  const parsed = await parseJson(request, studentApplicationSchema);
  if (parsed.error) return parsed.error;

  const { data: program, error: programError } = await auth.ctx.supabase
    .from('scholarship_programs')
    .select('id,name,application_type,is_active')
    .eq('id', parsed.data.program_id)
    .maybeSingle();
  if (programError) return dbError(programError);
  if (!program || !program.is_active) return jsonError('That program is not currently accepting applications.', 400);

  const { data: existing, error: existingError } = await auth.ctx.supabase
    .from('working_scholar_applications')
    .select('id')
    .eq('student_user_id', auth.ctx.profile.id)
    .eq('program_id', program.id)
    .not('status', 'in', '(DENIED,INACTIVE)')
    .limit(1)
    .maybeSingle();
  if (existingError) return dbError(existingError);
  if (existing) return jsonError('You already have an active application for this program.', 409);

  const { data, error } = await auth.ctx.supabase.from('working_scholar_applications').insert({
    program_id: program.id,
    application_type: program.application_type,
    student_user_id: auth.ctx.profile.id,
    student_number: null,
    student_name: auth.ctx.profile.full_name,
    email: auth.ctx.profile.email,
    course: parsed.data.course,
    year_level: parsed.data.year_level,
    assigned_office: program.application_type === 'FINANCIAL_AID' ? 'Finance' : 'Working Scholar',
    status: 'PENDING',
    created_by: auth.ctx.profile.id,
  }).select('id,application_no,status,application_date,application_type').single();
  if (error) return dbError(error);
  return NextResponse.json({ application: data }, { status: 201 });
}
