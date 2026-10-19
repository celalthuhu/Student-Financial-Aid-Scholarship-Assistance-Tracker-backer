import type { ReactNode } from 'react';
import { requireRole } from '@/lib/auth/permissions';
import { AdminLayout } from '@/components/layout/admin-layout';

export default async function FinanceLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireRole('FINANCE_ADMIN');
  return <AdminLayout role={profile.role} fullName={profile.full_name} email={profile.email}>{children}</AdminLayout>;
}
