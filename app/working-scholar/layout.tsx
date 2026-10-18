import type { ReactNode } from 'react';
import { requireRole } from '@/lib/auth/permissions';
import { AdminLayout } from '@/components/layout/admin-layout';

export default async function Layout({ children }: { children: ReactNode }) {
  const { profile } = await requireRole('WORKING_SCHOLAR_ADMIN');
  return (
    <AdminLayout role={profile.role} fullName={profile.full_name} email={profile.email}>
      {children}
    </AdminLayout>
  );
}
