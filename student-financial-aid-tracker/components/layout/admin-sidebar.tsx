'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3, Bell, CircleHelp, ClipboardCheck, FileText, Gauge, GraduationCap, LayoutDashboard, LogOut,
  MessageSquareWarning, UserCircle, Users, X, type LucideIcon,
} from 'lucide-react';
import { logoutAction } from '@/lib/auth/actions';
import { cn } from '@/lib/utils';
import type { AdminRole } from '@/lib/types';

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: Record<AdminRole, NavItem[]> = {
  SUPER_ADMIN: [
    { href: '/super-admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/super-admin/programs', label: 'Scholarship Programs', icon: GraduationCap },
    { href: '/super-admin/users', label: 'User Management', icon: Users },
  ],
  WORKING_SCHOLAR_ADMIN: [
    { href: '/working-scholar/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/working-scholar/applications', label: 'Applications', icon: FileText },
    { href: '/working-scholar/requirements', label: 'Requirements', icon: ClipboardCheck },
    { href: '/working-scholar/follow-ups', label: 'Follow-ups', icon: MessageSquareWarning },
    { href: '/working-scholar/scholars', label: 'Scholars', icon: GraduationCap },
    { href: '/working-scholar/slots', label: 'Slot Management', icon: Gauge },
    { href: '/working-scholar/reports', label: 'Reports', icon: BarChart3 },
    { href: '/working-scholar/profile', label: 'Profile', icon: UserCircle },
  ],
  FINANCE_ADMIN: [
    { href: '/finance/dashboard', label: 'Finance Dashboard', icon: LayoutDashboard },
    { href: '/finance/applications', label: 'Financial Aid Applications', icon: FileText },
    { href: '/finance/reports', label: 'Finance Reports', icon: BarChart3 },
  ],
  STUDENT: [
    { href: '/student/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/student/programs', label: 'Scholarship Opportunities', icon: GraduationCap },
    { href: '/student/applications', label: 'My Applications', icon: FileText },
    { href: '/student/documents', label: 'Requirements & Documents', icon: ClipboardCheck },
    { href: '/student/notifications', label: 'Updates', icon: Bell },
    { href: '/student/profile', label: 'My Profile', icon: UserCircle },
    { href: '/student/help', label: 'Help & Support', icon: CircleHelp },
  ],
};

export function AdminSidebar({ role, open, onClose }: { role: AdminRole; open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-white transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-deep text-white"><GraduationCap className="h-5 w-5" /></div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Aid Tracker</p>
              <p className="text-xs text-muted">Scholarship assistance</p>
            </div>
          </div>
          <button type="button" className="rounded-lg p-1 text-muted hover:bg-brand-softer lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV[role].map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href} href={href} aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-brand-light text-brand-deep' : 'text-slate-600 hover:bg-brand-softer hover:text-ink',
                )}
              >
                <Icon className="h-5 w-5" />{label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="border-t border-line p-3">
          <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-brand-softer hover:text-ink">
            <LogOut className="h-5 w-5" />Logout
          </button>
        </form>
      </aside>
    </>
  );
}
