'use client';

import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import {
  forwardRef,
  type InputHTMLAttributes,
  useId,
  useState,
} from 'react';
import { cn } from '@/lib/utils';

export interface AuthPasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  invalid?: boolean;
  errorMessage?: string;
  autoComplete?: string;
}

export const AuthPasswordInput = forwardRef<HTMLInputElement, AuthPasswordInputProps>(
  function AuthPasswordInput(
    {
      label,
      id,
      className,
      invalid,
      errorMessage,
      autoComplete = 'current-password',
      ...props
    },
    ref,
  ) {
    const autoId = useId();
    const inputId = id ?? `auth-password-${autoId}`;
    const [visible, setVisible] = useState(false);

    return (
      <div className="w-full">
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-left text-sm font-medium text-[#333333]"
        >
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            autoComplete={autoComplete}
            className={cn(
              'w-full min-h-10 rounded-lg border py-2 pl-3 pr-11 text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#D9312B] focus:outline-none focus:ring-2 focus:ring-[#D9312B]/20',
              'border-[#eeeeee] bg-white',
              invalid && 'border-red-500 focus:border-red-500 focus:ring-red-500/25',
              className,
            )}
            aria-invalid={invalid || undefined}
            aria-describedby={errorMessage ? `${inputId}-err` : undefined}
            {...props}
          />
          <button
            type="button"
            className="absolute right-1 top-1/2 flex h-8 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[#999999] transition-colors hover:text-[#D9312B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D9312B]"
            onClick={() => setVisible(v => !v)}
            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            aria-pressed={visible}
          >
            {visible ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
        </div>
        {errorMessage ? (
          <p id={`${inputId}-err`} className="mt-1 text-left text-xs text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    );
  },
);
