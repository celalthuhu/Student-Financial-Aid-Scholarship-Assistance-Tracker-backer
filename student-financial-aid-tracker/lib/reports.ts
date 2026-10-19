import type { SupabaseClient } from '@supabase/supabase-js';
import type { SlotSummary } from '@/lib/types';
import { STATUS_LABELS, isApplicationStatus } from '@/lib/status';
import { monthLabel } from '@/lib/utils';

export interface ReportRow { label: string; total: number; active?: number }
export interface Report {
  total_applications: number;
  by_status: ReportRow[];
  by_month: ReportRow[];
  participation: ReportRow[];
  by_course: ReportRow[];
  by_office: ReportRow[];
  fourth_year: { scholar_no: string; student_name: string; course: string; assigned_office: string | null; year_level: number; participation_status: string }[];
  slots: SlotSummary;
}
export interface ReportFilters { from?: string; to?: string; course?: string; office?: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function fetchReport(supabase: SupabaseClient, f: ReportFilters) {
  const { data, error } = await supabase.rpc('report_summary', {
    p_from: f.from && DATE.test(f.from) ? f.from : null,
    p_to: f.to && DATE.test(f.to) ? f.to : null,
    p_course: f.course || null,
    p_office: f.office || null,
  });
  if (error) return { error, report: null as never };
  return { error: null, report: data as Report };
}

export function reportToCsvRows(r: Report): (string | number)[][] {
  const rows: (string | number)[][] = [['Section', 'Label', 'Total', 'Active scholars']];
  rows.push(['Summary', 'Total applications', r.total_applications, '']);
  r.by_status.forEach((x) => rows.push(['Applications by status', isApplicationStatus(x.label) ? STATUS_LABELS[x.label] : x.label, x.total, '']));
  r.by_month.forEach((x) => rows.push(['Applications by month', monthLabel(x.label), x.total, '']));
  r.participation.forEach((x) => rows.push(['Scholar participation', x.label, x.total, '']));
  r.by_course.forEach((x) => rows.push(['Scholars by course', x.label, x.total, x.active ?? '']));
  r.by_office.forEach((x) => rows.push(['Scholars by office', x.label, x.total, x.active ?? '']));
  if (r.slots) {
    rows.push(['Slots', 'Maximum slots', r.slots.configured ? r.slots.max_slots : 'Not configured', '']);
    rows.push(['Slots', 'Active scholars', r.slots.active_scholars, '']);
    rows.push(['Slots', 'Remaining slots', r.slots.remaining, '']);
  }
  r.fourth_year.forEach((x) => rows.push(['Fourth-year scholars', `${x.scholar_no} - ${x.student_name} (${x.course})`, x.year_level, x.participation_status]));
  return rows;
}
