"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useState } from "react";
import { ListingMasonry, ListingMasonryItem } from "@/components/ListingMasonry";
import { ListingPhotoTile } from "@/components/ListingPhotoTile";
import { useAuth } from "@/context/AuthContext";
import { useGenerateDock } from "@/context/GenerateDockContext";
import {
  type GenerationExampleCard,
  toGenerationExampleCard,
  writeGenerationExampleNavigation,
} from "@/lib/generation/example-card";
import { listingPhotoAspectRatio } from "@/lib/listing-masonry";
import type { PromptCardFull } from "@/lib/supabase";
import {
  GENERACIYA_FOTO_SCENARIOS,
  GENERACIYA_FOTO_SEO,
} from "@/lib/generaciya-foto-seo-copy";

const RESULT_LIMIT = 16;
const SEARCH_DEBOUNCE_MS = 320;

type QuickFilter = (typeof GENERACIYA_FOTO_SCENARIOS)[number];

function matchesQuickFilter(
  card: GenerationExampleCard,
  filter: QuickFilter
): boolean {
  return (card.seoTags[filter.dimension] || []).includes(filter.value);
}

export function GeneraciyaFotoExamplesExplorer({
  initialCards,
}: {
  initialCards: GenerationExampleCard[];
}) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<QuickFilter | null>(null);
  const [cards, setCards] = useState(initialCards);
  const [loading, setLoading] = useState(false);
  const [repeatingCardId, setRepeatingCardId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { user, openAuthModal } = useAuth();
  const { seedFromCard } = useGenerateDock();

  useLayoutEffect(() => {
    if (cards.length > 0) writeGenerationExampleNavigation(cards);
  }, [cards]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 && !activeFilter) {
      setCards(initialCards);
      setLoading(false);
      setError("");
      return;
    }
    if (trimmed.length > 0 && trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(
      () => {
        setLoading(true);
        setError("");

        const endpoint =
          trimmed.length >= 2
            ? `/api/search?q=${encodeURIComponent(trimmed)}&limit=${RESULT_LIMIT}`
            : `/api/listing?${new URLSearchParams({
                [activeFilter!.dimension]: activeFilter!.value,
                limit: String(RESULT_LIMIT),
                sort: "new",
                strict: "1",
              })}`;

        void fetch(endpoint, {
          cache: "no-store",
          signal: controller.signal,
        })
          .then(async (response) => {
            if (!response.ok) throw new Error("search_failed");
            const payload = (await response.json()) as {
              cards?: PromptCardFull[];
            };
            const nextCards = (payload.cards ?? []).map(
              toGenerationExampleCard
            );
            setCards(
              trimmed.length < 2 && activeFilter
                ? nextCards
                    .filter((card) =>
                      matchesQuickFilter(card, activeFilter)
                    )
                    .slice(0, RESULT_LIMIT)
                : nextCards.slice(0, RESULT_LIMIT)
            );
          })
          .catch((fetchError: unknown) => {
            if (
              fetchError instanceof DOMException &&
              fetchError.name === "AbortError"
            ) {
              return;
            }
            setCards([]);
            setError("Не удалось загрузить подборку. Попробуйте ещё раз.");
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      trimmed.length >= 2 ? SEARCH_DEBOUNCE_MS : 0
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeFilter, initialCards, query]);

  const repeatCard = async (card: GenerationExampleCard) => {
    if (!user || user.is_anonymous === true) {
      openAuthModal();
      return;
    }

    setRepeatingCardId(card.id);
    setError("");
    try {
      const response = await fetch(`/api/card/${encodeURIComponent(card.slug)}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("card_fetch_failed");
      const payload = (await response.json()) as {
        data?: { promptTexts?: string[] };
      };
      const promptText = (payload.data?.promptTexts ?? [])
        .filter((prompt) => prompt.trim())
        .join("\n\n");
      if (!promptText) throw new Error("prompt_missing");

      seedFromCard(
        { promptText, cardId: card.id },
        { entrySource: "card" }
      );
    } catch {
      setError("Не удалось открыть промт. Попробуйте ещё раз.");
    } finally {
      setRepeatingCardId(null);
    }
  };

  const allPromptsHref =
    query.trim().length >= 2
      ? `/search?q=${encodeURIComponent(query.trim())}`
      : activeFilter?.href || "/";

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-indigo-100/90 bg-[linear-gradient(145deg,#f2f1ff_0%,#ffffff_48%,#faf7ff_100%)] px-3 pb-0 pt-5 text-zinc-900 shadow-[0_28px_80px_-46px_rgba(79,70,229,0.45)] sm:px-5 sm:pt-7">
      <div className="w-full">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
          Онлайн-генератор
        </p>
        <h2
          id="examples-heading"
          className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
        >
          {GENERACIYA_FOTO_SEO.examplesTitle}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
          {GENERACIYA_FOTO_SEO.examplesIntro}
        </p>

        <label htmlFor="generation-examples-search" className="sr-only">
          Найти промт для фото
        </label>
        <div className="mt-5 flex min-h-12 items-center gap-3 rounded-2xl border border-indigo-100 bg-white px-4 shadow-sm transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100/70">
          <svg
            className="h-4 w-4 shrink-0 text-zinc-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id="generation-examples-search"
            type="search"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              if (nextQuery.trim()) setActiveFilter(null);
            }}
            placeholder="Найти образ, стиль или сюжет"
            className="min-w-0 flex-1 bg-transparent py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            autoComplete="off"
          />
          {loading ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-500"
              aria-label="Ищем"
            />
          ) : query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-indigo-50 hover:text-indigo-700"
              aria-label="Очистить поиск"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          ) : null}
        </div>

        <nav
          className="mt-3 flex flex-wrap gap-2"
          aria-label="Быстрые подборки промтов"
        >
          {GENERACIYA_FOTO_SCENARIOS.map((filter) => {
            const active = activeFilter?.value === filter.value;
            return (
              <Link
                key={filter.value}
                href={filter.href}
                aria-pressed={active}
                onClick={(event) => {
                  event.preventDefault();
                  setQuery("");
                  setActiveFilter(active ? null : filter);
                }}
                className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium transition ${
                  active
                    ? "border-indigo-500 bg-indigo-500 text-white shadow-sm shadow-indigo-500/20"
                    : "border-indigo-100 bg-white/80 text-zinc-600 hover:border-indigo-300 hover:bg-white hover:text-indigo-700"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="relative mt-5 overflow-hidden">
        <ListingMasonry loading={loading}>
          {cards.map((card, index) => (
            <ListingMasonryItem key={card.id}>
              <ListingPhotoTile
                card={card}
                repeating={repeatingCardId === card.id}
                onRepeat={repeatCard}
                aspectRatio={listingPhotoAspectRatio(
                  card.photoWidth,
                  card.photoHeight,
                  index
                )}
              />
            </ListingMasonryItem>
          ))}
        </ListingMasonry>

        {cards.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
            <div
              className="absolute inset-x-0 bottom-0 h-32 backdrop-blur-[6px] [mask-image:linear-gradient(to_top,black,transparent)] sm:h-40"
              aria-hidden
            />
            <div
              className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white/50 via-white/15 to-transparent sm:h-40"
              aria-hidden
            />
            <div className="relative flex justify-center pb-4 pt-16 sm:pb-5 sm:pt-20">
              <Link
                href={allPromptsHref}
                className="pointer-events-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-indigo-200 bg-white/95 px-5 text-sm font-semibold text-indigo-700 shadow-sm backdrop-blur-sm transition hover:border-indigo-300 hover:bg-white"
              >
                Все промты
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {!loading && cards.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center px-4 pb-8 text-center">
          <p className="text-base font-semibold text-zinc-900">
            {error || "Подходящих промтов пока не найдено"}
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
            Измените формулировку или выберите одну из быстрых подборок.
          </p>
        </div>
      ) : error ? (
        <p className="mt-4 pb-5 text-center text-sm text-rose-600" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
