export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* PageHeader skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-20 bg-zinc-200 rounded" />
        <div className="h-10 w-72 bg-zinc-200 rounded" />
        <div className="h-4 w-96 bg-zinc-200 rounded hidden xl:block" />
      </div>

      {/* KPIs row skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 xl:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-zinc-200 bg-white rounded-2xl px-5 py-4 xl:px-6 xl:py-5">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
              <div className="h-2.5 w-24 bg-zinc-200 rounded" />
            </div>
            <div className="mt-3 h-9 w-20 bg-zinc-200 rounded" />
            <div className="mt-2 h-3 w-32 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>

      {/* Row 3 skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 xl:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-zinc-200 bg-white rounded-2xl">
            <div className="px-5 pt-5 pb-4 border-b border-zinc-100">
              <div className="h-2.5 w-16 bg-zinc-200 rounded" />
              <div className="mt-2 h-5 w-32 bg-zinc-200 rounded" />
            </div>
            <div className="p-5 space-y-3">
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
