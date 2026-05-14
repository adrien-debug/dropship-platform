export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse flex flex-col flex-1 min-h-0">
      {/* PageHeader skeleton */}
      <div className="space-y-2">
        <div className="h-2.5 w-20 bg-admin-bg-muted rounded" />
        <div className="h-9 w-72 bg-admin-bg-muted rounded" />
        <div className="h-3.5 w-96 bg-admin-bg-muted rounded hidden xl:block" />
      </div>

      {/* KPIs row — matches StatCard (px-4 py-3.5, rounded-admin-lg) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-admin-border bg-admin-bg-elevated rounded-admin-lg px-4 py-3.5 shadow-admin-card">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-admin-bg-muted" />
              <div className="h-2 w-24 bg-admin-bg-muted rounded" />
            </div>
            <div className="mt-2 h-7 w-20 bg-admin-bg-muted rounded" />
            <div className="mt-1.5 h-2.5 w-32 bg-admin-bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Section row — matches SectionCard (header px-4 pt-3.5 pb-3, body p-4) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-admin-border bg-admin-bg-elevated rounded-admin-lg shadow-admin-card h-full flex flex-col">
            <div className="px-4 pt-3.5 pb-3 border-b border-admin-border-soft shrink-0">
              <div className="h-2 w-16 bg-admin-bg-muted rounded" />
              <div className="mt-1 h-4 w-32 bg-admin-bg-muted rounded" />
            </div>
            <div className="p-4 space-y-3 flex-1">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-3 w-full bg-admin-bg-muted rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
