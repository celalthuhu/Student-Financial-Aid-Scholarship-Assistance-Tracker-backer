'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', danger = false, loading = false, error,
  reasonLabel, reasonRequired = false, onConfirm, onCancel,
}: {
  open: boolean; title: string; message: string; confirmLabel?: string; danger?: boolean; loading?: boolean;
  error?: string | null; reasonLabel?: string; reasonRequired?: boolean;
  onConfirm: (reason: string) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  const hasReason = reasonLabel !== undefined;
  const blocked = loading || (hasReason && reasonRequired && reason.trim().length === 0);

  return (
    <Modal open={open} onClose={loading ? () => {} : onCancel} title={title} size="sm">
      <p className="text-sm text-muted">{message}</p>
      {hasReason && (
        <div className="mt-4">
          <label className="label" htmlFor="confirm-reason">{reasonLabel}{reasonRequired && ' *'}</label>
          <textarea id="confirm-reason" className="input min-h-24" value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} disabled={blocked} onClick={() => onConfirm(reason.trim())}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
