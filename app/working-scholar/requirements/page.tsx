
import { requireRole } from '@/lib/auth/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { RequirementsManager } from '@/components/working-scholar/requirements-manager';
import { countOf } from '@/lib/queries';
import type { DocumentReviewStatus } from '@/lib/status';
import type { RequirementRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

type ReviewRecord = {
  id: string;
  review_status: DocumentReviewStatus;
  review_remarks: string | null;
  reviewed_at: string;
  reviewer: { full_name: string } | null;
};

type QueueRow = {
  id: string;
  file_name: string;
  storage_path: string | null;
  review_status: DocumentReviewStatus;
  review_remarks: string | null;
  created_at: string;
  reviewed_at: string | null;
  application: {
    id: string;
    application_no: string;
    student_name: string;
    application_date: string;
  } | null;
  requirement: { id: string; name: string } | null;
  reviews: ReviewRecord[];
};

async function supportsApplicationTypeFilter(supabase: any) {
  const { error } = await supabase
    .from('document_requirements')
    .select('application_type')
    .limit(1);

  if (!error) return true;

  return !/application_type|column .* does not exist|does not exist/i.test(
    error.message
  );
}

function describeError(label: string, result: any) {
  if (!result.error) return null;

  const error = result.error;

  return `${label}: ${JSON.stringify({
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  })}`;
}

export default async function RequirementsPage() {
  const { supabase } = await requireRole('WORKING_SCHOLAR_ADMIN');
  const supportsApplicationTypes =
    await supportsApplicationTypeFilter(supabase);

  const reqQuery = supabase
    .from('document_requirements')
    .select(
      'id,name,description,is_required,is_active,sort_order,accepted_mime_types,max_file_size_bytes,created_at,updated_at'
    );

  if (supportsApplicationTypes) {
    reqQuery.eq('application_type', 'WORKING_SCHOLAR');
  }

  const queueQuery = supabase
    .from('application_documents')
    .select(
      'id,file_name,storage_path,review_status,review_remarks,created_at,reviewed_at,application:working_scholar_applications!inner(id,application_no,student_name,application_date),requirement:document_requirements(id,name)'
    );

  if (supportsApplicationTypes) {
    queueQuery.eq('application.application_type', 'WORKING_SCHOLAR');
  }

  const [reqRes, queueRes, pendingRes, correctionRes] =
    await Promise.all([
      reqQuery.order('sort_order').order('name'),

      queueQuery.order('created_at', { ascending: true }).limit(500),

      // Awaiting-review count
      (() => {
        let query = supabase
          .from('application_documents')
          .select(
            'id,application:working_scholar_applications!inner(application_type)',
            { count: 'exact', head: true }
          )
          .eq('review_status', 'PENDING');

        if (supportsApplicationTypes) {
          query = query.eq(
            'application.application_type',
            'WORKING_SCHOLAR'
          );
        }

        return query;
      })(),

      // Needs-correction count
      (() => {
        let query = supabase
          .from('application_documents')
          .select(
            'id,application:working_scholar_applications!inner(application_type)',
            { count: 'exact', head: true }
          )
          .eq('review_status', 'NEEDS_CORRECTION');

        if (supportsApplicationTypes) {
          query = query.eq(
            'application.application_type',
            'WORKING_SCHOLAR'
          );
        }

        return query;
      })(),
    ]);

  const documentReviews: Record<string, ReviewRecord[]> = {};

  if (queueRes.data && queueRes.data.length > 0) {
    const documentIds = queueRes.data.map(
      (document: { id: string }) => document.id
    );

    const reviewsRes = await supabase
      .from('application_document_reviews')
      .select(
        'id,document_id,review_status,review_remarks,reviewed_at,reviewer:profiles!reviewed_by(full_name)'
      )
      .in('document_id', documentIds);

    if (!reviewsRes.error) {
      for (const review of reviewsRes.data ?? []) {
        const normalizedReview = {
          ...review,
          reviewer: Array.isArray(review.reviewer)
            ? review.reviewer[0] ?? null
            : review.reviewer ?? null,
        } as ReviewRecord;

        const list = documentReviews[review.document_id] ?? [];
        list.push(normalizedReview);
        documentReviews[review.document_id] = list;
      }
    }
  }

  const failedQueries = [
    describeError('Requirements', reqRes),
    describeError('Documents', queueRes),
    describeError('Awaiting-review total', pendingRes),
    describeError('Correction total', correctionRes),
  ].filter((message): message is string => Boolean(message));

  if (failedQueries.length > 0) {
    return (
      <>
        <PageHeader
          title="Requirements Management"
          description="Configure the documents students need to submit and review their uploaded requirements."
        />

        <section
          role="alert"
          className="card mx-auto max-w-3xl border border-red-200 p-6"
        >
          <h2 className="font-semibold text-red-900">
            Requirements data could not be loaded
          </h2>

          <p className="mt-2 text-sm text-red-800">
            One or more database queries failed. Use the error details below
            to identify the specific issue.
          </p>

          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-red-800">
            {failedQueries.map((message) => (
              <li key={message}>
                <code className="break-words whitespace-pre-wrap">
                  {message}
                </code>
              </li>
            ))}
          </ul>

          <form action="/working-scholar/requirements" className="mt-4">
            <button type="submit" className="btn-primary">
              Retry
            </button>
          </form>
        </section>
      </>
    );
  }

  const requirements = (reqRes.data ?? []) as RequirementRow[];

  const queue = (((queueRes.data ?? []) as Array<any>).map(
    (document) => ({
      ...document,
      application: Array.isArray(document.application)
        ? document.application[0] ?? null
        : document.application ?? null,
      requirement: Array.isArray(document.requirement)
        ? document.requirement[0] ?? null
        : document.requirement ?? null,
      reviews: documentReviews[document.id] ?? [],
    })
  )) as unknown as QueueRow[];

  const pendingCount = countOf(pendingRes);
  const correctionCount = countOf(correctionRes);

  return (
    <>
      <PageHeader
        title="Requirements Management"
        description="Configure the documents students need to submit and review their uploaded requirements."
      />

      <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        Configured active requirements appear in the student application and
        document checklist. Configure and confirm the official Working Scholar
        document checklist before accepting applications; no sample
        requirements have been preloaded. Proposed examples for Support
        Services to consider include student ID, enrollment certificate,
        class schedule, latest grades, application form, and other supporting
        documents. These examples are not confirmed policy.
      </div>

      <RequirementsManager
        requirements={requirements}
        documents={queue}
        pendingCount={pendingCount}
        correctionCount={correctionCount}
      />
    </>
  );
}
