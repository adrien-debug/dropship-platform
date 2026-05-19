export default function Loading() {
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2 animate-pulse">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <div className="h-3 w-14 bg-[var(--ct-surface-3)] rounded" />
        <div className="h-3 w-2 bg-[var(--ct-surface-2)] rounded" />
        <div className="h-3 w-24 bg-[var(--ct-surface-3)] rounded" />
      </div>

      {/* Copilot shell */}
      <div className="border border-[var(--ct-border)] bg-[var(--ct-surface-1)] rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-[var(--ct-border)] flex items-center justify-between gap-3">
          <div className="h-4 w-40 bg-[var(--ct-surface-3)] rounded" />
          <div className="flex gap-2">
            <div className="h-6 w-28 bg-[var(--ct-surface-2)] rounded-md" />
            <div className="h-6 w-6 bg-[var(--ct-surface-2)] rounded-lg" />
            <div className="h-6 w-6 bg-[var(--ct-surface-2)] rounded-lg" />
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Chat column */}
          <div className="flex-1 flex flex-col min-h-0 p-4 gap-4">
            <div className="flex-1 space-y-4">
              {/* Assistant message */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[var(--ct-surface-3)] shrink-0 mt-1" />
                <div className="space-y-2 flex-1 max-w-[75%]">
                  <div className="h-3.5 w-full bg-[var(--ct-surface-2)] rounded" />
                  <div className="h-3.5 w-5/6 bg-[var(--ct-surface-2)] rounded" />
                  <div className="h-3.5 w-4/6 bg-[var(--ct-surface-2)] rounded" />
                </div>
              </div>
            </div>
            {/* Composer */}
            <div className="border border-[var(--ct-border)] rounded-xl p-3 flex gap-2">
              <div className="flex-1 h-9 bg-[var(--ct-surface-2)] rounded-lg" />
              <div className="h-9 w-24 bg-[var(--ct-surface-3)] rounded-lg shrink-0" />
            </div>
          </div>

          {/* Right column */}
          <div className="w-56 p-4 space-y-4" style={{ borderLeft: '1px solid var(--ct-border-soft)' }}>
            <div className="h-4 w-28 bg-[var(--ct-surface-3)] rounded" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-20 bg-[var(--ct-surface-2)] rounded" />
                <div className="h-2.5 w-full bg-[var(--ct-surface-2)] rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
