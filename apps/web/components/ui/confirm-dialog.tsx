'use client';

import { useEffect, useRef, useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'destructive';
  /**
   * Confirm handler. May be sync or async. While the returned promise is
   * pending, the confirm button is disabled and shows a busy label — guards
   * against double-submit (Enter spam, rapid clicks) on slow actions like
   * AE mark-paid, store delete, or order forward.
   */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirming(false);
      return;
    }
    confirmRef.current?.focus();
    const runConfirm = async () => {
      if (confirming) return;
      setConfirming(true);
      try {
        await onConfirm();
      } finally {
        setConfirming(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (confirming) return;
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') {
        e.preventDefault();
        void runConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onCancel, onConfirm, confirming]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  const confirmClass =
    tone === 'destructive'
      ? 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400'
      : 'bg-zinc-900 text-white hover:bg-zinc-800 focus-visible:ring-zinc-400';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? 'confirm-dialog-description' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm"
        onClick={() => {
          if (!confirming) onCancel();
        }}
      />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-zinc-200">
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-zinc-900 leading-snug">
          {title}
        </h2>
        {description && (
          <p
            id="confirm-dialog-description"
            className="mt-2 text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap"
          >
            {description}
          </p>
        )}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            className={`px-4 py-2 rounded-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-70 disabled:cursor-not-allowed transition-colors ${confirmClass}`}
          >
            {confirming ? 'En cours…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
