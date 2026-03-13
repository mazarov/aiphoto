export default function ListingLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="h-16 border-b border-zinc-100 bg-white" />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {/* Title skeleton */}
        <div className="mb-6 h-9 w-48 animate-pulse rounded bg-zinc-200" />

        {/* Grid skeleton */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="aspect-[3/4] w-full animate-pulse rounded-xl bg-zinc-200" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
