import { requireRole } from '@/lib/auth/permissions';
import { ProgramsManager } from '@/components/super-admin/programs-manager';
import { PageHeader } from '@/components/ui/page-header';

export default async function SuperAdminProgramsPage() {
  await requireRole('SUPER_ADMIN');
  return (
    <>
      <PageHeader title="Scholarship programs" description="Create and manage the programs visible to students and assigned admins." />
      <ProgramsManager />
    </>
  );
}
