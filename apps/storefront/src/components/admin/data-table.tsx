import type { ReactNode } from 'react';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  emptyLabel?: string;
  getRowKey: (row: T) => string;
}

export function DataTable<T>({ columns, rows, emptyLabel, getRowKey }: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--dashboard-radius-card)] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-card)] px-6 py-12 text-center text-sm text-[color:var(--dashboard-text-muted)]">
        {emptyLabel ?? 'Aucune donnée'}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--dashboard-radius-card)] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-card)]">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[color:var(--dashboard-border-mid)]">
            {columns.map(col => (
              <th
                key={col.id}
                scope="col"
                className={`px-4 py-3 font-medium text-[color:var(--dashboard-text-secondary)] ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={getRowKey(row)}
              className="border-b border-[color:var(--dashboard-border)] last:border-0 hover:bg-[color:var(--dashboard-overlay-03)]"
            >
              {columns.map(col => (
                <td key={col.id} className={`px-4 py-3 text-[color:var(--dashboard-text-primary)] ${col.className ?? ''}`}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
