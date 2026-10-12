import Link from 'next/link';
import { requireRole } from '@/lib/auth/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { DocumentStatusBadge } from '@/components/dashboard/status-badge';
import { RequirementsManager } from '@/components/working-scholar/requirements-manager';
import { must } from '@/lib/queries';
import { formatDate } from '@/lib/utils';
import type { DocumentReviewStatus } from '@/lib/status';
import type { RequirementRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

type QueueRow = {
  id: string; file_name: string; review_status: DocumentReviewStatus; created_at: string;
  application: { id: string; application_no: string; student_name: string } | null;
  requirement: { name: string } | null;
};

export default async function RequirementsPage() {
  const { supabase } = await requireRole('WORKING_SCHOLAR_ADMIN');
  const [reqRes, queueRes] = await Promise.all([
    supabase.from('document_requirements').select('id,name,description,is_required,is_active,sort_order').order('sort_order').order('name'),
    supabase.from('application_documents')
      .select('id,file_name,review_status,created_at,application:working_scholar_applications(id,application_no,student_name),requirement:document_requirements(name)')
      .in('review_status', ['PENDING', 'NEEDS_CORRECTION']).order('created_at', { ascending: true }).limit(25),
  ]);
  const requirements = must(reqRes) as RequirementRow[];
  const queue = must(queueRes) as unknown as QueueRow[];

  return (
    <>
      <PageHeader title="Requirements" description="Configure the documents your office requires and review submitted documents." />
      <div className="grid gap-6 xl:grid-cols-2">
        <RequirementsManager requirements={requirements} />
        <section className="card self-start">
          <h2 className="border-b border-line px-4 py-3 font-semibold">Documents waiting for review</h2>
          {queue.length === 0 ? (
            <EmptyState title="No documents waiting" description="Documents appear here after they are recorded on an application." />
          ) : (
            <ul className="divide-y divide-line">
              {queue.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.file_name}</p>
                    <p className="text-xs text-muted">
                      {d.requirement?.name ?? 'Other'} ·{' '}
                      {d.application ? <Link className="hover:underline" href={`/working-scholar/applications/${d.application.id}`}>{d.application.student_name} ({d.application.application_no})</Link> : 'Unknown'} · {formatDate(d.created_at)}
                    </p>
                  </div>
                  <DocumentStatusBadge status={d.review_status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
