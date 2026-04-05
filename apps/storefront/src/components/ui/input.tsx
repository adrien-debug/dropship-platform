import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type InputFieldType = 'text' | 'email' | 'password' | 'number';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type?: InputFieldType;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', invalid = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'w-full min-h-10 rounded-input border bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted',
        'border-border shadow-dashboard focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30',
        invalid && 'border-error focus:border-error focus:ring-error/30',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});
