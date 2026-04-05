'use client';

import type { FC } from 'react';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (nextPage: number) => void;
}

function totalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 0;
  return Math.max(1, Math.ceil(total / pageSize));
}

export const Pagination: FC<PaginationProps> = ({ page, pageSize, total, onPageChange }) => {
  const pages = totalPages(total, pageSize);
  const canPrev = page > 1;
  const canNext = page < pages;

  if (total === 0) {
    return null;
  }

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-3 py-4"
      aria-label="Pagination"
    >
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onPageChange(page - 1)}
        className="rounded-[var(--dashboard-radius-button)] border px-4 py-2 text-sm font-medium transition disabled:opacity-40"
        style={{
          borderColor: 'var(--dashboard-border-mid)',
          color: 'var(--dashboard-text-primary)',
          background: 'var(--dashboard-card)',
        }}
      >
        Précédent
      </button>
      <span className="text-sm" style={{ color: 'var(--dashboard-text-secondary)' }}>
        Page {page} / {pages}
        <span className="mx-2 opacity-50">·</span>
        {total} résultat{total > 1 ? 's' : ''}
      </span>
      <button
        type="button"
        disabled={!canNext}
        onClick={() => onPageChange(page + 1)}
        className="rounded-[var(--dashboard-radius-button)] border px-4 py-2 text-sm font-medium transition disabled:opacity-40"
        style={{
          borderColor: 'var(--dashboard-border-mid)',
          color: 'var(--dashboard-text-primary)',
          background: 'var(--dashboard-card)',
        }}
      >
        Suivant
      </button>
    </nav>
  );
};
