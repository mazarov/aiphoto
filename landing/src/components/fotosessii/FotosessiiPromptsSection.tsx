"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CopyPromptButton } from "@/components/CopyPromptButton";
import { PhotoshootListingGrid } from "@/components/PhotoshootListingGrid";
import {
  GF_BLOCK,
  GF_H2,
  GF_LEAD,
  GF_STACK,
} from "@/components/generate/generaciya-foto-ui";
import { usePromptCardModal } from "@/context/PromptCardModalContext";
import { CARD_IMAGE_LISTING_NEXT_QUALITY } from "@/lib/card-image-presets";
import {
  usableCatalogPrompt,
  visiblePromptTextsForPhoto,
} from "@/lib/photoshoot";
import type { PromptCardFull } from "@/lib/supabase";

const MAX_VISIBLE_PROMPTS = 6;
const NEXT_PROMPT_SECTION =
  /\s+(?:Scene|Genre|Pose|Lighting|Camera|Mood|Color|Clothing|Makeup|Composition|Avoid):/i;

function firstUsableRussianPrompt(card: PromptCardFull): string | null {
  if (!card.hasRuPrompt) return null;
  for (const text of card.promptTexts) {
    const prompt = usableCatalogPrompt(text);
    if (prompt) return prompt;
  }
  return null;
}

function cardsWithRussianPrompts(cards: readonly PromptCardFull[]) {
  const seen = new Set<string>();
  return cards
    .filter((card) => firstUsableRussianPrompt(card))
    .filter((card) => {
      const prompt = firstUsableRussianPrompt(card) || "";
      if (!prompt || seen.has(prompt)) return false;
      seen.add(prompt);
      return true;
    })
    .slice(0, MAX_VISIBLE_PROMPTS);
}

function visualHookTitle(cardTitle: string, prompt: string): string {
  const source = /^visual hook:/i.test(prompt.trim()) ? prompt : cardTitle;
  const normalized = source.replace(/\s+/g, " ").trim();
  const hook = normalized.replace(/^visual hook:\s*/i, "").split(
    NEXT_PROMPT_SECTION
  )[0]?.trim();
  if (hook) return hook;
  return cardTitle.replace(/^visual hook:\s*/i, "").trim() || cardTitle;
}

function promptForFrame(card: PromptCardFull, photoIndex: number): string {
  const usable = card.promptTexts
    .map((text) => usableCatalogPrompt(text))
    .filter((text): text is string => Boolean(text));
  return (
    visiblePromptTextsForPhoto({
      promptTexts: usable.length ? usable : card.promptTexts,
      photoCount: card.photoUrls.length,
      photoIndex,
    })[0] || ""
  );
}

function FotosessiiPromptExampleCard({ card }: { card: PromptCardFull }) {
  const { open, prefetchCard } = usePromptCardModal();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const photos = card.photoUrls.slice(0, 4);
  const photoshootGrid = photos.length === 4;
  const photoUrl = photos[0] || null;
  const prompt = promptForFrame(card, selectedIndex);
  const rawCardTitle =
    card.title_ru || card.title_en || "Промт для ИИ-фотосессии";
  const cardTitle = visualHookTitle(rawCardTitle, prompt);

  function openExample(index: number, url: string | null) {
    open(card.slug, {
      photoUrl: url,
      photoIndex: index,
      photoCount: card.photoUrls.length,
      hasPrompts: card.promptTexts.length > 0,
    });
  }

  return (
    <article className="group min-w-0">
      {photoUrl ? (
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-100 shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-xl group-hover:shadow-zinc-900/10">
          {photoshootGrid ? (
            <PhotoshootListingGrid
              urls={photos}
              alt={cardTitle}
              selectedIndex={selectedIndex}
              onPrefetch={() => prefetchCard(card.slug)}
              onSelect={(url, index) => {
                setSelectedIndex(index);
                openExample(index, url);
              }}
            />
          ) : (
            <Image
              src={photoUrl}
              alt={cardTitle}
              fill
              sizes="(max-width: 1023px) calc(100vw - 3rem), 40vw"
              quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          )}
          <Link
            href={`/p/${card.slug}`}
            aria-label={`Открыть пример: ${cardTitle}`}
            className={`absolute inset-0 z-10${photoshootGrid ? " pointer-events-none" : ""}`}
            prefetch
            onPointerEnter={() => prefetchCard(card.slug)}
            onTouchStart={() => prefetchCard(card.slug)}
            onClick={(event) => {
              event.preventDefault();
              openExample(selectedIndex, photos[selectedIndex] || photoUrl);
            }}
          />
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/15 to-transparent p-3">
            <h3 className="mb-2 line-clamp-2 rounded-xl bg-white/15 px-3 py-2 text-[13px] font-semibold leading-snug text-white backdrop-blur-md">
              {cardTitle}
            </h3>
            <div className="pointer-events-auto flex gap-2 sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100">
              <CopyPromptButton
                texts={prompt ? [prompt] : []}
                className="min-h-11 min-w-0 flex-1 !rounded-full !border-white/15 !bg-white/15 !px-3 !text-[13px] !font-semibold !text-white !shadow-none !backdrop-blur-md hover:!bg-white/25"
              />
              <Link
                href={`/p/${card.slug}`}
                className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-full border border-white/15 bg-white/15 px-3 text-center text-[13px] font-semibold text-white backdrop-blur-md transition hover:bg-white/25"
                onClick={(event) => {
                  event.preventDefault();
                  openExample(selectedIndex, photos[selectedIndex] || photoUrl);
                }}
              >
                Открыть пример
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function FotosessiiPromptsSection({
  cards,
  title,
  lead,
}: {
  cards: readonly PromptCardFull[];
  title: string;
  lead: string;
}) {
  const promptCards = cardsWithRussianPrompts(cards);

  return (
    <section
      id="promty"
      className="scroll-mt-20"
      aria-labelledby="fotosessii-prompts-heading"
    >
      <div className={GF_BLOCK}>
        <h2 id="fotosessii-prompts-heading" className={GF_H2}>
          {title}
        </h2>
        <p className={GF_LEAD}>{lead}</p>

        {promptCards.length ? (
          <div className={`${GF_STACK} grid gap-4 lg:grid-cols-2`}>
            {promptCards.map((card) => (
              <FotosessiiPromptExampleCard key={card.id} card={card} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
