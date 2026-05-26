"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useUserInteractions } from "@/hooks/useUserInteractions";

type Reaction = "like" | "dislike";

type CardInteractionsContextType = {
  reactions: Map<string, Reaction>;
  favorites: Set<string>;
  toggleReaction: (cardId: string, reaction: Reaction) => Promise<void>;
  toggleFavorite: (cardId: string) => Promise<void>;
};

const CardInteractionsContext = createContext<CardInteractionsContextType>({
  reactions: new Map(),
  favorites: new Set(),
  toggleReaction: async () => {},
  toggleFavorite: async () => {},
});

export function CardInteractionsProvider({
  cardIds,
  children,
}: {
  cardIds: string[];
  children: ReactNode;
}) {
  const { reactions, favorites, toggleReaction, toggleFavorite, loadForCards } =
    useUserInteractions();

  useEffect(() => {
    if (cardIds.length > 0) {
      loadForCards(cardIds);
    }
  }, [cardIds, loadForCards]);

  const value = useMemo(
    () => ({ reactions, favorites, toggleReaction, toggleFavorite }),
    [reactions, favorites, toggleReaction, toggleFavorite]
  );

  return (
    <CardInteractionsContext.Provider value={value}>
      {children}
    </CardInteractionsContext.Provider>
  );
}

export function useCardInteractions() {
  return useContext(CardInteractionsContext);
}
