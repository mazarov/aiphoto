"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import type { PhotoMeta } from "@/lib/supabase";
import {
  CARD_IMAGE_NEXT_QUALITY,
  SIZES_CARD_GRID,
  SIZES_CARD_HERO_VIEWPORT,
} from "@/lib/card-image-presets";

type Props = {
  photoUrls: string[];
  photoMeta: PhotoMeta[];
  beforePhotoUrl: string | null;
  alt: string;
  cardId: string;
};

export function PhotoCarousel({
  photoUrls,
  photoMeta,
  beforePhotoUrl: initialBeforeUrl,
  alt,
  cardId,
}: Props) {
  const [beforeUrl, setBeforeUrl] = useState(initialBeforeUrl);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const { displayedUrls, displayedMeta } = useMemo(() => {
    if (!beforeUrl) return { displayedUrls: photoUrls, displayedMeta: photoMeta };
    return {
      displayedUrls: photoUrls.filter((u) => u !== beforeUrl),
      displayedMeta: photoMeta.filter((m) => m.url !== beforeUrl),
    };
  }, [photoUrls, photoMeta, beforeUrl]);

  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = Math.min(activeIndex, Math.max(0, displayedUrls.length - 1));
  const currentUrl = displayedUrls[safeIndex] || null;

  async function handleSetBefore() {
    const meta = displayedMeta[safeIndex] ?? photoMeta[safeIndex];
    if (!meta) return;

    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/set-before", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          storageBucket: meta.bucket,
          storagePath: meta.path,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setStatus(`Ошибка: ${data.error || res.statusText}`);
        return;
      }
      setBeforeUrl(meta.url);
      setActiveIndex((i) => Math.min(i, Math.max(0, displayedUrls.length - 2)));
      setStatus("Сохранено");
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
        {currentUrl ? (
          <>
            <Image
              src={currentUrl}
              alt=""
              fill
              sizes={SIZES_CARD_HERO_VIEWPORT}
              quality={CARD_IMAGE_NEXT_QUALITY}
              className="object-cover scale-105 blur-2xl brightness-[0.6] saturate-150"
              aria-hidden
            />
            <Image
              src={currentUrl}
              alt={alt}
              fill
              sizes={SIZES_CARD_HERO_VIEWPORT}
              quality={CARD_IMAGE_NEXT_QUALITY}
              className="object-contain relative"
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400 text-sm">
            Нет фото
          </div>
        )}

        {beforeUrl && (
          <div className="absolute left-2 bottom-2 w-16 rounded-lg overflow-hidden border border-white/40 shadow-xl bg-black/50 backdrop-blur-sm">
            <div className="text-[10px] text-white/80 text-center py-0.5 border-b border-white/15">
              Было
            </div>
            <div className="aspect-square relative">
              <Image
                src={beforeUrl}
                alt="before"
                fill
                className="object-cover"
                sizes={SIZES_CARD_GRID}
                quality={CARD_IMAGE_NEXT_QUALITY}
              />
            </div>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {displayedUrls.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto p-2 bg-zinc-50 border-t border-zinc-100">
          {displayedUrls.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`flex-shrink-0 w-11 h-11 rounded-lg overflow-hidden border-2 transition ${
                i === safeIndex
                  ? "border-indigo-500 shadow-sm"
                  : "border-zinc-200 hover:border-zinc-400"
              }`}
            >
              <Image
                src={url}
                alt={`thumb ${i + 1}`}
                width={44}
                height={44}
                className="object-cover w-full h-full"
                quality={CARD_IMAGE_NEXT_QUALITY}
              />
            </button>
          ))}
        </div>
      )}

      {/* Set before control */}
      <div className="flex items-center gap-2 px-2.5 py-2 bg-zinc-50 border-t border-zinc-100">
        <button
          type="button"
          onClick={handleSetBefore}
          disabled={saving || displayedUrls.length === 0}
          className="rounded-lg bg-amber-100 border border-amber-300 px-2.5 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200 disabled:opacity-50"
        >
          {saving ? "Сохраняю..." : "Сделать \"Было\""}
        </button>
        {status && (
          <span
            className={`text-xs ${
              status.startsWith("Ошибка") ? "text-red-600" : "text-emerald-600"
            }`}
          >
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
