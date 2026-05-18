export default function Loading() {
  return (
    <div className="flex flex-col flex-1 space-y-4 animate-pulse">
      {/* PageHeader */}
      <div className="space-y-2">
        <div className="h-2.5 w-20 bg-[var(--ct-surface-3)] rounded" />
        <div className="flex items-center justify-between">
          <div className="h-8 w-44 bg-[var(--ct-surface-3)] rounded" />
          <div className="h-9 w-44 bg-[var(--ct-surface-3)] rounded-lg" />
        </div>
        <div className="h-3.5 w-96 bg-[var(--ct-surface-2)] rounded" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl px-4 py-3" style={{ border: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)' }}>
            <div className="h-2.5 w-20 bg-[var(--ct-surface-3)] rounded mb-2" />
            <div className="h-7 w-12 bg-[var(--ct-surface-3)] rounded" />
          </div>
        ))}
      </div>

      {/* Orders section */}
      <div className="space-y-3">
        <div className="h-4 w-32 bg-[var(--ct-surface-3)] rounded" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl p-5 space-y-3" style={{ border: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)' }}>
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="h-3.5 w-40 bg-[var(--ct-surface-3)] rounded" />
                <div className="h-3 w-28 bg-[var(--ct-surface-2)] rounded" />
              </div>
              <div className="flex gap-2">
                <div className="h-7 w-16 bg-[var(--ct-surface-2)] rounded-md" />
                <div className="h-7 w-24 bg-[var(--ct-surface-3)] rounded-md" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-3 bg-[var(--ct-surface-2)] rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
