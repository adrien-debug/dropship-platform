import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type SpinnerSize = 'sm' | 'md' | 'lg';

const sizeMap: Record<SpinnerSize, string> = {
  sm: 'size-4 border-2',
  md: 'size-8 border-2',
  lg: 'size-12 border-[3px]',
};

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
  label?: string;
}

export function Spinner({ className, size = 'md', label = 'Chargement…', ...props }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('inline-flex items-center justify-center', className)}
      {...props}
    >
      <span
        className={cn(
          'animate-spin rounded-full border-accent border-t-transparent',
          sizeMap[size],
        )}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
