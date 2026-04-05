'use client';

import { cn } from '@/lib/utils';
import { Button } from './button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  siblingCount?: number;
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

type PageEntry = number | 'ellipsis';

/** Build page numbers with ellipses when the range is large. */
function buildPageList(current: number, total: number, sibling: number): PageEntry[] {
  if (total <= 1) {
    return [1];
  }
  if (total <= sibling * 2 + 5) {
    return range(1, total);
  }

  const left = Math.max(2, current - sibling);
  const right = Math.min(total - 1, current + sibling);
  const pages = new Set<number>([1, total]);
  for (let p = left; p <= right; p += 1) {
    pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: PageEntry[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const n = sorted[i];
    const prev = sorted[i - 1];
    if (i > 0 && prev !== undefined && n - prev > 1) {
      out.push('ellipsis');
    }
    out.push(n);
  }
  return out;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
  siblingCount = 1,
}: PaginationProps) {
  if (totalPages < 1) {
    return null;
  }

  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pages = buildPageList(safePage, totalPages, siblingCount);

  return (
    <nav aria-label="Pagination" className={cn('flex flex-wrap items-center gap-2', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={safePage <= 1}
        onClick={() => onPageChange(safePage - 1)}
        aria-label="Page précédente"
      >
        Précédent
      </Button>
      <ul className="flex flex-wrap items-center gap-1">
        {pages.map((entry, i) =>
          entry === 'ellipsis' ? (
            <li key={`ellipsis-${i}`} className="px-2 text-text-muted" aria-hidden>
              …
            </li>
          ) : (
            <li key={entry}>
              <button
                type="button"
                onClick={() => onPageChange(entry)}
                aria-label={`Page ${entry}`}
                aria-current={entry === safePage ? 'page' : undefined}
                className={cn(
                  'min-h-8 min-w-8 rounded-input px-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40',
                  entry === safePage
                    ? 'bg-accent font-medium text-[var(--dashboard-text-bright)]'
                    : 'border border-border bg-card text-text-primary hover:bg-surface',
                )}
              >
                {entry}
              </button>
            </li>
          ),
        )}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={safePage >= totalPages}
        onClick={() => onPageChange(safePage + 1)}
        aria-label="Page suivante"
      >
        Suivant
      </Button>
    </nav>
  );
}
