'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import type { AdminRole } from '@/lib/types';

export function AdminLayout({
  role, fullName, email, children,
}: { role: AdminRole; fullName: string; email: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="min-h-screen bg-brand-softer lg:pl-64">
      <AdminSidebar role={role} open={open} onClose={() => setOpen(false)} />
      <div className="flex min-h-screen flex-col">
        <AdminHeader role={role} fullName={fullName} email={email} onMenu={() => setOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
