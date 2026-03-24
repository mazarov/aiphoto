"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import type { PromptCardFull } from "@/lib/supabase";
import { PromptCard } from "@/components/PromptCard";
import { CardInteractionsProvider } from "@/context/CardInteractionsContext";
import { LISTING_LCP_PRIORITY_GRID_ITEMS } from "@/lib/listing-lcp";

export function GenerationsContent() {
  const { user, loading: authLoading } = useAuth();
  const [cards, setCards] = useState<PromptCardFull[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    async function load() {
      const res = await fetch("/api/my-prompt-cards?limit=80", { credentials: "include" });
      const data = await res.json();
      setCards(data.cards || []);
      setLoading(false);
    }

    load();
  }, [user, authLoading]);

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);

  if (authLoading || !user) {
    return (
      <p className="text-zinc-500">
        <Link href="/" className="text-indigo-600 hover:underline">
          Войдите
        </Link>
        , чтобы увидеть свои генерации.
      </p>
    );
  }

  if (loading) {
    return <div className="animate-pulse text-zinc-500">Загрузка...</div>;
  }

  if (cards.length === 0) {
    return (
      <p className="text-zinc-500">
        У вас пока нет карточек с генерациями. Откройте промт в каталоге и нажмите «Сгенерировать» — результат
        появится здесь как карточка.
      </p>
    );
  }

  return (
    <CardInteractionsProvider cardIds={cardIds}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {cards.map((card, index) => (
          <div key={card.id} className="min-w-0">
            <PromptCard
              card={card}
              priorityLoad={index < LISTING_LCP_PRIORITY_GRID_ITEMS}
            />
          </div>
        ))}
      </div>
    </CardInteractionsProvider>
  );
}
