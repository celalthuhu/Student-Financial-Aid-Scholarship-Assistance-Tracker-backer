import { cn } from '@/lib/utils';
import { STATUS_LABELS, DOCUMENT_REVIEW_LABELS, isApplicationStatus, type DocumentReviewStatus } from '@/lib/status';

const TONES = {
  amber: 'bg-amber-100 text-amber-900 ring-amber-400',
  sky: 'bg-sky-100 text-sky-900 ring-sky-400',
  teal: 'bg-teal-100 text-teal-900 ring-teal-400',
  orange: 'bg-orange-100 text-orange-900 ring-orange-400',
  green: 'bg-emerald-100 text-emerald-900 ring-emerald-400',
  red: 'bg-red-100 text-red-900 ring-red-400',
  slate: 'bg-slate-200 text-slate-800 ring-slate-400',
};
export type Tone = keyof typeof TONES;

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', TONES[tone])}>{children}</span>;
}

const STATUS_TONE: Record<string, Tone> = {
  PENDING: 'amber', UNDER_REVIEW: 'sky', COMPLETED: 'teal', FOR_FOLLOW_UP: 'orange',
  APPROVED: 'green', DENIED: 'red', INACTIVE: 'slate',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'slate'}>{isApplicationStatus(status) ? STATUS_LABELS[status] : status}</Badge>;
}

const DOC_TONE: Record<DocumentReviewStatus, Tone> = { PENDING: 'amber', ACCEPTED: 'green', REJECTED: 'red', NEEDS_CORRECTION: 'orange' };
export function DocumentStatusBadge({ status }: { status: DocumentReviewStatus }) {
  return <Badge tone={DOC_TONE[status] ?? 'slate'}>{DOCUMENT_REVIEW_LABELS[status] ?? status}</Badge>;
}
