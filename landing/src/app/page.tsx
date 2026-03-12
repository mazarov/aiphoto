import { fetchRouteCards, enrichCardsWithDetails } from "@/lib/supabase";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FilterableGrid } from "@/components/CardFilters";

export default async function HomePage() {
  const result = await fetchRouteCards({
    limit: 48,
    offset: 0,
  });

  const cards = await enrichCardsWithDetails(result.cards);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-100">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/60 via-white to-white" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.12),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-5 pt-20 pb-14 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
            Промты для фото{" "}
            <span className="bg-gradient-to-r from-indigo-500 to-violet-500 text-gradient">
              с нейросетями
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base text-zinc-500 sm:text-lg">
            Готовые промпты для генерации фотографий.
            Копируй, вставляй, получай результат.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-zinc-400">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              {result.cards_count}+ промптов
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              Все стили
            </span>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10">
        <FilterableGrid cards={cards} />
      </main>
      <Footer />
    </div>
  );
}
