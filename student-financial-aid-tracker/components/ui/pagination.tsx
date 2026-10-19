import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  page, pageSize, total, basePath, params,
}: { page: number; pageSize: number; total: number; basePath: string; params: Record<string, string | undefined> }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
    if (p > 1) sp.set('page', String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted">
      <span>{from}–{to} of {total}</span>
      <div className="flex items-center gap-2">
        {page > 1 ? <Link className="btn-secondary btn-sm" href={href(page - 1)}><ChevronLeft className="h-4 w-4" />Previous</Link> : <span className="btn-secondary btn-sm opacity-50"><ChevronLeft className="h-4 w-4" />Previous</span>}
        <span>Page {page} of {totalPages}</span>
        {page < totalPages ? <Link className="btn-secondary btn-sm" href={href(page + 1)}>Next<ChevronRight className="h-4 w-4" /></Link> : <span className="btn-secondary btn-sm opacity-50">Next<ChevronRight className="h-4 w-4" /></span>}
      </div>
    </div>
  );
}
