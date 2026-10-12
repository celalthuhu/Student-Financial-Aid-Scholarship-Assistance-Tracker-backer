import { cn } from '@/lib/utils';
import { STATUS_LABELS, DOCUMENT_REVIEW_LABELS, isApplicationStatus, type DocumentReviewStatus } from '@/lib/status';

const TONES = {
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  sky: 'bg-sky-50 text-sky-800 ring-sky-200',
  teal: 'bg-teal-50 text-teal-800 ring-teal-200',
  orange: 'bg-orange-50 text-orange-800 ring-orange-200',
  green: 'bg-green-50 text-green-800 ring-green-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
};
export type Tone = keyof typeof TONES;

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', TONES[tone])}>{children}</span>;
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
