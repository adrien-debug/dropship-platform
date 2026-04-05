'use client';

import { clsx } from 'clsx';

export function QuantitySelector({
  value,
  onChange,
  disabled,
  max = 99,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  max?: number;
}) {
  const dec = () => {
    onChange(Math.max(1, value - 1));
  };
  const inc = () => {
    onChange(Math.min(max, value + 1));
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-[var(--dashboard-text-secondary)]">Quantity</span>
      <div
        className={clsx(
          'inline-flex items-center rounded-[var(--dashboard-radius-input)] border border-[var(--dashboard-border)] bg-[var(--dashboard-card-2)]',
          disabled && 'opacity-50',
        )}
      >
        <button
          type="button"
          disabled={disabled || value <= 1}
          onClick={dec}
          className="min-h-[48px] min-w-[48px] rounded-l-[var(--dashboard-radius-input)] text-lg font-medium text-[var(--dashboard-text-primary)] transition-colors hover:bg-[var(--dashboard-overlay-06)] disabled:cursor-not-allowed"
          aria-label="Decrease quantity"
        >
          -
        </button>
        <span
          className="min-w-[3rem] text-center font-[family-name:var(--font-mono)] text-[var(--dashboard-text-bright)]"
          aria-live="polite"
        >
          {value}
        </span>
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={inc}
          className="min-h-[48px] min-w-[48px] rounded-r-[var(--dashboard-radius-input)] text-lg font-medium text-[var(--dashboard-text-primary)] transition-colors hover:bg-[var(--dashboard-overlay-06)] disabled:cursor-not-allowed"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
    </div>
  );
}
