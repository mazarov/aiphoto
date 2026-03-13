export default function CardLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="h-16 border-b border-zinc-100 bg-white" />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {/* Breadcrumb skeleton */}
        <div className="mb-6 flex gap-2">
          <div className="h-4 w-16 animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-4 text-zinc-300">/</div>
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Image skeleton */}
          <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-zinc-200" />

          {/* Info skeleton */}
          <div className="flex flex-col gap-4">
            <div className="h-8 w-3/4 animate-pulse rounded bg-zinc-200" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-zinc-100" />
            <div className="mt-4 h-32 w-full animate-pulse rounded-xl bg-zinc-100" />
            <div className="mt-2 flex gap-2">
              <div className="h-8 w-20 animate-pulse rounded-full bg-zinc-200" />
              <div className="h-8 w-20 animate-pulse rounded-full bg-zinc-200" />
              <div className="h-8 w-20 animate-pulse rounded-full bg-zinc-200" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
