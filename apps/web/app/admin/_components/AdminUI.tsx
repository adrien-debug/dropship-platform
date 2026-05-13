import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

// ── Accent : indigo ──────────────────────────────────────────────────────────
// Trois fontes : zinc-900 (noir), zinc-500 (gris), zinc-400 (gris clair)
// Couleurs sémantiques : accent indigo uniquement — pas d'amber/emerald/red

export type Tone = 'neutral' | 'zinc' | 'amber' | 'emerald' | 'red' | 'blue';

// Toutes les tones convergent vers indigo ou zinc
const dotTone: Record<Tone, string> = {
  neutral: 'bg-zinc-400',
  zinc:    'bg-zinc-400',
  amber:   'bg-indigo-500',
  emerald: 'bg-indigo-500',
  red:     'bg-zinc-400',
  blue:    'bg-indigo-500',
};

const labelTone: Record<Tone, string> = {
  neutral: 'text-zinc-500',
  zinc:    'text-zinc-500',
  amber:   'text-indigo-600',
  emerald: 'text-indigo-600',
  red:     'text-zinc-500',
  blue:    'text-indigo-600',
};

const valueTone: Record<Tone, string> = {
  neutral: 'text-zinc-900',
  zinc:    'text-zinc-900',
  amber:   'text-indigo-700',
  emerald: 'text-indigo-700',
  red:     'text-zinc-900',
  blue:    'text-indigo-700',
};

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
          <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">{kicker}</p>
        )}
        <h1 className="mt-1 text-4xl sm:text-5xl font-extrabold tracking-[-0.035em] text-zinc-900 leading-[1.02]">
          {title}
        </h1>
        {lede && <p className="mt-2 text-sm text-zinc-500 max-w-2xl leading-relaxed">{lede}</p>}
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
    <div className="border border-zinc-200 bg-white rounded-2xl px-6 py-5 hover:border-zinc-300 transition-colors shadow-sm">
      <div className="flex items-center gap-2 text-kicker uppercase tracking-cta text-zinc-400 font-medium">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-200" aria-hidden />
        {label}
      </div>
      <div className={cn('mt-3 text-4xl font-bold tracking-[-0.03em]', valueTone[tone])}>{value}</div>
      {hint && <div className="mt-1.5 text-xs text-zinc-400">{hint}</div>}
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
    <section className={cn('border border-zinc-200 bg-white rounded-2xl shadow-sm', className)}>
      {(kicker || title) && (
        <div className="px-6 pt-6 pb-5 border-b border-zinc-100">
          {kicker && (
            <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">{kicker}</p>
          )}
          {title && <h3 className="mt-1 text-xl font-bold tracking-[-0.02em] text-zinc-900">{title}</h3>}
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
      ? 'border-zinc-200 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300'
      : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center w-9 h-9 rounded-xl border bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
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
