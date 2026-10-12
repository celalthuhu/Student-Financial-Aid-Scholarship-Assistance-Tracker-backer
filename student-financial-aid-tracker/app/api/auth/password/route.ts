import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { jsonError, parseJson } from '@/lib/api';
import { passwordSchema } from '@/lib/validations/auth';

export async function POST(request: NextRequest) {
  const parsed = await parseJson(request, passwordSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return jsonError('Your Supabase session has expired. Sign in again before changing your password.', 401);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return jsonError('Password changes require the private SUPABASE_SERVICE_ROLE_KEY configuration.', 500);
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(data.user.id, {
    password: parsed.data.password,
    app_metadata: { ...data.user.app_metadata, require_password_change: false },
  });
  if (updateError) {
    console.error('Authenticated password update failed:', updateError.message);
    return jsonError('Could not update the password. Please try again.', 422);
  }

  return NextResponse.json({ ok: true });
}
