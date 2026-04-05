'use client';

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import type { FC } from 'react';
import type { ProductSort } from '@/lib/product-types';

const OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'random', label: 'Aléatoire' },
  { value: 'new', label: 'Nouveautés' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'popular', label: 'Popularité' },
];

export interface SortDropdownProps {
  value: ProductSort;
  onChange: (sort: ProductSort) => void;
}

export const SortDropdown: FC<SortDropdownProps> = ({ value, onChange }) => {
  const selected = OPTIONS.find(o => o.value === value) ?? OPTIONS[0];

  return (
    <div className="relative min-w-[200px]">
      <Listbox value={value} onChange={onChange}>
        <ListboxButton
          className="flex w-full items-center justify-between gap-2 rounded-[var(--dashboard-radius-input)] border px-3 py-2 text-left text-sm font-medium"
          style={{
            borderColor: 'var(--dashboard-border-mid)',
            background: 'var(--dashboard-card)',
            color: 'var(--dashboard-text-primary)',
          }}
        >
          <span>{selected.label}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            style={{ color: 'var(--dashboard-text-muted)' }}
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </ListboxButton>
        <ListboxOptions
          anchor="bottom end"
          className="z-50 mt-1 min-w-[200px] rounded-[var(--dashboard-radius-input)] border p-1 shadow-lg [--anchor-gap:4px]"
          style={{
            borderColor: 'var(--dashboard-border-mid)',
            background: 'var(--dashboard-card-2)',
          }}
        >
          {OPTIONS.map(opt => (
            <ListboxOption
              key={opt.value}
              value={opt.value}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm data-[focus]:bg-[var(--dashboard-accent-soft)]"
              style={{ color: 'var(--dashboard-text-primary)' }}
            >
              {opt.label}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
    </div>
  );
};
