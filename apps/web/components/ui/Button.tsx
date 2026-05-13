import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

/**
 * Single source of truth for admin CTAs. Replaces the four padding
 * variants that drifted across pages (px-3 py-2, px-4 py-2, px-5 py-2.5,
 * px-6 py-3) with a typed size + variant API. Use it for every button
 * or button-styled link in the admin shell so the system stays strict.
 */

type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'px-5 py-2.5 text-sm rounded-xl gap-2',
};

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm focus-visible:ring-indigo-400',
  secondary:
    'bg-white text-zinc-800 border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 focus-visible:ring-zinc-300',
  tertiary:
    'bg-zinc-50 text-zinc-700 border border-zinc-200 hover:bg-white hover:text-zinc-900 hover:border-zinc-300 focus-visible:ring-zinc-300',
  ghost:
    'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 focus-visible:ring-zinc-300',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm focus-visible:ring-red-400',
};

const BASE =
  'inline-flex items-center justify-center font-medium transition-colors duration-150 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
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
