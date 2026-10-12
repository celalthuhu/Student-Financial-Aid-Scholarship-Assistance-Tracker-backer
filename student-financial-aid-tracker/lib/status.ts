export const APPLICATION_STATUSES = [
  'PENDING', 'UNDER_REVIEW', 'COMPLETED', 'FOR_FOLLOW_UP', 'APPROVED', 'DENIED', 'INACTIVE',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  COMPLETED: 'Completed',
  FOR_FOLLOW_UP: 'For Follow-up',
  APPROVED: 'Approved',
  DENIED: 'Denied',
  INACTIVE: 'Inactive',
};

// Mirrors public.is_valid_status_transition() in schema.sql (the database is the authority).
export const STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  PENDING: ['UNDER_REVIEW', 'FOR_FOLLOW_UP', 'DENIED'],
  UNDER_REVIEW: ['COMPLETED', 'FOR_FOLLOW_UP', 'APPROVED', 'DENIED'],
  COMPLETED: ['UNDER_REVIEW', 'FOR_FOLLOW_UP', 'APPROVED', 'DENIED'],
  FOR_FOLLOW_UP: ['UNDER_REVIEW', 'COMPLETED', 'DENIED'],
  APPROVED: ['INACTIVE'],
  DENIED: ['UNDER_REVIEW'],
  INACTIVE: ['UNDER_REVIEW'],
};

export function isApplicationStatus(v: unknown): v is ApplicationStatus {
  return typeof v === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(v);
}

export const DOCUMENT_REVIEW_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'NEEDS_CORRECTION'] as const;
export type DocumentReviewStatus = (typeof DOCUMENT_REVIEW_STATUSES)[number];
export const DOCUMENT_REVIEW_LABELS: Record<DocumentReviewStatus, string> = {
  PENDING: 'Awaiting review',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  NEEDS_CORRECTION: 'Needs correction',
};
