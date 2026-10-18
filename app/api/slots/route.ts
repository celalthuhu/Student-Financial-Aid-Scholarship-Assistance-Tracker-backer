import { NextResponse, type NextRequest } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { dbError, parseJson } from '@/lib/api';
import { slotSettingsSchema } from '@/lib/validations/slots';
import { getSlotSummary } from '@/lib/queries';

export async function GET() {
  const auth = await requireApiRole(['WORKING_SCHOLAR_ADMIN', 'SUPER_ADMIN']);
  if (auth.error) return auth.error;
  try {
    const summary = await getSlotSummary(auth.ctx.supabase);
    const { data, error } = await auth.ctx.supabase
      .from('slot_settings').select('id,max_slots,applications_open,note,created_at').order('created_at', { ascending: false }).limit(50);
    if (error) return dbError(error);
    return NextResponse.json({ summary, history: data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Could not load slot settings.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole('WORKING_SCHOLAR_ADMIN');
  if (auth.error) return auth.error;
  const parsed = await parseJson(request, slotSettingsSchema);
  if (parsed.error) return parsed.error;
  // The database function locks and re-counts active scholars, so capacity can never be over-allocated.
  const { data, error } = await auth.ctx.supabase.rpc('update_slot_settings', {
    p_max: parsed.data.max_slots, p_open: parsed.data.applications_open, p_note: parsed.data.note,
  });
  if (error) return dbError(error);
  return NextResponse.json({ settings: data });
}
