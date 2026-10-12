import { requireRole } from '@/lib/auth/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { UsersManager } from '@/components/super-admin/users-manager';
import { EmptyState } from '@/components/ui/empty-state';
import { must } from '@/lib/queries';
import { formatDateTime, humanizeAction } from '@/lib/utils';
import type { Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

type AuditRow = { id: string; action: string; created_at: string; details: { ref?: string; status?: string } | null; actor: { full_name: string } | null };

export default async function UsersPage() {
  const { supabase, profile } = await requireRole('SUPER_ADMIN');

  const [usersRes, auditRes] = await Promise.all([
    supabase.from('profiles').select('id,email,full_name,role,is_active,created_at').order('created_at', { ascending: true }),
    supabase.from('audit_logs')
      .select('id,action,created_at,details,actor:profiles!actor_id(full_name)')
      .in('action', ['profiles.insert', 'profiles.activate', 'profiles.deactivate'])
      .order('created_at', { ascending: false }).limit(15),
  ]);
  const users = must(usersRes) as Profile[];
  const audit = must(auditRes) as unknown as AuditRow[];

  return (
    <>
      <PageHeader title="User management" description="Create administrator and student accounts and control who can sign in." />
      <UsersManager users={users} currentUserId={profile.id} />

      <section className="card mt-6">
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-semibold">Account and role activity</h2>
          <p className="text-xs text-muted">Roles cannot be changed from the application. New accounts are created with their selected role.</p>
        </div>
        {audit.length === 0 ? (
          <EmptyState title="No account activity yet" />
        ) : (
          <ul className="divide-y divide-line">
            {audit.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <p className="font-medium">{humanizeAction(a.action)}{a.details?.ref ? ` · ${a.details.ref}` : ''}</p>
                <p className="text-xs text-muted">By {a.actor?.full_name ?? 'System'} · {formatDateTime(a.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
