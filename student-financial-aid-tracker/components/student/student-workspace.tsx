'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRight, Bell, BookOpenCheck, Check, CheckCircle2, ChevronRight, CircleHelp,
  Clock3, CloudUpload, FileCheck2, FileText, GraduationCap, Loader2, Search,
  ShieldCheck, Sparkles, UserRound, X,
} from 'lucide-react';

type ProgramType = 'WORKING_SCHOLAR' | 'FINANCIAL_AID';
type Program = {
  id: string;
  name: string;
  application_type: ProgramType;
  description: string;
  eligibility: string;
  requirements: string[];
  is_active: boolean;
};
type Requirement = {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  application_type: ProgramType;
};
type ApplicationDocument = {
  id: string;
  requirement_id: string | null;
  file_name: string;
  review_status: string;
  review_remarks: string | null;
  created_at?: string;
};
type Application = {
  id: string;
  application_no: string;
  student_name: string;
  course: string;
  year_level: number;
  application_date: string;
  updated_at: string;
  status: string;
  application_type: ProgramType;
  review_remarks: string | null;
  denial_reason: string | null;
  documents: ApplicationDocument[];
};
type Profile = { id: string; email: string; full_name: string };
type HistoryEntry = { id: string; from_status: string | null; to_status: string; reason: string | null; created_at: string };
type FollowUp = { id: string; message: string; status: string; created_at: string };
type ApplicationDetail = {
  application: Application;
  documents: ApplicationDocument[];
  history: HistoryEntry[];
  followUps: FollowUp[];
};

const DRAFT_KEY = 'student-aid-application-draft-v1';
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Submitted',
  UNDER_REVIEW: 'Under review',
  COMPLETED: 'Review completed',
  FOR_FOLLOW_UP: 'Action required',
  APPROVED: 'Approved',
  DENIED: 'Not approved',
  INACTIVE: 'Inactive',
};
async function readJson<T>(response: Response): Promise<T> {
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'The request could not be completed.');
  return result;
}

function niceDate(value: string | null | undefined) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}

function applicationTypeLabel(type: ProgramType) {
  return type === 'WORKING_SCHOLAR' ? 'Working Scholar Program' : 'Financial aid & scholarship';
}

