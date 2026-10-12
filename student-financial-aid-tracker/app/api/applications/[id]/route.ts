import { NextResponse, type NextRequest } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { dbError, jsonError, parseWith } from '@/lib/api';
import { applicationUpdateSchema, statusChangeSchema } from '@/lib/validations/applications';
import { isUuid } from '@/lib/utils';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  const auth = await requireApiRole(['WORKING_SCHOLAR_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN', 'STUDENT']);
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('Application not found.', 404);
  const { supabase } = auth.ctx;

  const [app, docs, followUps, history] = await Promise.all([
    supabase.from('working_scholar_applications').select('*').eq('id', id).maybeSingle(),
    supabase.from('application_documents').select('*').eq('application_id', id).order('created_at'),
    supabase.from('follow_ups').select('*').eq('application_id', id).order('created_at', { ascending: false }),
    supabase.from('application_status_history').select('*').eq('application_id', id).order('created_at', { ascending: false }),
  ]);
  if (app.error) return dbError(app.error);
  if (!app.data) return jsonError('Application not found.', 404);
  if (docs.error) return dbError(docs.error);
  if (followUps.error) return dbError(followUps.error);
  if (history.error) return dbError(history.error);
  return NextResponse.json({ application: app.data, documents: docs.data ?? [], followUps: followUps.data ?? [], history: history.data ?? [] });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireApiRole(['WORKING_SCHOLAR_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN']);
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('Application not found.', 404);

  let raw: Record<string, unknown>;
  try { raw = await request.json(); } catch { return jsonError('Invalid JSON body.', 400); }
  const { action, ...body } = raw;

  if (action === 'change_status') {
    const parsed = parseWith(body, statusChangeSchema);
    if (parsed.error) return parsed.error;
    // Transition rules, denial reason and history are enforced atomically inside the database function.
    const { data, error } = await auth.ctx.supabase.rpc('change_application_status', {
      p_application_id: id, p_new_status: parsed.data.status, p_reason: parsed.data.reason ?? null,
    });
    if (error) return dbError(error);
    return NextResponse.json({ application: data });
  }

  if (action === 'update_fields') {
    const parsed = parseWith(body, applicationUpdateSchema);
    if (parsed.error) return parsed.error;
    const changes = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
    const { data, error } = await auth.ctx.supabase
      .from('working_scholar_applications').update(changes).eq('id', id).select('id').maybeSingle();
    if (error) return dbError(error);
    if (!data) return jsonError('Application not found.', 404);
    return NextResponse.json({ ok: true });
  }

  return jsonError('Unknown action.', 400);
}
