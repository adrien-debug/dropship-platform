'use client';

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from '@headlessui/react';
import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  name?: string;
  className?: string;
  buttonClassName?: string;
  label?: ReactNode;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Choisir…',
  disabled = false,
  invalid = false,
  id,
  name,
  className,
  buttonClassName,
  label,
}: SelectProps) {
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <label htmlFor={id} className="mb-1.5 block text-sm text-text-secondary">
          {label}
        </label>
      ) : null}
      <Listbox value={value ?? undefined} onChange={onChange} disabled={disabled}>
        {name ? <input type="hidden" name={name} value={value ?? ''} readOnly /> : null}
        <div className="relative">
          <ListboxButton
            id={id}
            className={cn(
              'relative w-full min-h-10 cursor-default rounded-input border bg-card py-2 pl-3 pr-10 text-left text-sm text-text-primary shadow-dashboard',
              'border-border focus:outline-none focus:ring-2 focus:ring-accent/30',
              invalid && 'border-error focus:ring-error/30',
              disabled && 'cursor-not-allowed opacity-50',
              buttonClassName,
            )}
            aria-invalid={invalid || undefined}
          >
            <span className={cn('block truncate', !selected && 'text-text-muted')}>
              {selected ? selected.label : placeholder}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronIcon className="size-4 text-text-muted" aria-hidden />
            </span>
          </ListboxButton>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <ListboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-input border border-border bg-card py-1 shadow-dashboard-lg focus:outline-none">
              {options.map((opt) => (
                <ListboxOption
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className={({ focus, selected: isSelected }) =>
                    cn(
                      'relative cursor-pointer select-none px-3 py-2 text-sm',
                      focus && 'bg-surface text-text-primary',
                      !focus && 'text-text-primary',
                      isSelected && 'font-medium text-accent',
                      opt.disabled && 'cursor-not-allowed opacity-50',
                    )
                  }
                >
                  {opt.label}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}
