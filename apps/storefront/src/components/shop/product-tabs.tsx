'use client';

import { Tab } from '@headlessui/react';
import { clsx } from 'clsx';

export function ProductTabs({
  description,
}: {
  description: string;
}) {
  const tabs = ['Description', 'Shipping', 'Reviews'] as const;

  return (
    <Tab.Group>
      <Tab.List className="flex flex-wrap gap-2 border-b border-[var(--dashboard-border)]">
        {tabs.map(label => (
          <Tab
            key={label}
            className={({ selected }) =>
              clsx(
                'px-4 py-3 text-sm font-medium outline-none transition-colors font-[family-name:var(--font-mono)]',
                selected
                  ? 'border-b-2 border-[var(--dashboard-accent)] text-[var(--dashboard-accent)]'
                  : 'text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text-secondary)]',
              )
            }
          >
            {label}
          </Tab>
        ))}
      </Tab.List>
      <Tab.Panels className="mt-6">
        <Tab.Panel>
          {description.trim().length > 0 ? (
            <p className="whitespace-pre-wrap text-[var(--dashboard-text-secondary)] leading-relaxed">
              {description}
            </p>
          ) : (
            <p className="text-[var(--dashboard-text-muted)]">No description provided.</p>
          )}
        </Tab.Panel>
        <Tab.Panel>
          <div className="space-y-3 text-[var(--dashboard-text-secondary)] leading-relaxed">
            <p>
              Standard shipping rates apply at checkout. Orders are processed within 1–2 business days.
              Tracking is sent by email when your package ships.
            </p>
            <p>International delivery may incur customs duties paid by the recipient.</p>
          </div>
        </Tab.Panel>
        <Tab.Panel>
          <p className="text-[var(--dashboard-text-muted)]">No reviews yet. Be the first to review this product.</p>
        </Tab.Panel>
      </Tab.Panels>
    </Tab.Group>
  );
}
