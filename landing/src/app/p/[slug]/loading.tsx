function SidebarSkeleton() {
  return (
    <aside className="hidden w-60 flex-shrink-0 border-r border-zinc-100 md:block">
      <div className="space-y-3 px-4 py-5">
        <div className="h-8 w-28 animate-pulse rounded-xl bg-zinc-100" />
        <div className="h-px bg-zinc-100" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded-xl bg-zinc-50" style={{ width: `${70 + i * 8}%` }} />
        ))}
      </div>
    </aside>
  );
}

/** Skeleton под реальный `CardPageLayout`: на мобиле — fullscreen тёмная подложка как у immersive; md+ — шапка + сайдбар + светлый hero */
export default function CardLoading() {
  return (
    <>
      {/* Мобила: один слой без фейковой шапки (как `CardPageLayout` при fullscreen) */}
      <div
        className="flex min-h-[100dvh] flex-col bg-zinc-950 px-4 md:hidden"
        aria-busy="true"
        aria-label="Загрузка карточки"
      >
        <div
          className="flex flex-1 items-center justify-center pb-[env(safe-area-inset-bottom,0px)] pt-[max(0.75rem,env(safe-area-inset-top,0px))]"
        >
          <div className="aspect-[3/4] w-full max-w-[min(92vw,22rem)] animate-pulse rounded-2xl bg-white/10" />
        </div>
      </div>

      {/* Планшет / десктоп — приближаемся к финальному layout с сайдбаром */}
      <div className="hidden md:block" aria-busy="true" aria-label="Загрузка карточки">
        <div className="sticky top-0 z-40 flex h-[57px] items-center justify-between border-b border-zinc-100 bg-white px-5">
          <div className="h-7 w-28 animate-pulse rounded-lg bg-zinc-100" />
          <div className="hidden h-9 w-80 animate-pulse rounded-xl bg-zinc-50 lg:block" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-100" />
        </div>

        <div className="flex min-h-[calc(100vh-57px)]">
          <SidebarSkeleton />

          <div className="flex min-w-0 flex-1 flex-col">
            <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
              <div className="mb-6 hidden items-center gap-2 sm:flex">
                <div className="h-4 w-16 animate-pulse rounded bg-zinc-200" />
                <span className="text-zinc-200">/</span>
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
              </div>

              <div className="mb-8 overflow-hidden rounded-3xl bg-zinc-100">
                <div className="flex items-center justify-center px-6 py-10">
                  <div className="aspect-[3/4] w-full max-w-[300px] animate-pulse rounded-2xl bg-zinc-200" />
                </div>
              </div>

              <div className="mx-auto mb-4 h-8 w-64 animate-pulse rounded-lg bg-zinc-200" />

              <div className="mb-4 space-y-3">
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-6">
                  <div className="space-y-2">
                    <div className="h-4 w-full animate-pulse rounded bg-zinc-200" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-200" />
                    <div className="h-4 w-4/6 animate-pulse rounded bg-zinc-100" />
                  </div>
                </div>
              </div>

              <div className="mx-auto mb-6 h-4 w-72 animate-pulse rounded bg-zinc-100" />
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
