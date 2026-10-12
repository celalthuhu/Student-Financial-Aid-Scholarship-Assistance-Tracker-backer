import type { SupabaseClient } from '@supabase/supabase-js';
import type { SlotSummary } from '@/lib/types';

export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export function countOf(res: { count: number | null; error: { message: string } | null }): number {
  if (res.error) throw new Error(res.error.message);
  return res.count ?? 0;
}

export async function getSlotSummary(supabase: SupabaseClient): Promise<SlotSummary> {
  const res = await supabase.rpc('slot_summary').single();
  return must(res) as SlotSummary;
}

export async function getStatusCounts(supabase: SupabaseClient): Promise<Record<string, number>> {
  const rows = must(await supabase.rpc('application_status_counts')) as { status: string; total: number }[];
  const out: Record<string, number> = {};
  for (const r of rows ?? []) out[r.status] = Number(r.total);
  return out;
}

export async function getFilterOptions(supabase: SupabaseClient) {
  const data = must(await supabase.rpc('application_filter_options')) as { courses: string[]; offices: string[] };
  return { courses: data?.courses ?? [], offices: data?.offices ?? [] };
}
