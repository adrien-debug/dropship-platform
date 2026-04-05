import type { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}

export function KPICard({ title, value, hint, icon }: KPICardProps) {
  return (
    <div className="rounded-[var(--dashboard-radius-card)] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-card)] p-[var(--dashboard-padding-card)] shadow-[var(--dashboard-shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--dashboard-text-muted)]">
            {title}
          </p>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-semibold tabular-nums text-[color:var(--dashboard-text-bright)]">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-[color:var(--dashboard-text-secondary)]">{hint}</p>
          ) : null}
        </div>
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--dashboard-radius-input)] bg-[color:var(--dashboard-accent-soft)] text-[color:var(--dashboard-accent)]">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
