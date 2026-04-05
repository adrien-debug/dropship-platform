import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  separator?: ReactNode;
}

export function Breadcrumb({ items, className, separator }: BreadcrumbProps) {
  const sep = separator ?? <span className="text-text-muted" aria-hidden>/</span>;

  return (
    <nav aria-label="Fil d’Ariane" className={cn('text-sm', className)}>
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? sep : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-text-secondary transition-colors hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/40 rounded-sm"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(isLast ? 'text-text-bright font-medium' : 'text-text-secondary')}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
