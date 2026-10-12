'use client';

import { Menu } from 'lucide-react';
import { ROLE_LABELS, type AdminRole } from '@/lib/types';

export function AdminHeader({
  role, fullName, email, onMenu,
}: { role: AdminRole; fullName: string; email: string; onMenu: () => void }) {
  const initials = fullName.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'A';
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6">
      <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-brand-softer lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <p className="hidden text-sm font-medium text-muted lg:block">Student Financial Aid &amp; Scholarship Assistance Tracker</p>
      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <p className="text-sm font-medium">{fullName}</p>
          <p className="text-xs text-muted">{ROLE_LABELS[role]} · {email}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand-deep" aria-hidden="true">{initials}</div>
      </div>
    </header>
  );
}
