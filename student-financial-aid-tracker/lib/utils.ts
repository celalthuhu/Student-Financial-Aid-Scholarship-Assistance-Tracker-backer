import type { ZodError } from 'zod';
import { APP_TIME_ZONE } from '@/lib/constants';

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatDate(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    timeZone: DATE_ONLY.test(v) ? 'UTC' : APP_TIME_ZONE,
  });
}

export function formatDateTime(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  });
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function sanitizeSearch(q: string) {
  return q.replace(/[,()%*\\"]/g, ' ').trim().slice(0, 60);
}

export function fieldErrorsOf(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function escapeCsv(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const ENTITY_LABELS: Record<string, string> = {
  working_scholar_applications: 'Application',
  application_documents: 'Document',
  follow_ups: 'Follow-up',
  working_scholars: 'Scholar record',
  document_requirements: 'Requirement',
  slot_settings: 'Slot settings',
  profiles: 'Administrator account',
};
const VERB_LABELS: Record<string, string> = {
  insert: 'created', update: 'updated', activate: 'activated', deactivate: 'deactivated',
};

export function humanizeAction(action: string) {
  const [entity, verb] = action.split('.');
  return `${ENTITY_LABELS[entity] ?? entity} ${VERB_LABELS[verb] ?? verb}`;
}
