import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

/**
 * Admin Button primitive. Every CTA in the admin should be one of these
 * variants — no ad-hoc bg-indigo-600 + px-X py-Y combos in feature code.
 * All visual values are bound to --admin-* tokens via the `admin-*`
 * Tailwind utilities.
 */

type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-admin-md gap-1.5 h-7',
  md: 'px-4 py-2 text-sm rounded-admin-md gap-2 h-9',
  lg: 'px-5 py-2.5 text-sm rounded-admin-lg gap-2 h-10',
};

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-admin-text text-admin-text-inverse hover:bg-admin-chrome-soft active:bg-admin-chrome ' +
    'focus-visible:ring-admin-text',
  secondary:
    'bg-admin-bg text-admin-text border border-admin-border hover:border-admin-border-strong hover:bg-admin-bg-subtle ' +
    'focus-visible:ring-admin-border-strong',
  tertiary:
    'bg-admin-bg-subtle text-admin-text-secondary border border-admin-border hover:bg-admin-bg hover:text-admin-text hover:border-admin-border-strong ' +
    'focus-visible:ring-admin-border-strong',
  ghost:
    'text-admin-text-secondary hover:text-admin-text hover:bg-admin-bg-muted ' +
    'focus-visible:ring-admin-border-strong',
  danger:
    'bg-admin-danger text-white hover:bg-red-700 active:bg-red-800 shadow-sm ' +
    'focus-visible:ring-red-400',
};

const BASE =
  'inline-flex items-center justify-center font-medium tracking-tight transition-colors duration-150 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-admin-bg ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-inherit';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  children: ReactNode;
}

type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', leading, trailing, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(BASE, SIZE[size], VARIANT[variant], className)}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  );
});

type LinkProps = CommonProps & {
  href: string;
  target?: AnchorHTMLAttributes<HTMLAnchorElement>['target'];
  rel?: AnchorHTMLAttributes<HTMLAnchorElement>['rel'];
  prefetch?: boolean;
  'aria-label'?: string;
  title?: string;
};

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  leading,
  trailing,
  className,
  children,
  href,
  ...rest
}: LinkProps) {
  return (
    <Link href={href} className={cn(BASE, SIZE[size], VARIANT[variant], className)} {...rest}>
      {leading}
      {children}
      {trailing}
    </Link>
  );
}
