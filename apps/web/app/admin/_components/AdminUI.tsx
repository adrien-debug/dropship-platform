import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

// ── Design system ─────────────────────────────────────────────────────────────
// Deux pôles : indigo (positif / actif) · zinc (neutre / inactif / erreur)
// Trois fontes : zinc-900 (noir) · zinc-500 (gris) · zinc-400 (gris clair)

export type Tone = 'neutral' | 'emerald';

const dotTone: Record<Tone, string> = {
  neutral: 'bg-zinc-400',
  emerald: 'bg-indigo-500',
};

const labelTone: Record<Tone, string> = {
  neutral: 'text-zinc-500',
  emerald: 'text-indigo-600',
};

const valueTone: Record<Tone, string> = {
  neutral: 'text-zinc-900',
  emerald: 'text-indigo-700',
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
        <h1 className="mt-0.5 text-2xl sm:text-3xl xl:text-4xl font-extrabold tracking-[-0.035em] text-zinc-900 leading-[1.02]">
          {title}
        </h1>
        {lede && <p className="mt-1 text-xs text-zinc-500 max-w-2xl leading-relaxed hidden xl:block">{lede}</p>}
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
    <div className="h-full border border-zinc-200 bg-white rounded-xl px-4 py-3 hover:border-zinc-300 transition-colors shadow-sm">
      <div className="flex items-center gap-2 text-kicker uppercase tracking-cta text-zinc-400 font-medium">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" aria-hidden />
        {label}
      </div>
      <div className={cn('mt-1.5 text-2xl font-bold tracking-[-0.03em]', valueTone[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-400">{hint}</div>}
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
    <section className={cn('border border-zinc-200 bg-white rounded-xl shadow-sm h-full flex flex-col', className)}>
      {(kicker || title) && (
        <div className="px-4 pt-3 pb-3 border-b border-zinc-100 shrink-0">
          {kicker && (
            <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">{kicker}</p>
          )}
          {title && <h3 className="mt-0.5 text-base font-semibold tracking-[-0.02em] text-zinc-900">{title}</h3>}
        </div>
      )}
      <div className="p-4 flex-1">{children}</div>
    </section>
  );
}

function IconButton({
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
