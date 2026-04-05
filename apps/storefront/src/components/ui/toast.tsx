'use client';

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

export type ToastTone = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'> & { id?: string }) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClasses: Record<ToastTone, string> = {
  default: 'border-border bg-card text-text-primary',
  success: 'border-[var(--dashboard-success-border)] bg-[var(--dashboard-success-bg)] text-text-primary',
  error: 'border-[var(--dashboard-error-border)] bg-[var(--dashboard-error-bg)] text-text-primary',
  warning: 'border-[var(--dashboard-warning-border)] bg-[var(--dashboard-warning-bg)] text-text-primary',
  info: 'border-[var(--dashboard-info-border)] bg-[var(--dashboard-info-bg)] text-text-primary',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastItem, 'id'> & { id?: string }) => {
      const id = toast.id ?? `toast-${crypto.randomUUID()}`;
      const item: ToastItem = {
        id,
        title: toast.title,
        description: toast.description,
        tone: toast.tone ?? 'default',
        durationMs: toast.durationMs ?? 5000,
      };
      setToasts((prev) => [...prev, item]);
      const durationMs = item.durationMs ?? 5000;
      if (durationMs > 0) {
        window.setTimeout(() => {
          removeToast(id);
        }, durationMs);
      }
      return id;
    },
    [removeToast],
  );

  const value = useMemo(
    () => ({
      toasts,
      addToast,
      removeToast,
    }),
    [toasts, addToast, removeToast],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

export function Toaster({ className }: { className?: string }) {
  const ctx = useContext(ToastContext);
  const listId = useId();

  if (!ctx) {
    return null;
  }

  const { toasts, removeToast } = ctx;

  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-4 right-4 z-[100050] flex w-full max-w-sm flex-col gap-2 p-0 sm:bottom-6 sm:right-6',
        className,
      )}
      aria-live="polite"
      aria-relevant="additions text"
      id={listId}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'pointer-events-auto rounded-input border px-4 py-3 shadow-dashboard-lg',
            toneClasses[t.tone ?? 'default'],
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-bright">{t.title}</p>
              {t.description ? (
                <p className="mt-1 text-xs text-text-secondary">{t.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="shrink-0 rounded-input p-1 text-text-muted hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
              aria-label="Fermer la notification"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}
