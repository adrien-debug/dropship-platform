export default function Loading() {
  return (
    <div className="flex flex-col flex-1 space-y-6 animate-pulse">
      {/* PageHeader */}
      <div className="space-y-2">
        <div className="h-2.5 w-16 bg-zinc-200 rounded" />
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-zinc-200 rounded" />
          <div className="h-9 w-36 bg-zinc-200 rounded-lg" />
        </div>
        <div className="h-3.5 w-80 bg-zinc-100 rounded" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-full border border-zinc-200 bg-white rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
              <div className="h-2.5 w-20 bg-zinc-200 rounded" />
            </div>
            <div className="mt-2 h-7 w-12 bg-zinc-200 rounded" />
          </div>
        ))}
      </div>

      {/* Store rows */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border border-zinc-200 bg-white rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-200 shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-4 w-48 bg-zinc-200 rounded" />
              <div className="h-3 w-64 bg-zinc-100 rounded" />
            </div>
            <div className="h-6 w-20 bg-zinc-100 rounded-full shrink-0" />
            <div className="h-8 w-16 bg-zinc-200 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
