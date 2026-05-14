export default function Loading() {
  return (
    <div className="flex flex-col flex-1 space-y-4 animate-pulse">
      {/* PageHeader */}
      <div className="space-y-2">
        <div className="h-2.5 w-16 bg-admin-bg-muted rounded" />
        <div className="flex items-center justify-between">
          <div className="h-9 w-56 bg-admin-bg-muted rounded" />
          <div className="h-9 w-36 bg-admin-bg-muted rounded-admin-md" />
        </div>
        <div className="h-3.5 w-80 bg-admin-bg-muted rounded hidden xl:block" />
      </div>

      {/* Stats row — matches StatCard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-full border border-admin-border bg-admin-bg-elevated rounded-admin-lg px-4 py-3.5 shadow-admin-card">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-admin-bg-muted" />
              <div className="h-2 w-20 bg-admin-bg-muted rounded" />
            </div>
            <div className="mt-2 h-7 w-12 bg-admin-bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Store rows — compact lines (avatar 32, px-3 py-2) */}
      <div className="space-y-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="border border-admin-border bg-admin-bg rounded-admin-md px-3 py-2 flex items-center gap-3 shadow-admin-card">
            <div className="w-8 h-8 rounded-md bg-admin-bg-muted shrink-0" />
            <div className="flex-1 space-y-1 min-w-0">
              <div className="h-3 w-40 bg-admin-bg-muted rounded" />
              <div className="h-2.5 w-32 bg-admin-bg-muted rounded" />
            </div>
            <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
              <div className="h-3 w-16 bg-admin-bg-muted rounded" />
              <div className="h-2.5 w-12 bg-admin-bg-muted rounded" />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <div className="h-7 w-14 bg-admin-bg-muted rounded-admin-md" />
              <div className="w-7 h-7 bg-admin-bg-muted rounded-admin-md" />
              <div className="w-7 h-7 bg-admin-bg-muted rounded-admin-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
