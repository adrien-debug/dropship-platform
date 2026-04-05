import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type BadgeStatusVariant = 'success' | 'warning' | 'error' | 'info';

export type BadgeCategoryVariant = 'default' | 'accent' | 'muted';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'status' | 'category';
  status?: BadgeStatusVariant;
  category?: BadgeCategoryVariant;
}

const statusClasses: Record<BadgeStatusVariant, string> = {
  success: 'border border-[var(--dashboard-success-border)] bg-[var(--dashboard-success-bg)] text-success',
  warning: 'border border-[var(--dashboard-warning-border)] bg-[var(--dashboard-warning-bg)] text-warning',
  error: 'border border-[var(--dashboard-error-border)] bg-[var(--dashboard-error-bg)] text-error',
  info: 'border border-[var(--dashboard-info-border)] bg-[var(--dashboard-info-bg)] text-info',
};

const categoryClasses: Record<BadgeCategoryVariant, string> = {
  default: 'border border-border bg-surface text-text-secondary',
  accent: 'border border-[var(--dashboard-accent-ring)] bg-[var(--dashboard-accent-dim)] text-accent',
  muted: 'border border-border bg-card text-text-muted',
};

export function Badge({
  className,
  variant = 'status',
  status = 'info',
  category = 'default',
  children,
  ...props
}: BadgeProps) {
  const tone =
    variant === 'category' ? categoryClasses[category] : statusClasses[status];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--dashboard-radius-badge)] px-2 py-0.5 text-xs font-medium',
        tone,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
