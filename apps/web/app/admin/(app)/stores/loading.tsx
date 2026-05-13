export default function Loading() {
  return (
    <div className="flex flex-col flex-1 space-y-4 animate-pulse">
      {/* PageHeader */}
      <div className="space-y-2">
        <div className="h-2.5 w-16 bg-zinc-200 rounded" />
        <div className="flex items-center justify-between">
          <div className="h-9 w-56 bg-zinc-200 rounded" />
          <div className="h-9 w-36 bg-zinc-200 rounded-lg" />
        </div>
        <div className="h-3.5 w-80 bg-zinc-100 rounded hidden xl:block" />
      </div>

      {/* Stats row — matches StatCard px-4 py-3 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-full border border-zinc-200 bg-white rounded-xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
              <div className="h-2.5 w-20 bg-zinc-200 rounded" />
            </div>
            <div className="mt-1.5 h-7 w-12 bg-zinc-200 rounded" />
          </div>
        ))}
      </div>

      {/* Store rows — matches StoreCard: 80px avatar, p-3, gap-4 */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border border-zinc-200 bg-white rounded-xl p-3 flex items-center gap-4 shadow-sm">
            <div className="w-20 h-20 rounded-lg bg-zinc-200 shrink-0" />
            <div className="flex-1 grid grid-cols-12 gap-3 items-center min-w-0">
              <div className="col-span-4 space-y-1.5">
                <div className="h-3.5 w-32 bg-zinc-200 rounded" />
                <div className="h-2.5 w-20 bg-zinc-100 rounded" />
              </div>
              <div className="col-span-4 space-y-1.5">
                <div className="h-3 w-full bg-zinc-100 rounded" />
                <div className="h-3 w-3/4 bg-zinc-100 rounded" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <div className="h-3 w-16 bg-zinc-100 rounded" />
                <div className="h-2.5 w-12 bg-zinc-100 rounded" />
              </div>
              <div className="col-span-2">
                <div className="h-2.5 w-24 bg-zinc-100 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="h-7 w-14 bg-zinc-200 rounded-lg" />
              <div className="w-7 h-7 bg-zinc-100 rounded-lg" />
              <div className="w-7 h-7 bg-zinc-100 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
