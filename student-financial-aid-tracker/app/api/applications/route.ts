import { NextResponse, type NextRequest } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { dbError, parseJson } from '@/lib/api';
import { applicationCreateSchema } from '@/lib/validations/applications';
import { PAGE_SIZE } from '@/lib/constants';
import { isApplicationStatus } from '@/lib/status';
import { sanitizeSearch } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(['WORKING_SCHOLAR_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN', 'STUDENT']);
  if (auth.error) return auth.error;
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
  const status = sp.get('status');
  const q = sanitizeSearch(sp.get('q') ?? '');

  let query = auth.ctx.supabase
    .from('working_scholar_applications')
    .select('id,application_no,student_name,course,year_level,assigned_office,application_date,status,updated_at,application_type,review_remarks,denial_reason,documents:application_documents(id,file_name,review_status,review_remarks)', { count: 'exact' })
    .order('application_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (auth.ctx.profile.role === 'STUDENT') {
    query = query.eq('student_user_id', auth.ctx.profile.id);
  }
  if (isApplicationStatus(status)) query = query.eq('status', status);
  if (q) query = query.or(`student_name.ilike.%${q}%,application_no.ilike.%${q}%,student_number.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) return dbError(error);
  return NextResponse.json({ applications: data, total: count ?? 0, page, pageSize: PAGE_SIZE });
}

// Initializes an application record until the student-facing module exists.
export async function POST(request: NextRequest) {
  const auth = await requireApiRole('WORKING_SCHOLAR_ADMIN');
  if (auth.error) return auth.error;
  const parsed = await parseJson(request, applicationCreateSchema);
  if (parsed.error) return parsed.error;

  const { application_date, ...fields } = parsed.data;
  const { data, error } = await auth.ctx.supabase
    .from('working_scholar_applications')
    .insert({ ...fields, ...(application_date ? { application_date } : {}), status: 'PENDING', created_by: auth.ctx.profile.id })
    .select('id,application_no')
    .single();
  if (error) return dbError(error);
  return NextResponse.json(data, { status: 201 });
}
