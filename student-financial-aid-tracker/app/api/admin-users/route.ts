import { NextResponse, type NextRequest } from 'next/server';
import { requireApiRole } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { dbError, jsonError, parseJson } from '@/lib/api';
import { adminUserCreateSchema, adminUserToggleSchema } from '@/lib/validations/auth';
import { getSiteUrl } from '@/lib/env';

export async function GET() {
  const auth = await requireApiRole('SUPER_ADMIN');
  if (auth.error) return auth.error;
  const { data, error } = await auth.ctx.supabase
    .from('profiles').select('id,email,full_name,role,is_active,created_at').order('created_at');
  if (error) return dbError(error);
  return NextResponse.json({ users: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole('SUPER_ADMIN');
  if (auth.error) return auth.error;
  const parsed = await parseJson(request, adminUserCreateSchema);
  if (parsed.error) return parsed.error;
  const { email, full_name, role, mode, password } = parsed.data;

  let admin;
  try { admin = createAdminClient(); } catch { return jsonError('Server is missing SUPABASE_SERVICE_ROLE_KEY. See README.md.', 500); }

  const created = mode === 'invite'
    ? await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
        data: { full_name },
      })
    : await admin.auth.admin.createUser({
          email, password, email_confirm: true,
        user_metadata: { full_name },
        app_metadata: { require_password_change: true },
      });

  if (created.error || !created.data.user) {
    const msg = created.error?.message ?? 'Could not create the account.';
    return jsonError(msg, /already|registered|exists/i.test(msg) ? 409 : 422);
  }
  const userId = created.data.user.id;
  const metadataUpdate = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...created.data.user.app_metadata, require_password_change: true },
  });
  if (metadataUpdate.error) {
    await admin.auth.admin.deleteUser(userId);
    console.error('Initial password-change policy could not be applied:', metadataUpdate.error.message);
    return jsonError('The account could not be completed. No account was created.', 500);
  }

  // The role is fixed by the server. It is never read from the request.
  const { error: profileError } = await admin.from('profiles').insert({
    id: userId, email, full_name, role, is_active: true, created_by: auth.ctx.profile.id,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    console.error('Profile insert failed:', profileError.message);
    return jsonError('The account could not be completed. No account was created.', 500);
  }

  await admin.from('audit_logs').insert({
    actor_id: auth.ctx.profile.id, action: 'profiles.insert', entity_type: 'profiles', entity_id: userId,
    details: { ref: email, status: mode === 'invite' ? 'invited' : 'created with temporary password' },
  });
  return NextResponse.json({ id: userId }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiRole('SUPER_ADMIN');
  if (auth.error) return auth.error;
  const parsed = await parseJson(request, adminUserToggleSchema);
  if (parsed.error) return parsed.error;
  const { id, is_active } = parsed.data;

  if (id === auth.ctx.profile.id) return jsonError('You cannot change your own account status.', 400);

  let admin;
  try { admin = createAdminClient(); } catch { return jsonError('Server is missing SUPABASE_SERVICE_ROLE_KEY. See README.md.', 500); }

  const { data: target } = await admin.from('profiles').select('id,email,role').eq('id', id).maybeSingle();
  if (!target) return jsonError('Account not found.', 404);
  if (target.role === 'SUPER_ADMIN') return jsonError('Super Admin accounts cannot be changed from this screen.', 403);

  const { error } = await admin.from('profiles').update({ is_active }).eq('id', id);
  if (error) { console.error(error.message); return jsonError('Could not update the account.', 500); }

  // Defense in depth: block token refresh. Server checks of profiles.is_active already stop access immediately.
  const ban = await admin.auth.admin.updateUserById(id, { ban_duration: is_active ? 'none' : '876000h' });
  if (ban.error) console.error('Auth ban update failed:', ban.error.message);

  await admin.from('audit_logs').insert({
    actor_id: auth.ctx.profile.id, action: is_active ? 'profiles.activate' : 'profiles.deactivate',
    entity_type: 'profiles', entity_id: id, details: { ref: target.email },
  });
  return NextResponse.json({ ok: true });
}