function Pill({ children, color = 'sky' }: { children: React.ReactNode; color?: 'sky' | 'green' | 'amber' | 'slate' }) {
  const styles = {
    sky: 'bg-sky-100 text-sky-800',
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-900',
    slate: 'bg-slate-100 text-slate-700',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles[color]}`}>{children}</span>;
}

export function StudentWorkspace() {
  const pathname = usePathname();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationTotal, setApplicationTotal] = useState(0);
  const [applicationPage, setApplicationPage] = useState(1);
  const [morePending, setMorePending] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'ALL' | ProgramType>('ALL');
  const [applyProgram, setApplyProgram] = useState<Program | null>(null);
  const [applyStep, setApplyStep] = useState(0);
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState('1');
  const [submitPending, setSubmitPending] = useState(false);
  const [submitted, setSubmitted] = useState<{ reference: string; applicationId: string } | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState('');
  const [uploading, setUploading] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profilePending, setProfilePending] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const draftKey = profile?.id ? `${DRAFT_KEY}:${profile.id}` : null;

  const view = pathname.endsWith('/programs') ? 'programs'
    : pathname.endsWith('/applications') ? 'applications'
      : pathname.endsWith('/documents') ? 'documents'
        : pathname.endsWith('/notifications') ? 'notifications'
          : pathname.endsWith('/profile') ? 'profile'
            : pathname.endsWith('/help') ? 'help' : 'dashboard';

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    const requests = await Promise.allSettled([
      fetch('/api/scholarship-programs'),
      fetch('/api/applications?page=1'),
      fetch('/api/student/profile'),
      fetch('/api/requirements?application_type=WORKING_SCHOLAR'),
      fetch('/api/requirements?application_type=FINANCIAL_AID'),
    ]);
    const failures: string[] = [];
    try {
      if (requests[0].status === 'rejected') throw requests[0].reason;
      const result = await readJson<{ programs: Program[] }>(requests[0].value);
      setPrograms(result.programs);
    } catch (cause) {
      failures.push(cause instanceof Error ? cause.message : 'Scholarship opportunities could not be loaded.');
    }
    try {
      if (requests[1].status === 'rejected') throw requests[1].reason;
      const result = await readJson<{ applications: Application[]; total: number }>(requests[1].value);
      setApplications(result.applications);
      setApplicationTotal(result.total);
      setApplicationPage(1);
    } catch (cause) {
      failures.push(cause instanceof Error ? cause.message : 'Your applications could not be loaded.');
    }
    try {
      if (requests[2].status === 'rejected') throw requests[2].reason;
      const result = await readJson<{ profile: Profile }>(requests[2].value);
      setProfile(result.profile);
      setProfileName(result.profile.full_name ?? '');
    } catch (cause) {
      failures.push(cause instanceof Error ? cause.message : 'Your profile could not be loaded.');
    }
    const allRequirements: Requirement[] = [];
    for (const index of [3, 4]) {
      try {
        if (requests[index].status === 'rejected') throw requests[index].reason;
        const result = await readJson<{ requirements: Requirement[] }>(requests[index].value);
        allRequirements.push(...result.requirements);
      } catch {
        // Program-level requirement lists remain visible if configured checklist data is unavailable.
      }
    }
    setRequirements(allRequirements);
    setError(failures.join(' '));
    setLoading(false);
    setDraftReady(true);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!draftReady || !draftKey) return;
    try {
      const draft = JSON.parse(window.localStorage.getItem(draftKey) ?? '{}') as {
        course?: string; yearLevel?: string; programId?: string;
      };
      if (typeof draft.course === 'string') setCourse(draft.course);
      if (typeof draft.yearLevel === 'string') setYearLevel(draft.yearLevel);
      if (draft.programId) {
        const match = programs.find((program) => program.id === draft.programId);
        if (match) setApplyProgram(match);
      }
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey, draftReady, programs]);

  useEffect(() => {
    if (!draftReady || !draftKey || submitted) return;
    window.localStorage.setItem(draftKey, JSON.stringify({
      course, yearLevel, programId: applyProgram?.id ?? '',
    }));
  }, [applyProgram?.id, course, draftKey, draftReady, submitted, yearLevel]);

  const filteredPrograms = useMemo(() => programs.filter((program) => {
    const matchesQuery = `${program.name} ${program.description} ${program.eligibility}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === 'ALL' || program.application_type === category;
    return matchesQuery && matchesCategory;
  }), [category, programs, query]);

  function startApplication(program: Program) {
    setApplyProgram(program);
    setApplyStep(0);
    setSubmitted(null);
    setNotice('');
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!applyProgram) return;
    setSubmitPending(true);
    setError('');
    setNotice('');
    try {
      const result = await readJson<{ application: { id: string; application_no: string } }>(
        await fetch('/api/student/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ program_id: applyProgram.id, course, year_level: Number(yearLevel) }),
        }),
      );
      if (draftKey) window.localStorage.removeItem(draftKey);
      setSubmitted({ reference: result.application.application_no, applicationId: result.application.id });
      setNotice('Your application was submitted and saved.');
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your application could not be submitted.');
    } finally {
      setSubmitPending(false);
    }
  }

  async function uploadRequirement(applicationId: string, requirementId: string, file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Choose a file smaller than 10 MB.');
      return;
    }
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PDF, PNG, JPEG, or WebP file.');
      return;
    }
    setUploading(`${applicationId}:${requirementId}`);
    setError('');
    setNotice('');
    const form = new FormData();
    form.set('application_id', applicationId);
    form.set('requirement_id', requirementId || '');
    form.set('file', file);
    try {
      await readJson(await fetch('/api/documents', { method: 'POST', body: form }));
      setNotice('The document was uploaded securely.');
      await reload();
      if (detail?.application.id === applicationId) await loadDetails(applicationId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The document could not be uploaded.');
    } finally {
      setUploading('');
    }
  }

  async function loadDetails(applicationId: string) {
    setDetailLoading(applicationId);
    setError('');
    try {
      const result = await readJson<ApplicationDetail>(await fetch(`/api/applications/${applicationId}`));
      setDetail(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Application details could not be loaded.');
    } finally {
      setDetailLoading('');
    }
  }

  async function loadMoreApplications() {
    const nextPage = applicationPage + 1;
    setMorePending(true);
    setError('');
    try {
      const result = await readJson<{ applications: Application[]; total: number }>(
        await fetch(`/api/applications?page=${nextPage}`),
      );
      setApplications((current) => [...current, ...result.applications]);
      setApplicationTotal(result.total);
      setApplicationPage(nextPage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'More applications could not be loaded.');
    } finally {
      setMorePending(false);
    }
  }

  async function openDocument(documentId: string) {
    const preview = window.open('about:blank', '_blank');
    try {
      const result = await readJson<{ url: string }>(await fetch(`/api/documents/${documentId}`));
      if (preview) {
        preview.opener = null;
        preview.location.href = result.url;
      }
      else window.location.assign(result.url);
    } catch (cause) {
      preview?.close();
      setError(cause instanceof Error ? cause.message : 'The private document could not be opened.');
    }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfilePending(true);
    setError('');
    setNotice('');
    try {
      const result = await readJson<{ profile: Profile }>(await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: profileName }),
      }));
      setProfile(result.profile);
      setProfileName(result.profile.full_name);
      setNotice('Your profile was updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your profile could not be updated.');
    } finally {
      setProfilePending(false);
    }
  }

  const activeApplications = applications.filter((application) => !['DENIED', 'INACTIVE'].includes(application.status));
  const title = view === 'dashboard' ? 'Your scholarship journey'
    : view === 'programs' ? 'Scholarship opportunities'
      : view === 'applications' ? 'My applications'
        : view === 'documents' ? 'Requirements & documents'
          : view === 'notifications' ? 'Updates & notifications'
            : view === 'profile' ? 'My profile' : 'Help & support';

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Assumption College of Davao</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        </div>
        <p className="text-sm text-slate-600">A secure scholarship portal connected to your student account.</p>
      </header>

      {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />{notice}</div>}
      {loading && <div role="status" className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Loading your information…</div>}

      {view === 'dashboard' && (
        <>
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-50 via-white to-blue-100 p-6 shadow-sm ring-1 ring-sky-100 sm:p-9">
            <div aria-hidden="true" className="absolute -right-8 -top-10 h-48 w-48 rounded-full border-[22px] border-white/70" />
            <div className="relative max-w-3xl">
              <Pill color="sky"><Sparkles className="mr-1 h-3.5 w-3.5" />Your next step starts here</Pill>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
                Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} to your scholarship journey
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">
                Welcome to Assumption College of Davao. Explore scholarship opportunities, prepare your requirements, and take the next step toward achieving your educational goals.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link className="btn-primary inline-flex items-center gap-2" href="/student/programs">Explore scholarships <ArrowRight className="h-4 w-4" /></Link>
                <Link className="btn-secondary inline-flex items-center gap-2" href="/student/applications">Track my application <FileText className="h-4 w-4" /></Link>
                {(!profile?.full_name || profile.full_name.trim().length < 2) && <Link className="btn-secondary" href="/student/profile">Complete my profile</Link>}
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-3" aria-label="Student overview">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><p className="text-sm text-slate-600">Available opportunities</p><p className="mt-2 text-3xl font-bold text-slate-900">{programs.filter((p) => p.is_active).length}</p><Link className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky-800 hover:underline" href="/student/programs">Explore programs <ChevronRight className="h-4 w-4" /></Link></div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><p className="text-sm text-slate-600">Applications in progress</p><p className="mt-2 text-3xl font-bold text-slate-900">{activeApplications.length}</p><Link className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky-800 hover:underline" href="/student/applications">View applications <ChevronRight className="h-4 w-4" /></Link></div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><p className="text-sm text-slate-600">Documents submitted</p><p className="mt-2 text-3xl font-bold text-slate-900">{applications.reduce((sum, app) => sum + app.documents.length, 0)}</p><Link className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky-800 hover:underline" href="/student/documents">Review documents <ChevronRight className="h-4 w-4" /></Link></div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Scholarship opportunities</h2><p className="mt-1 text-sm text-slate-600">Current programs configured by your school.</p></div><Link className="text-sm font-semibold text-sky-800 hover:underline" href="/student/programs">See all</Link></div>
              {programs.length === 0 && !loading ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No active programs are published right now. Please check with the Scholarship Office for the latest requirements.</p> : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">{programs.filter((p) => p.is_active).slice(0, 2).map((program) => <ProgramCard key={program.id} program={program} onApply={startApplication} />)}</div>
              )}
            </div>
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <div className="flex items-center gap-2"><Bell className="h-5 w-5 text-sky-800" /><h2 className="text-lg font-bold text-slate-900">Announcements</h2></div>
              <p className="mt-3 text-sm leading-6 text-slate-600">There are no verified scholarship announcements configured at this time. Check this section again or contact the Scholarship Office.</p>
              <Link className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-800 hover:underline" href="/student/help">Get help <ChevronRight className="h-4 w-4" /></Link>
            </section>
          </section>
        </>
      )}

      {view === 'programs' && (
        <section className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <label className="relative block"><span className="sr-only">Search scholarships</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><input className="input pl-9" placeholder="Search opportunities" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <label className="text-sm font-medium text-slate-700">Category<select className="input mt-1" value={category} onChange={(event) => setCategory(event.target.value as 'ALL' | ProgramType)}><option value="ALL">All categories</option><option value="WORKING_SCHOLAR">Working Scholar</option><option value="FINANCIAL_AID">Financial aid</option></select></label>
            </div>
          </div>
          {filteredPrograms.length === 0 && !loading ? <EmptyState message={programs.length ? 'No programs match those filters.' : 'Please check with the Scholarship Office for current opportunities and requirements.'} link="/student/help" linkLabel="Help & support" /> : (
            <div className="grid gap-4 lg:grid-cols-2">{filteredPrograms.map((program) => <ProgramCard key={program.id} program={program} onApply={startApplication} expanded requirements={requirements.filter((item) => item.application_type === program.application_type)} />)}</div>
          )}
        </section>
      )}

      {view === 'applications' && (
        <section className="space-y-4">
          {applications.length === 0 && !loading ? <EmptyState message="You haven't submitted an application yet. Explore the available scholarships to get started." link="/student/programs" linkLabel="Explore scholarships" /> : applications.map((application) => (
            <article key={application.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div><Pill color={application.status === 'APPROVED' ? 'green' : application.status === 'FOR_FOLLOW_UP' ? 'amber' : 'sky'}>{STATUS_LABELS[application.status] ?? application.status.replaceAll('_', ' ')}</Pill><h2 className="mt-3 text-lg font-bold text-slate-900">{applicationTypeLabel(application.application_type)}</h2><p className="mt-1 text-sm text-slate-600">Reference <span className="font-semibold text-slate-800">{application.application_no}</span></p><p className="mt-1 text-sm text-slate-600">Submitted {niceDate(application.application_date)} · Updated {niceDate(application.updated_at)}</p></div>
                <button type="button" className="btn-secondary inline-flex items-center justify-center gap-2" disabled={detailLoading === application.id} onClick={() => void loadDetails(application.id)}>{detailLoading === application.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}View status & details</button>
              </div>
              {application.status === 'FOR_FOLLOW_UP' && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Please review the administrator feedback below and contact the Scholarship Office for permitted next steps. Document uploads are enabled only while the application is pending.</p>}
              {application.review_remarks && <p className="mt-3 text-sm text-slate-700"><strong>Administrator feedback:</strong> {application.review_remarks}</p>}
              {application.denial_reason && <p className="mt-3 text-sm text-rose-700"><strong>Decision note:</strong> {application.denial_reason}</p>}
              {detail?.application.id === application.id && <ApplicationDetails detail={detail} onOpenDocument={openDocument} />}
            </article>
          ))}
          {applications.length < applicationTotal && <button type="button" className="btn-secondary w-full" onClick={() => void loadMoreApplications()} disabled={morePending}>{morePending && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}Load older applications</button>}
        </section>
      )}

      {view === 'documents' && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-950"><strong>Private document storage.</strong> Uploads use the application’s secured Supabase bucket. Accepted files: PDF, PNG, JPEG, or WebP, up to 10 MB. Upload controls appear only when the database workflow permits changes.</div>
          {applications.length === 0 && !loading ? <EmptyState message="Documents can be uploaded after you submit an application." link="/student/programs" linkLabel="Explore scholarships" /> : applications.map((application) => (
            <article key={application.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">{application.application_no} · {applicationTypeLabel(application.application_type)}</h2><p className="mt-1 text-sm text-slate-600">{application.documents.length} uploaded document{application.documents.length === 1 ? '' : 's'}</p></div><Pill color={application.status === 'PENDING' ? 'green' : 'slate'}>{STATUS_LABELS[application.status] ?? application.status}</Pill></div>
              <DocumentList documents={application.documents} requirements={requirements.filter((r) => r.application_type === application.application_type)} onOpen={openDocument} />
              {application.status === 'PENDING' ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{requirements.filter((r) => r.application_type === application.application_type).map((requirement) => {
                const key = `${application.id}:${requirement.id}`;
                return <label key={requirement.id} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-sky-300 bg-sky-50/70 p-3 text-sm hover:bg-sky-50 focus-within:ring-2 focus-within:ring-sky-700"><span><span className="font-semibold text-slate-800">Upload: {requirement.name}</span><span className="block text-xs text-slate-600">{requirement.is_required ? 'Required' : 'Optional'}{requirement.description ? ` · ${requirement.description}` : ''}</span></span><span className="shrink-0 text-sky-900">{uploading === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-5 w-5" />}</span><input className="sr-only" type="file" accept=".pdf,image/png,image/jpeg,image/webp" disabled={!!uploading} onChange={(event) => { void uploadRequirement(application.id, requirement.id, event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>;
              })}</div> : <p className="mt-4 text-sm text-slate-600">This application is not in the pending state, so document uploads are currently disabled.</p>}
              {requirements.filter((r) => r.application_type === application.application_type).length === 0 && <p className="mt-3 text-sm text-slate-600">No checklist requirements have been configured for this program type. Review the program details or contact the Scholarship Office.</p>}
            </article>
          ))}
          {applications.length < applicationTotal && <button type="button" className="btn-secondary w-full" onClick={() => void loadMoreApplications()} disabled={morePending}>{morePending && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}Load older applications</button>}
        </section>
      )}

      {view === 'notifications' && (
        <section className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h2 className="font-bold text-slate-900">Application activity</h2><p className="mt-1 text-sm text-slate-600">Updates below come from your saved application status history and administrator follow-ups.</p></div>
          {applications.length === 0 && !loading ? <EmptyState message="Application updates will appear here after you submit an application." link="/student/programs" linkLabel="Explore scholarships" /> : applications.map((application) => (
            <article key={application.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><div className="flex items-start gap-3"><span className="mt-1 rounded-full bg-sky-100 p-2 text-sky-900"><Bell className="h-4 w-4" /></span><div className="min-w-0 flex-1"><h2 className="font-semibold text-slate-900">{application.application_no} · {STATUS_LABELS[application.status] ?? application.status.replaceAll('_', ' ')}</h2><p className="mt-1 text-sm text-slate-600">Latest record update: {niceDate(application.updated_at)}</p>{application.review_remarks && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{application.review_remarks}</p>}{application.denial_reason && <p className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{application.denial_reason}</p>}<button type="button" className="mt-3 text-sm font-semibold text-sky-800 hover:underline" onClick={() => void loadDetails(application.id)}>Load verified status history</button>{detail?.application.id === application.id && <ApplicationDetails detail={detail} compact onOpenDocument={openDocument} />}</div></div></article>
          ))}
          {applications.length < applicationTotal && <button type="button" className="btn-secondary w-full" onClick={() => void loadMoreApplications()} disabled={morePending}>{morePending && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}Load older applications</button>}
          <p className="text-xs text-slate-500">Read/unread notifications are not enabled by the current database schema; no messages are fabricated here.</p>
        </section>
      )}

      {view === 'profile' && (
        <section className="max-w-2xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
          <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-sky-100 p-3 text-sky-900"><UserRound className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-900">Student account details</h2><p className="text-sm text-slate-600">Only your display name can be changed here. Account email and permissions are managed securely.</p></div></div>
          <form className="space-y-4" onSubmit={updateProfile}>
            <label className="block text-sm font-medium text-slate-700">Full name<input className="input mt-1" value={profileName} maxLength={120} minLength={2} required onChange={(event) => setProfileName(event.target.value)} /></label>
            <label className="block text-sm font-medium text-slate-700">Account email<input className="input mt-1 bg-slate-50" value={profile?.email ?? ''} readOnly /></label>
            <p className="text-xs text-slate-500">Student number, course, and year level are stored on each application because the current profile schema does not maintain those fields separately.</p>
            <button className="btn-primary inline-flex items-center gap-2" type="submit" disabled={profilePending}>{profilePending && <Loader2 className="h-4 w-4 animate-spin" />}Save profile</button>
          </form>
        </section>
      )}

      {view === 'help' && (
        <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"><div className="flex items-center gap-2"><CircleHelp className="h-5 w-5 text-sky-800" /><h2 className="text-lg font-bold text-slate-900">How to use the portal</h2></div><div className="mt-4 space-y-4 text-sm leading-6 text-slate-700"><p><strong>1. Explore:</strong> review currently published opportunities and the eligibility information provided by the school.</p><p><strong>2. Apply:</strong> select a program, enter your course and year level, review the details, and confirm submission.</p><p><strong>3. Prepare documents:</strong> upload the configured checklist items while your application is pending. Files are private and linked to your own application.</p><p><strong>4. Track progress:</strong> check My Applications and Updates for the status and recorded feedback. Preliminary requirements do not guarantee approval.</p></div></div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"><div className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5 text-sky-800" /><h2 className="text-lg font-bold text-slate-900">Questions and assistance</h2></div><p className="mt-3 text-sm leading-6 text-slate-600">No verified Scholarship Office contact details or inquiry service are configured in this project. Please contact the school office through its official published channels for current requirements and deadlines.</p><Link className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-800 hover:underline" href="/student/programs">Review opportunities <ArrowRight className="h-4 w-4" /></Link></div>
        </section>
      )}

      {applyProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitPending) setApplyProgram(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="application-dialog-title" className="my-auto w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><Pill>{applicationTypeLabel(applyProgram.application_type)}</Pill><h2 id="application-dialog-title" className="mt-3 text-xl font-bold text-slate-900">Apply for {applyProgram.name}</h2><p className="mt-1 text-sm text-slate-600">Step {submitted ? 3 : applyStep + 1} of 3 · Your application details are saved to this browser as a draft until submission.</p></div><button type="button" aria-label="Close application" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setApplyProgram(null)}><X className="h-5 w-5" /></button></div>
            {submitted ? <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><CheckCircle2 className="h-7 w-7 text-emerald-700" /><h3 className="mt-3 text-lg font-bold text-emerald-950">Application received</h3><p className="mt-2 text-sm text-emerald-900">Supabase confirmed your submission. Keep this reference number for your records:</p><p className="mt-2 font-mono text-lg font-bold text-emerald-950">{submitted.reference}</p><p className="mt-3 text-sm text-emerald-900">You can upload requirements from the Requirements &amp; Documents page while the application remains pending.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/student/documents" className="btn-primary">Go to documents</Link><button type="button" className="btn-secondary" onClick={() => { setApplyProgram(null); setSubmitted(null); setCourse(''); setYearLevel('1'); }}>Done</button></div></div> : (
              <form className="mt-6" onSubmit={(event) => { if (applyStep < 2) { event.preventDefault(); setApplyStep((step) => step + 1); } else void submitApplication(event); }}>
                {applyStep === 0 && <div className="space-y-4"><div className="rounded-2xl bg-slate-50 p-4"><h3 className="font-semibold text-slate-900">Eligibility information</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{applyProgram.eligibility || 'Please check with the Scholarship Office for the latest requirements.'}</p><p className="mt-3 text-xs text-slate-600">This information is preliminary and does not guarantee eligibility or approval.</p></div><div><h3 className="font-semibold text-slate-900">Requirements</h3><ul className="mt-2 space-y-2">{applyProgram.requirements.length ? applyProgram.requirements.map((requirement) => <li key={requirement} className="flex items-start gap-2 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-800" />{requirement}</li>) : <li className="text-sm text-slate-600">Please check with the Scholarship Office for the latest requirements.</li>}</ul></div></div>}
                {applyStep === 1 && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Course or academic program<input className="input mt-1" value={course} required minLength={2} maxLength={120} onChange={(event) => setCourse(event.target.value)} /></label><label className="text-sm font-medium text-slate-700">Current year level<input className="input mt-1" type="number" min={1} max={8} required value={yearLevel} onChange={(event) => setYearLevel(event.target.value)} /></label><p className="sm:col-span-2 text-xs text-slate-500">Your name and email are taken from your authenticated student profile.</p></div>}
                {applyStep === 2 && <div className="rounded-2xl bg-sky-50 p-5"><h3 className="font-semibold text-slate-900">Review before submitting</h3><dl className="mt-3 space-y-2 text-sm"><div><dt className="inline font-medium text-slate-700">Program: </dt><dd className="inline text-slate-900">{applyProgram.name}</dd></div><div><dt className="inline font-medium text-slate-700">Applicant: </dt><dd className="inline text-slate-900">{profile?.full_name || 'Your student profile'}</dd></div><div><dt className="inline font-medium text-slate-700">Course / year: </dt><dd className="inline text-slate-900">{course}, Year {yearLevel}</dd></div></dl><p className="mt-4 text-sm text-slate-700">Submitting creates an application record in Supabase. You can track its actual status in My Applications.</p></div>}
                <div className="mt-6 flex flex-wrap justify-between gap-3"><button type="button" className="btn-secondary" onClick={() => applyStep === 0 ? setApplyProgram(null) : setApplyStep((step) => step - 1)}>{applyStep === 0 ? 'Cancel' : 'Back'}</button><button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={submitPending || !applyProgram.is_active}>{submitPending && <Loader2 className="h-4 w-4 animate-spin" />}{applyStep < 2 ? 'Continue' : submitPending ? 'Submitting…' : 'Confirm and submit'}</button></div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ProgramCard({ program, onApply, expanded = false, requirements = [] }: {
  program: Program; onApply: (program: Program) => void; expanded?: boolean; requirements?: Requirement[];
}) {
  const [showDetails, setShowDetails] = useState(expanded);
  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3"><span className="rounded-xl bg-sky-100 p-2.5 text-sky-900"><GraduationCap className="h-5 w-5" /></span><Pill color={program.is_active ? 'green' : 'slate'}>{program.is_active ? 'Applications available' : 'Not available'}</Pill></div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-sky-800">{applicationTypeLabel(program.application_type)}</p>
      <h2 className="mt-1 text-lg font-bold text-slate-900">{program.name}</h2>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{program.description || 'Please check with the Scholarship Office for program details.'}</p>
      {showDetails && <div className="mt-4 space-y-3 border-t border-slate-100 pt-4"><div><h3 className="text-sm font-semibold text-slate-900">Eligibility</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{program.eligibility || 'Please check with the Scholarship Office for the latest requirements.'}</p><p className="mt-1 text-xs text-slate-500">Final eligibility is verified by authorized staff.</p></div><div><h3 className="text-sm font-semibold text-slate-900">Requirements</h3>{requirements.length ? <ul className="mt-1 space-y-1">{requirements.map((requirement) => <li key={requirement.id} className="text-sm text-slate-700">• {requirement.name}{requirement.is_required ? ' (required)' : ' (optional)'}</li>)}</ul> : <ul className="mt-1 space-y-1">{program.requirements.length ? program.requirements.map((name) => <li key={name} className="text-sm text-slate-700">• {name}</li>) : <li className="text-sm text-slate-600">Please check with the Scholarship Office for the latest requirements.</li>}</ul>}</div><p className="text-xs text-slate-500">Application deadlines and contact details are not configured for this opportunity.</p></div>}
      <div className="mt-auto flex flex-wrap gap-2 pt-5"><button type="button" className="btn-secondary btn-sm" aria-expanded={showDetails} onClick={() => setShowDetails((value) => !value)}>{showDetails ? 'Hide details' : 'View details'}</button><button type="button" className="btn-primary btn-sm inline-flex items-center gap-1" disabled={!program.is_active} onClick={() => onApply(program)}>Apply now <ArrowRight className="h-4 w-4" /></button></div>
    </article>
  );
}

function DocumentList({ documents, requirements, onOpen }: {
  documents: ApplicationDocument[]; requirements: Requirement[]; onOpen: (id: string) => void;
}) {
  if (!documents.length && !requirements.length) return <p className="mt-4 text-sm text-slate-600">No documents or checklist items are recorded yet.</p>;
  return <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">{(documents.length ? documents : []).map((document) => {
    const linkedRequirement = requirements.find((item) => item.id === document.requirement_id);
    const label = document.review_status === 'ACCEPTED' ? 'Accepted'
      : document.review_status === 'NEEDS_CORRECTION' ? 'Needs replacement'
        : document.review_status === 'REJECTED' ? 'Rejected' : 'Awaiting review';
    return <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="flex min-w-0 items-center gap-2"><FileCheck2 className="h-4 w-4 shrink-0 text-sky-800" /><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{linkedRequirement?.name ?? document.file_name}</p><p className="text-xs text-slate-600">{document.file_name} · {niceDate(document.created_at)}</p>{document.review_remarks && <p className="mt-1 text-xs text-amber-800">{document.review_remarks}</p>}</div></div><div className="flex items-center gap-2"><Pill color={document.review_status === 'ACCEPTED' ? 'green' : document.review_status === 'NEEDS_CORRECTION' || document.review_status === 'REJECTED' ? 'amber' : 'slate'}>{label}</Pill><button type="button" className="text-xs font-semibold text-sky-800 hover:underline" onClick={() => onOpen(document.id)}>Open</button></div></li>;
  })}{requirements.filter((requirement) => requirement.is_required && !documents.some((document) => document.requirement_id === requirement.id)).map((requirement) => <li key={requirement.id} className="flex items-center justify-between gap-2 p-3 text-sm"><span className="flex items-center gap-2 text-slate-700"><Clock3 className="h-4 w-4 text-amber-700" />{requirement.name}</span><Pill color="amber">Missing</Pill></li>)}</ul>;
}

function ApplicationDetails({ detail, onOpenDocument, compact = false }: {
  detail: ApplicationDetail; onOpenDocument: (id: string) => void; compact?: boolean;
}) {
  return (
    <div className={`mt-5 border-t border-slate-100 pt-4 ${compact ? '' : 'grid gap-5 md:grid-cols-2'}`}>
      <section><h3 className="text-sm font-bold text-slate-900">Status history</h3>{detail.history.length ? <ol className="mt-3 space-y-3">{detail.history.map((entry) => <li key={entry.id} className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-600" /><div><p className="text-sm font-semibold text-slate-800">{STATUS_LABELS[entry.to_status] ?? entry.to_status.replaceAll('_', ' ')}</p><p className="text-xs text-slate-500">{niceDate(entry.created_at)}{entry.reason ? ` · ${entry.reason}` : ''}</p></div></li>)}</ol> : <p className="mt-2 text-sm text-slate-600">No status history has been recorded.</p>}</section>
      <section className="mt-4 md:mt-0"><h3 className="text-sm font-bold text-slate-900">Application documents</h3>{detail.documents.length ? <ul className="mt-2 space-y-2">{detail.documents.map((document) => <li key={document.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate text-slate-700">{document.file_name} · {document.review_status.replaceAll('_', ' ')}</span><button type="button" className="shrink-0 text-xs font-semibold text-sky-800 hover:underline" onClick={() => onOpenDocument(document.id)}>Open</button></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">No documents uploaded.</p>}{detail.followUps.length > 0 && <div className="mt-4"><h3 className="text-sm font-bold text-slate-900">Follow-up requests</h3><ul className="mt-2 space-y-2">{detail.followUps.map((followUp) => <li key={followUp.id} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{followUp.message}<span className="mt-1 block text-xs">{followUp.status} · {niceDate(followUp.created_at)}</span></li>)}</ul></div>}</section>
    </div>
  );
}

function EmptyState({ message, link, linkLabel }: { message: string; link: string; linkLabel: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-900"><GraduationCap className="h-6 w-6" /></span><h2 className="mt-4 font-bold text-slate-900">Nothing to show just yet</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{message}</p><Link className="btn-primary mt-5 inline-flex items-center gap-2" href={link}>{linkLabel}<ArrowRight className="h-4 w-4" /></Link></div>;
}
