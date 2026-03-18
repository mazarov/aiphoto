function SidebarSkeleton() {
  return (
    <aside className="hidden w-60 flex-shrink-0 border-r border-zinc-100 lg:block">
      <div className="px-4 py-5 space-y-3">
        <div className="h-8 w-28 animate-pulse rounded-xl bg-zinc-100" />
        <div className="h-px bg-zinc-100" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded-xl bg-zinc-50" style={{ width: `${70 + i * 8}%` }} />
        ))}
      </div>
    </aside>
  );
}

export default function ListingLoading() {
  return (
    <>
      {/* Header skeleton */}
      <div className="sticky top-0 z-40 flex h-[57px] items-center justify-between border-b border-zinc-100 bg-white px-5">
        <div className="h-7 w-28 animate-pulse rounded-lg bg-zinc-100" />
        <div className="hidden h-9 w-80 animate-pulse rounded-xl bg-zinc-50 lg:block" />
        <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-100" />
      </div>

      <div className="flex min-h-[calc(100vh-57px)]">
        <SidebarSkeleton />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Hero skeleton */}
          <div className="border-b border-zinc-100 bg-gradient-to-b from-zinc-50 to-white px-5 pt-10 pb-8">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-4 w-16 animate-pulse rounded bg-zinc-200" />
              <div className="h-4 w-3 text-zinc-200">/</div>
              <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
            </div>
            <div className="h-10 w-72 animate-pulse rounded-lg bg-zinc-200" />
            <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded bg-zinc-100" />
          </div>

          {/* Grid skeleton */}
          <main className="w-full flex-1 px-2 py-10 sm:px-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2.5">
                  <div className="aspect-[3/4] w-full animate-pulse rounded-2xl bg-zinc-100" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-100" />
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
