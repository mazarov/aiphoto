"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

type Reaction = "like" | "dislike";

type UserInteractions = {
  reactions: Map<string, Reaction>;
  favorites: Set<string>;
  toggleReaction: (cardId: string, reaction: Reaction) => Promise<void>;
  toggleFavorite: (cardId: string) => Promise<void>;
  loadForCards: (cardIds: string[]) => void;
};

export function useUserInteractions(): UserInteractions {
  const { user, openAuthModal } = useAuth();
  const [reactions, setReactions] = useState<Map<string, Reaction>>(new Map());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const loadedRef = useRef<Set<string>>(new Set());

  // Refs for latest mutable values — allows action callbacks (toggle*) to keep stable identity
  // across renders (critical for reducing re-renders of all cards in the provider tree).
  const reactionsRef = useRef(reactions);
  const favoritesRef = useRef(favorites);
  const userRef = useRef(user);
  const openAuthModalRef = useRef(openAuthModal);

  // Keep refs updated (no extra renders)
  useEffect(() => {
    reactionsRef.current = reactions;
  }, [reactions]);
  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    openAuthModalRef.current = openAuthModal;
  }, [openAuthModal]);

  const loadForCards = useCallback(
    (cardIds: string[]) => {
      if (!user) return;
      const newIds = cardIds.filter((id) => !loadedRef.current.has(id));
      if (newIds.length === 0) return;

      newIds.forEach((id) => loadedRef.current.add(id));
      const supabase = createSupabaseBrowser();

      Promise.all([
        supabase
          .from("card_reactions")
          .select("card_id, reaction")
          .eq("user_id", user.id)
          .in("card_id", newIds),
        supabase
          .from("card_favorites")
          .select("card_id")
          .eq("user_id", user.id)
          .in("card_id", newIds),
      ]).then(([reactionsRes, favoritesRes]) => {
        if (reactionsRes.data) {
          setReactions((prev) => {
            const next = new Map(prev);
            for (const r of reactionsRes.data) {
              next.set(r.card_id, r.reaction as Reaction);
            }
            return next;
          });
        }
        if (favoritesRes.data) {
          setFavorites((prev) => {
            const next = new Set(prev);
            for (const f of favoritesRes.data) {
              next.add(f.card_id);
            }
            return next;
          });
        }
      });
    },
    [user]
  );

  useEffect(() => {
    if (!user) {
      setReactions(new Map());
      setFavorites(new Set());
      loadedRef.current = new Set();
    }
  }, [user]);

  const toggleReaction = useCallback(
    async (cardId: string, reaction: Reaction) => {
      const currentUser = userRef.current;
      if (!currentUser) {
        openAuthModalRef.current?.();
        return;
      }

      const supabase = createSupabaseBrowser();
      const current = reactionsRef.current.get(cardId);

      if (current === reaction) {
        // Remove reaction (toggle off)
        setReactions((prev) => {
          const next = new Map(prev);
          next.delete(cardId);
          return next;
        });
        await supabase
          .from("card_reactions")
          .delete()
          .match({ user_id: currentUser.id, card_id: cardId });
      } else {
        // Set or switch reaction
        setReactions((prev) => {
          const next = new Map(prev);
          next.set(cardId, reaction);
          return next;
        });
        await supabase.from("card_reactions").upsert(
          {
            user_id: currentUser.id,
            card_id: cardId,
            reaction,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,card_id" }
        );
      }
    },
    [] // stable identity — all reads go through refs; no recreation on reactions/user changes
  );

  const toggleFavorite = useCallback(
    async (cardId: string) => {
      const currentUser = userRef.current;
      if (!currentUser) {
        openAuthModalRef.current?.();
        return;
      }

      const supabase = createSupabaseBrowser();
      const isFavorited = favoritesRef.current.has(cardId);

      if (isFavorited) {
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(cardId);
          return next;
        });
        await supabase
          .from("card_favorites")
          .delete()
          .match({ user_id: currentUser.id, card_id: cardId });
      } else {
        setFavorites((prev) => {
          const next = new Set(prev);
          next.add(cardId);
          return next;
        });
        await supabase
          .from("card_favorites")
          .insert({ user_id: currentUser.id, card_id: cardId });
      }
    },
    [] // stable identity via refs
  );

  const api = useMemo(
    () => ({ reactions, favorites, toggleReaction, toggleFavorite, loadForCards }),
    [reactions, favorites, toggleReaction, toggleFavorite, loadForCards]
  );
  return api;
}
