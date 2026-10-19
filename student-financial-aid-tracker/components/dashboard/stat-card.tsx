import type { LucideIcon } from 'lucide-react';

export function StatCard({ label, value, icon: Icon, hint }: { label: string; value: string | number; icon: LucideIcon; hint?: string }) {
  return (
    <div className="card flex items-start justify-between gap-3 p-4">
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      <div className="rounded-lg bg-brand-light p-2 text-brand-deep"><Icon className="h-5 w-5" /></div>
    </div>
  );
}
