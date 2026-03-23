"use client";

import { useMemo } from "react";
import type { PromptCardFull } from "@/lib/supabase";
import { PromptCard } from "./PromptCard";
import { LISTING_LCP_PRIORITY_GRID_ITEMS } from "@/lib/listing-lcp";
import { CardInteractionsProvider } from "@/context/CardInteractionsContext";

type Props = {
  cards: PromptCardFull[];
};

export function PromptGrid({ cards }: Props) {
  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);

  if (cards.length === 0) {
    return (
      <p className="py-12 text-center text-stone-500">
        Карточки не найдены. Пока нет опубликованных промптов.
      </p>
    );
  }

  return (
    <CardInteractionsProvider cardIds={cardIds}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((card, index) => (
          <PromptCard
            key={card.id}
            card={card}
            priorityLoad={index < LISTING_LCP_PRIORITY_GRID_ITEMS}
          />
        ))}
      </div>
    </CardInteractionsProvider>
  );
}
