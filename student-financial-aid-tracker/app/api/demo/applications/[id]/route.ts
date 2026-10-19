import { NextRequest, NextResponse } from 'next/server';
import { getDemoSession, isDemoModeEnabled } from '@/lib/demo-auth';
import {
  canAccessCategory, deleteDemoApplication, getDemoApplication,
  updateDemoApplication, type DemoStatus,
} from '@/lib/demo-store';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
const statuses: DemoStatus[] = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'COMPLETED'];
const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

function canManage(session: { role: 'SUPER_ADMIN' | 'WORKING_SCHOLAR_ADMIN' | 'ACADEMIC_ADMIN' | 'STUDENT'; email: string }, application: { category: 'WORKING_SCHOLAR' | 'ACADEMIC'; studentEmail: string; status: DemoStatus }) {
  return session.role === 'STUDENT'
    ? session.email === application.studentEmail
    : canAccessCategory(session.role, application.category);
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  const session = await getDemoSession();
  if (!session) return NextResponse.json({ error: 'Please sign in to the local demo.' }, { status: 401 });
  const { id } = await params;
  const application = getDemoApplication(id);
  if (!application) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  if (!canManage(session, application)) return NextResponse.json({ error: 'You do not have access to this application.' }, { status: 403 });

  let body: { action?: unknown; status?: unknown; eligibility?: unknown; name?: unknown; mimeType?: unknown; dataUrl?: unknown; documentId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid application update.' }, { status: 400 });
  }

  if (body.action === 'change_status') {
    if (session.role === 'STUDENT') return NextResponse.json({ error: 'Students cannot update application status.' }, { status: 403 });
    if (typeof body.status !== 'string' || !statuses.includes(body.status as DemoStatus)) {
      return NextResponse.json({ error: 'Choose a valid application status.' }, { status: 400 });
    }
    const updated = updateDemoApplication(id, (item) => ({ ...item, status: body.status as DemoStatus }));
    return NextResponse.json({ application: updated });
  }

  if (body.action === 'review_eligibility') {
    if (session.role === 'STUDENT') return NextResponse.json({ error: 'Students cannot review eligibility.' }, { status: 403 });
    if (typeof body.eligibility !== 'string' || body.eligibility.trim().length < 2 || body.eligibility.trim().length > 500) {
      return NextResponse.json({ error: 'Enter an eligibility review note between 2 and 500 characters.' }, { status: 400 });
    }
    const updated = updateDemoApplication(id, (item) => ({ ...item, eligibility: body.eligibility!.toString().trim() }));
    return NextResponse.json({ application: updated });
  }

  if (body.action === 'add_document') {
    if (session.role === 'STUDENT' && application.status !== 'PENDING') {
      return NextResponse.json({ error: 'Requirements can only be changed while an application is Pending.' }, { status: 403 });
    }
    if (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 200
      || typeof body.mimeType !== 'string' || !allowedMimeTypes.includes(body.mimeType)
      || typeof body.dataUrl !== 'string' || !body.dataUrl.startsWith(`data:${body.mimeType};base64,`)
      || body.dataUrl.length > 1_400_000) {
      return NextResponse.json({ error: 'Choose a PDF, PNG, JPEG, or WebP file no larger than 1 MB.' }, { status: 400 });
    }
    const updated = updateDemoApplication(id, (item) => ({
      ...item,
      documents: [...item.documents, {
        id: `doc-${Date.now()}`, name: body.name as string, mimeType: body.mimeType as string, dataUrl: body.dataUrl as string,
      }],
    }));
    return NextResponse.json({ application: updated });
  }

  if (body.action === 'remove_document') {
    if (session.role === 'STUDENT' && application.status !== 'PENDING') {
      return NextResponse.json({ error: 'Requirements can only be changed while an application is Pending.' }, { status: 403 });
    }
    if (typeof body.documentId !== 'string' || !application.documents.some((document) => document.id === body.documentId)) {
      return NextResponse.json({ error: 'Requirement file not found.' }, { status: 404 });
    }
    const updated = updateDemoApplication(id, (item) => ({
      ...item, documents: item.documents.filter((document) => document.id !== body.documentId),
    }));
    return NextResponse.json({ application: updated });
  }

  return NextResponse.json({ error: 'Unknown application action.' }, { status: 400 });
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  if (!isDemoModeEnabled()) return NextResponse.json({ error: 'Local demo is disabled.' }, { status: 404 });
  const session = await getDemoSession();
  if (!session) return NextResponse.json({ error: 'Please sign in to the local demo.' }, { status: 401 });
  const { id } = await params;
  const application = getDemoApplication(id);
  if (!application) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  const allowed = session.role === 'SUPER_ADMIN'
    || (session.role === 'STUDENT'
      ? session.email === application.studentEmail && application.status === 'PENDING'
      : canAccessCategory(session.role, application.category));
  if (!allowed) return NextResponse.json({ error: 'You do not have access to delete this application.' }, { status: 403 });
  deleteDemoApplication(id);
  return NextResponse.json({ ok: true });
}
