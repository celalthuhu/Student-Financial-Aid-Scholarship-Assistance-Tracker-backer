import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

type Tone = 'sky' | 'amber' | 'orange' | 'green' | 'red' | 'navy';

const toneStyles: Record<Tone, string> = {
  sky: 'bg-sky-50 text-sky-700',
  amber: 'bg-sky-50 text-sky-700',
  orange: 'bg-sky-50 text-sky-700',
  green: 'bg-sky-50 text-sky-700',
  red: 'bg-sky-50 text-sky-700',
  navy: 'bg-sky-50 text-sky-700',
};

const accentStyles: Record<Tone, string> = {
  sky: 'before:bg-sky-600',
  amber: 'before:bg-sky-600',
  orange: 'before:bg-sky-600',
  green: 'before:bg-sky-600',
  red: 'before:bg-sky-600',
  navy: 'before:bg-sky-600',
};

export function StatCard({
  label, value, icon: Icon, hint, href, tone = 'sky',
}: { label: string; value: string | number; icon: LucideIcon; hint?: string; href?: string; tone?: Tone }) {
  const content = (
    <div className={`group relative flex h-full items-start justify-between gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] before:absolute before:inset-x-4 before:top-0 before:h-[2px] before:rounded-b ${accentStyles[tone]} transition-all duration-150 sm:p-5 ${href ? 'hover:border-sky-300 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2' : ''}`}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="mt-2 break-words text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
        {hint && <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>}
      </div>
      <div className={`shrink-0 rounded-lg p-2 ${toneStyles[tone]}`} aria-hidden="true"><Icon className="h-5 w-5" /></div>
    </div>
  );

  return href ? <Link href={href} className="block h-full" aria-label={`${label}: ${value}${hint ? `. ${hint}` : ''}`}>{content}</Link> : content;
}
