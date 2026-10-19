import { NextResponse, type NextRequest } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { dbError, jsonError, parseWith } from '@/lib/api';
import { documentCreateSchema } from '@/lib/validations/applications';
import { ALLOWED_UPLOAD_TYPES, DOCUMENT_BUCKET, MAX_UPLOAD_BYTES } from '@/lib/constants';

// Records a document for an application. A file is optional: you can record a paper document
// received at the office (metadata only) or upload a scan to PRIVATE storage.
export async function POST(request: NextRequest) {
  const auth = await requireApiRole(['WORKING_SCHOLAR_ADMIN', 'FINANCE_ADMIN', 'STUDENT']);
  if (auth.error) return auth.error;

  let form: FormData;
  try { form = await request.formData(); } catch { return jsonError('Invalid form data.', 400); }

  const file = form.get('file');
  const hasFile = file instanceof File && file.size > 0;
  const parsed = parseWith(
    {
      application_id: form.get('application_id'),
      requirement_id: form.get('requirement_id') || null,
      file_name: (form.get('file_name') as string | null)?.trim() || (hasFile ? file.name : null),
    },
    documentCreateSchema,
  );
  if (parsed.error) return parsed.error;
  if (!parsed.data.file_name) return jsonError('Enter a document name or choose a file.', 422);

  let storagePath: string | null = null;
  if (hasFile) {
    if (file.size > MAX_UPLOAD_BYTES) return jsonError('File is too large. The limit is 10 MB.', 413);
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) return jsonError('Only PDF, PNG, JPEG or WebP files are allowed.', 415);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    storagePath = `${parsed.data.application_id}/${crypto.randomUUID()}-${safeName}`;
    const { error: upErr } = await auth.ctx.supabase.storage
      .from(DOCUMENT_BUCKET).upload(storagePath, file, { contentType: file.type, upsert: false });
    if (upErr) { console.error('Upload failed:', upErr.message); return jsonError('The file could not be uploaded. Nothing was saved.', 500); }
  }

  const { data, error } = await auth.ctx.supabase.from('application_documents').insert({
    application_id: parsed.data.application_id,
    requirement_id: parsed.data.requirement_id,
    file_name: parsed.data.file_name,
    storage_path: storagePath,
    mime_type: hasFile ? file.type : null,
    file_size: hasFile ? file.size : null,
    created_by: auth.ctx.profile.id,
  }).select('id').single();

  if (error) {
    if (storagePath) await auth.ctx.supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    return dbError(error);
  }
  return NextResponse.json(data, { status: 201 });
}
