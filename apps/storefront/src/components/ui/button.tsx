import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

export type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-[var(--dashboard-text-bright)] shadow-dashboard hover:opacity-90 focus-visible:ring-accent',
  secondary:
    'bg-surface text-text-primary border border-border shadow-dashboard hover:bg-card focus-visible:ring-accent',
  outline:
    'border border-border bg-transparent text-text-primary hover:bg-surface focus-visible:ring-accent',
  ghost: 'bg-transparent text-text-primary hover:bg-surface focus-visible:ring-accent',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-3 py-1.5 text-sm rounded-button',
  md: 'min-h-10 px-4 py-2 text-sm rounded-button',
  lg: 'min-h-12 px-6 py-2.5 text-base rounded-button',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, disabled, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled ?? loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dashboard-page)] disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : null}
      {children}
    </button>
  );
});
