import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Admin design system primitives. Every value here binds to the
 * --admin-* CSS tokens in globals.css. To re-skin the whole admin,
 * touch the tokens — never the components.
 */

export type Tone = 'neutral' | 'emerald';

const dotTone: Record<Tone, string> = {
  neutral: 'bg-admin-text-faint',
  emerald: 'bg-admin-accent',
};

const labelTone: Record<Tone, string> = {
  neutral: 'text-admin-text-muted',
  emerald: 'text-admin-accent',
};

const valueTone: Record<Tone, string> = {
  neutral: 'text-admin-text',
  emerald: 'text-admin-accent-hover',
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
          <p className="text-[10px] uppercase tracking-[0.22em] text-admin-text-muted font-medium">
            {kicker}
          </p>
        )}
        {/* Typo scale standard:
            H1 page title = 28px (always biggest)
            KPI value     = 22px (sub-step)
            H2 section    = 15px
            H3 / row      = 13px
            kicker        = 10px uppercase */}
        <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.025em] text-admin-text leading-[1.1]">
          {title}
        </h1>
        {lede && (
          <p className="mt-1.5 text-[13px] text-admin-text-muted max-w-2xl leading-relaxed hidden xl:block">
            {lede}
          </p>
        )}
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
    <div className="h-full border border-admin-border bg-admin-bg-elevated rounded-admin-lg px-4 py-3.5 hover:border-admin-border-strong transition-colors shadow-admin-card">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-admin-text-muted font-medium">
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full', dotTone[tone])} aria-hidden />
        {label}
      </div>
      <div
        className={cn(
          'mt-1.5 text-[22px] font-semibold tracking-[-0.025em] tabular-nums leading-none',
          valueTone[tone],
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[11px] text-admin-text-muted leading-snug">{hint}</div>}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium',
        labelTone[tone],
      )}
    >
      <span className={cn('inline-block w-1.5 h-1.5 rounded-full', dotTone[tone])} aria-hidden />
      {children}
    </span>
  );
}

export function SectionCard({
  kicker,
  title,
  actions,
  children,
  className = '',
}: {
  kicker?: string;
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'border border-admin-border bg-admin-bg-elevated rounded-admin-lg shadow-admin-card h-full flex flex-col',
        className,
      )}
    >
      {(kicker || title || actions) && (
        <div className="px-4 pt-3.5 pb-3 border-b border-admin-border-soft shrink-0 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {kicker && (
              <p className="text-[10px] uppercase tracking-[0.22em] text-admin-text-muted font-medium">
                {kicker}
              </p>
            )}
            {title && (
              <h3 className="mt-0.5 text-[15px] font-semibold tracking-[-0.015em] text-admin-text leading-tight">
                {title}
              </h3>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className="p-4 flex-1">{children}</div>
    </section>
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
