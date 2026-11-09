function SidebarSkeleton() {
  return (
    <aside className="hidden w-72 flex-shrink-0 border-r border-zinc-100 lg:block">
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

/** Skeleton под `CardPageLayout`: до lg — fullscreen тёмная подложка; lg+ — шапка, сайдбар и один кадр 3:4 */
export default function CardLoading() {
  return (
    <>
      {/* Мобила: один слой без фейковой шапки (как `CardPageLayout` при fullscreen) */}
      <div
        className="flex min-h-[100dvh] flex-col bg-zinc-950 px-4 lg:hidden"
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
      <div className="hidden lg:block" aria-busy="true" aria-label="Загрузка карточки">
        <div className="sticky top-0 z-40 flex h-[57px] items-center justify-between border-b border-zinc-100 bg-white px-5 lg:hidden">
          <div className="h-7 w-28 animate-pulse rounded-lg bg-zinc-100" />
          <div className="hidden h-9 w-80 animate-pulse rounded-xl bg-zinc-50 lg:block" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-100" />
        </div>

        <div className="flex min-h-[calc(100vh-57px)] lg:min-h-screen">
          <SidebarSkeleton />

          <div className="flex min-w-0 flex-1 items-center justify-center px-6 py-6">
            <div className="aspect-[3/4] h-[min(72vh,40rem)] animate-pulse rounded-2xl bg-zinc-200" />
          </div>
        </div>
      </div>
    </>
  );
}
