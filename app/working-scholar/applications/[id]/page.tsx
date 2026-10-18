import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/permissions';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { ApplicationFormDialog } from '@/components/working-scholar/application-form-dialog';
import { ApplicationActions } from '@/components/working-scholar/application-actions';
import { DocumentsPanel } from '@/components/working-scholar/documents-panel';
import { FollowUpsPanel } from '@/components/working-scholar/follow-ups-panel';
import { getFilterOptions, must } from '@/lib/queries';
import { formatDate, formatDateTime, isUuid } from '@/lib/utils';
import type { ApplicationRow, DocumentRow, FollowUpRow, RequirementRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

type HistoryRow = { id: string; from_status: string | null; to_status: string; reason: string | null; created_at: string; changer: { full_name: string } | null };

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireRole('WORKING_SCHOLAR_ADMIN');
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [appRes, docsRes, fuRes, histRes, reqRes, scholarRes, options] = await Promise.all([
    supabase.from('working_scholar_applications').select('*').eq('id', id).maybeSingle(),
    supabase.from('application_documents').select('*, requirement:document_requirements(name)').eq('application_id', id).order('created_at'),
    supabase.from('follow_ups').select('*, requirement:document_requirements(name)').eq('application_id', id).order('created_at', { ascending: false }),
    supabase.from('application_status_history').select('id,from_status,to_status,reason,created_at,changer:profiles!changed_by(full_name)')
      .eq('application_id', id).order('created_at', { ascending: false }),
    supabase.from('application_requirement_snapshots').select('requirement_id,name,description,is_required,application_type,accepted_mime_types,max_file_size_bytes,sort_order').eq('application_id', id).order('sort_order'),
    supabase.from('working_scholars').select('id,scholar_no,participation_status').eq('application_id', id).maybeSingle(),
    getFilterOptions(supabase),
  ]);
  if (appRes.error) throw new Error(appRes.error.message);
  if (!appRes.data) notFound();

  const app = appRes.data as ApplicationRow;
  const docs = must(docsRes) as unknown as DocumentRow[];
  const followUps = must(fuRes) as unknown as FollowUpRow[];
  const history = must(histRes) as unknown as HistoryRow[];
  const requirements = (must(reqRes) as {
    requirement_id: string | null; name: string; description: string | null; is_required: boolean;
    application_type: string; accepted_mime_types: string[]; max_file_size_bytes: number; sort_order: number;
  }[]).filter((requirement) => requirement.requirement_id).map((requirement) => ({
    id: requirement.requirement_id as string,
    name: requirement.name,
    description: requirement.description,
    is_required: requirement.is_required,
    is_active: true,
    sort_order: requirement.sort_order,
    accepted_mime_types: requirement.accepted_mime_types,
    max_file_size_bytes: requirement.max_file_size_bytes,
  })) as RequirementRow[];
  const scholar = must(scholarRes) as { id: string; scholar_no: string; participation_status: string } | null;

  const info: [string, string][] = [
    ['Student number', app.student_number ?? '—'], ['Email', app.email ?? '—'], ['Course', app.course],
    ['Year level', String(app.year_level)], ['Assigned office', app.assigned_office ?? '—'],
    ['Application date', formatDate(app.application_date)], ['Last updated', formatDateTime(app.updated_at)],
  ];

  return (
    <>
      <Link href="/working-scholar/applications" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Applications</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{app.application_no}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{app.student_name}</h1>
        </div>
        <StatusBadge status={app.status} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-semibold">Student information</h2>
              <ApplicationFormDialog mode="edit" application={app} offices={options.offices} />
            </div>
            <dl className="grid gap-4 p-4 sm:grid-cols-2">
              {info.map(([k, v]) => (<div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="text-sm font-medium">{v}</dd></div>))}
            </dl>
            {app.status === 'DENIED' && app.denial_reason && (
              <div className="mx-4 mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"><p className="font-medium">Denial reason</p><p>{app.denial_reason}</p></div>
            )}
            {app.decided_at && <p className="px-4 pb-4 text-xs text-muted">Decision recorded {formatDateTime(app.decided_at)}</p>}
          </section>

          <DocumentsPanel applicationId={app.id} documents={docs} requirements={requirements} />
          <FollowUpsPanel applicationId={app.id} followUps={followUps} requirements={requirements} />
        </div>

        <div className="space-y-6">
          <ApplicationActions application={app} scholar={scholar} />

          <section className="card">
            <h2 className="border-b border-line px-4 py-3 font-semibold">Status history</h2>
            {history.length === 0 ? <p className="p-4 text-sm text-muted">No history recorded.</p> : (
              <ol className="space-y-4 p-4">
                {history.map((h) => (
                  <li key={h.id} className="border-l-2 border-brand pl-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {h.from_status && <><StatusBadge status={h.from_status} /><span className="text-muted">to</span></>}
                      <StatusBadge status={h.to_status} />
                    </div>
                    {h.reason && <p className="mt-1 text-muted">{h.reason}</p>}
                    <p className="mt-1 text-xs text-muted">{h.changer?.full_name ?? 'System'} · {formatDateTime(h.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
