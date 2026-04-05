'use client';

import Link from 'next/link';
import type { FC } from 'react';

export interface ShopBreadcrumbProps {
  items: { label: string; href?: string }[];
}

export const ShopBreadcrumb: FC<ShopBreadcrumbProps> = ({ items }) => {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-6 text-sm">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-2">
              {i > 0 && (
                <span style={{ color: 'var(--dashboard-text-ghost)' }} aria-hidden>
                  /
                </span>
              )}
              {isLast || !item.href ? (
                <span
                  className="font-medium"
                  style={{ color: 'var(--dashboard-text-primary)' }}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="transition hover:underline"
                  style={{ color: 'var(--dashboard-text-secondary)' }}
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
