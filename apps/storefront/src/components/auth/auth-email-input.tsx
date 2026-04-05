'use client';

import { forwardRef, type InputHTMLAttributes, useId } from 'react';
import { cn } from '@/lib/utils';

export interface AuthEmailInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  invalid?: boolean;
  errorMessage?: string;
}

export const AuthEmailInput = forwardRef<HTMLInputElement, AuthEmailInputProps>(
  function AuthEmailInput({ label, id, className, invalid, errorMessage, ...props }, ref) {
    const autoId = useId();
    const inputId = id ?? `auth-email-${autoId}`;

    return (
      <div className="w-full">
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-left text-sm font-medium text-[#333333]"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          type="email"
          autoComplete="email"
          className={cn(
            'w-full min-h-10 rounded-lg border px-3 py-2 text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#D9312B] focus:outline-none focus:ring-2 focus:ring-[#D9312B]/20',
            'border-[#eeeeee] bg-white',
            invalid && 'border-red-500 focus:border-red-500 focus:ring-red-500/25',
            className,
          )}
          aria-invalid={invalid || undefined}
          aria-describedby={errorMessage ? `${inputId}-err` : undefined}
          {...props}
        />
        {errorMessage ? (
          <p id={`${inputId}-err`} className="mt-1 text-left text-xs text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    );
  },
);
