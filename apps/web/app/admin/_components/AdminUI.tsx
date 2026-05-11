import type { ReactNode } from 'react';

export type Tone = 'neutral' | 'zinc' | 'amber' | 'emerald' | 'red' | 'blue';

const dotTone: Record<Tone, string> = {
  neutral: 'bg-zinc-300',
  zinc: 'bg-zinc-300',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
};

const labelTone: Record<Tone, string> = {
  neutral: 'text-zinc-700',
  zinc: 'text-zinc-500',
  amber: 'text-amber-700',
  emerald: 'text-emerald-700',
  red: 'text-red-700',
  blue: 'text-blue-700',
};

const valueTone: Record<Tone, string> = {
  neutral: 'text-zinc-900',
  zinc: 'text-zinc-900',
  amber: 'text-amber-700',
  emerald: 'text-emerald-700',
  red: 'text-red-700',
  blue: 'text-blue-700',
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
        <h1 className="mt-1 text-3xl font-serif text-zinc-900 leading-tight">{title}</h1>
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
    <div className="border border-zinc-200 bg-white rounded-xl px-5 py-4">
      <div className="flex items-center gap-2 text-kicker uppercase tracking-cta text-zinc-400 font-medium">
        <span className="inline-block w-1 h-1 rounded-full bg-zinc-300" aria-hidden />
        {label}
      </div>
      <div className={`mt-2 text-3xl font-serif ${valueTone[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${labelTone[tone]}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotTone[tone]}`} aria-hidden />
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
    <section className={`border border-zinc-200 bg-white rounded-xl ${className}`}>
      {(kicker || title) && (
        <div className="px-6 pt-5 pb-4 border-b border-zinc-200/70">
          {kicker && (
            <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">{kicker}</p>
          )}
          {title && <h3 className="mt-1 text-base font-serif text-zinc-900">{title}</h3>}
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
      ? 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'
      : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles}`}
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
