export default function Loading() {
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-5 animate-pulse">
      {/* PageHeader */}
      <div className="space-y-2">
        <div className="h-2.5 w-24 bg-zinc-200 rounded" />
        <div className="flex items-center justify-between">
          <div className="h-8 w-52 bg-zinc-200 rounded" />
        </div>
        <div className="h-3.5 w-72 bg-zinc-100 rounded" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-zinc-200 bg-white rounded-xl px-4 py-3">
            <div className="h-2.5 w-20 bg-zinc-200 rounded mb-2" />
            <div className="h-7 w-10 bg-zinc-200 rounded" />
          </div>
        ))}
      </div>

      {/* Product table */}
      <div className="border border-zinc-200 bg-white rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 flex gap-4">
          {['w-8', 'w-48', 'w-24', 'w-16', 'w-20'].map((w, i) => (
            <div key={i} className={`h-3 ${w} bg-zinc-200 rounded`} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-5 py-3.5 border-b border-zinc-50 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-52 bg-zinc-200 rounded" />
              <div className="h-2.5 w-36 bg-zinc-100 rounded" />
            </div>
            <div className="h-3 w-16 bg-zinc-100 rounded shrink-0" />
            <div className="h-5 w-16 bg-zinc-100 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
