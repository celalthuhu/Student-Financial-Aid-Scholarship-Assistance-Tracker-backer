import { requireRole } from '@/lib/auth/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { PasswordForm } from '@/components/auth/password-form';
import { ROLE_LABELS } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { profile } = await requireRole('WORKING_SCHOLAR_ADMIN');
  return (
    <>
      <PageHeader title="Profile" description="Your account details and password." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="border-b border-line px-4 py-3 font-semibold">Account</h2>
          <dl className="grid gap-4 p-4 text-sm">
            <div><dt className="text-xs text-muted">Name</dt><dd className="font-medium">{profile.full_name}</dd></div>
            <div><dt className="text-xs text-muted">Email</dt><dd className="font-medium">{profile.email}</dd></div>
            <div><dt className="text-xs text-muted">Role</dt><dd className="font-medium">{ROLE_LABELS[profile.role]}</dd></div>
          </dl>
          <p className="border-t border-line px-4 py-3 text-xs text-muted">Your role and status are managed by the Super Admin.</p>
        </section>
        <section className="card">
          <h2 className="border-b border-line px-4 py-3 font-semibold">Change password</h2>
          <div className="p-4"><PasswordForm /></div>
        </section>
      </div>
    </>
  );
}
