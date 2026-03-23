"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { PromptCardFull } from "@/lib/supabase";
import { PromptCard } from "@/components/PromptCard";
import { CardInteractionsProvider } from "@/context/CardInteractionsContext";

export function FavoritesContent() {
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const [cards, setCards] = useState<PromptCardFull[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowser();

    async function loadFavorites() {
      const { data: favs } = await supabase
        .from("card_favorites")
        .select("card_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (!favs || favs.length === 0) {
        setCards([]);
        setLoading(false);
        return;
      }

      const cardIds = favs.map((f) => f.card_id);
      const res = await fetch(
        `/api/search-card?ids=${cardIds.join(",")}`
      );
      const data = await res.json();
      setCards(data.cards || []);
      setLoading(false);
    }

    loadFavorites();
  }, [user, authLoading]);

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="block h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
          <svg className="h-7 w-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-zinc-900">
          Войдите, чтобы увидеть избранное
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Сохраняйте понравившиеся промпты и возвращайтесь к ним
        </p>
        <button
          type="button"
          onClick={openAuthModal}
          className="mt-4 inline-block rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800"
        >
          Войти
        </button>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100">
          <svg className="h-7 w-7 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-zinc-900">
          У вас пока нет избранных промптов
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Нажмите на закладку на карточке, чтобы сохранить промпт
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-600"
        >
          Перейти к каталогу
        </Link>
      </div>
    );
  }

  return (
    <CardInteractionsProvider cardIds={cardIds}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.id} className="min-w-0">
            <PromptCard card={card} />
          </div>
        ))}
      </div>
    </CardInteractionsProvider>
  );
}
