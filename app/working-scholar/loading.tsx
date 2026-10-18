import { Loader2 } from 'lucide-react';

export default function WorkingScholarLoading() {
  return (
    <div role="status" className="card flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-brand" />
      <p className="font-medium">Loading Working Scholar administration…</p>
      <span className="sr-only">Please wait while the page loads.</span>
    </div>
  );
}
