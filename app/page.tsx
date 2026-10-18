import { redirect } from 'next/navigation';
import { getCurrentAdmin, ROLE_HOME } from '@/lib/auth/permissions';

export default async function Home() {
  const ctx = await getCurrentAdmin();
  if (!ctx) redirect('/login');
  redirect(ROLE_HOME[ctx.profile.role]);
}
