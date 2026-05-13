import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type Tone = 'neutral' | 'zinc' | 'amber' | 'emerald' | 'red' | 'blue';

const dotTone: Record<Tone, string> = {
  neutral: 'bg-ds-text-muted',
  zinc: 'bg-ds-text-muted',
  amber: 'bg-[var(--warning)]',
  emerald: 'bg-[var(--success)]',
  red: 'bg-[var(--danger)]',
  blue: 'bg-[var(--info)]',
};

const labelTone: Record<Tone, string> = {
  neutral: 'text-ds-text-secondary',
  zinc: 'text-ds-text-muted',
  amber: 'text-[var(--warning)]',
  emerald: 'text-[var(--success)]',
  red: 'text-[var(--danger)]',
  blue: 'text-[var(--info)]',
};

const valueTone: Record<Tone, string> = {
  neutral: 'text-ds-text-primary',
  zinc: 'text-ds-text-primary',
  amber: 'text-[var(--warning)]',
  emerald: 'text-[var(--success)]',
  red: 'text-[var(--danger)]',
  blue: 'text-[var(--info)]',
};

// ── Dark theme variants ──

export function PageHeader({
  kicker,
  title,
  lede,
  actions,
}: {
  kicker?: string;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker && (
          <p className="text-kicker uppercase tracking-label text-ds-text-muted font-medium">{kicker}</p>
        )}
        <h1 className="mt-1 text-4xl sm:text-5xl font-extrabold tracking-[-0.035em] text-ds-text-primary leading-[1.02]">
          {title}
        </h1>
        {lede && <p className="mt-2 text-sm text-ds-text-muted max-w-2xl leading-relaxed">{lede}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="border border-ds-border-subtle bg-ds-surface-subtle rounded-xl px-5 py-4 hover:border-ds-border-default transition-colors">
      <div className="flex items-center gap-2 text-kicker uppercase tracking-cta text-ds-text-muted font-medium">
        <span className="inline-block w-1 h-1 rounded-full bg-ds-text-muted" aria-hidden />
        {label}
      </div>
      <div className={cn('mt-2 text-4xl font-bold tracking-[-0.03em]', valueTone[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ds-text-muted">{hint}</div>}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', labelTone[tone])}>
      <span className={cn('inline-block w-1.5 h-1.5 rounded-full', dotTone[tone])} aria-hidden />
      {children}
    </span>
  );
}

export function SectionCard({
  kicker,
  title,
  children,
  className = '',
}: {
  kicker?: string;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('border border-ds-border-subtle bg-ds-surface-subtle rounded-xl', className)}>
      {(kicker || title) && (
        <div className="px-6 pt-5 pb-4 border-b border-ds-border-subtle">
          {kicker && (
            <p className="text-kicker uppercase tracking-label text-ds-text-muted font-medium">{kicker}</p>
          )}
          {title && <h3 className="mt-1 text-xl font-bold tracking-[-0.02em] text-ds-text-primary">{title}</h3>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  tone = 'neutral',
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
  children: ReactNode;
}) {
  const styles =
    tone === 'danger'
      ? 'border-[var(--danger-muted)] text-[var(--danger)] hover:bg-[var(--danger-muted)] hover:border-[var(--danger)]'
      : 'border-ds-border-subtle text-ds-text-muted hover:bg-ds-surface-default hover:text-ds-text-primary hover:border-ds-border-default';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center w-9 h-9 rounded-lg border bg-ds-surface-subtle transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        styles,
      )}
    >
      {children}
    </button>
  );
}

export function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
