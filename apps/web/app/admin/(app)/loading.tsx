export default function Loading() {
  return (
    <div className="space-y-3 animate-pulse flex flex-col flex-1 min-h-0">
      {/* PageHeader skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-20 bg-zinc-200 rounded" />
        <div className="h-10 w-72 bg-zinc-200 rounded" />
        <div className="h-4 w-96 bg-zinc-200 rounded hidden xl:block" />
      </div>

      {/* KPIs row skeleton — must match StatCard real dimensions (px-4 py-3) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-zinc-200 bg-white rounded-xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
              <div className="h-2.5 w-24 bg-zinc-200 rounded" />
            </div>
            <div className="mt-1.5 h-7 w-20 bg-zinc-200 rounded" />
            <div className="mt-1 h-3 w-32 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>

      {/* Row 3 skeleton — must match SectionCard real dimensions (header px-4 pt-3 pb-3, body p-4) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-zinc-200 bg-white rounded-xl shadow-sm h-full flex flex-col">
            <div className="px-4 pt-3 pb-3 border-b border-zinc-100 shrink-0">
              <div className="h-2.5 w-16 bg-zinc-200 rounded" />
              <div className="mt-0.5 h-5 w-32 bg-zinc-200 rounded" />
            </div>
            <div className="p-4 space-y-3 flex-1">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-4 w-full bg-zinc-100 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
