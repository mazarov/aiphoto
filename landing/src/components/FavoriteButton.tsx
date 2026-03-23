"use client";

import { CARD_OVERLAY_ACTION_PILL } from "@/lib/card-overlay-action-pill";

type Props = {
  cardId: string;
  isFavorited: boolean;
  onToggle: (cardId: string) => void;
  variant?: "overlay" | "overlay-lg" | "surface";
};

export function FavoriteButton({
  cardId,
  isFavorited,
  onToggle,
  variant = "surface",
}: Props) {
  const isOverlay = variant === "overlay" || variant === "overlay-lg";
  const isLg = variant === "overlay-lg";
  const size = isLg ? 22 : isOverlay ? 14 : 20;
  const padSurface = isLg ? "p-2" : "p-1.5";

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggle(cardId); }}
      className={`flex items-center justify-center transition-all active:scale-90 ${
        isOverlay
          ? `${CARD_OVERLAY_ACTION_PILL} min-w-[2.75rem] ${
              isFavorited ? "text-amber-300" : "text-white/60 hover:text-white"
            }`
          : `appearance-none rounded-full border-0 shadow-none ${padSurface} ${
              isFavorited
                ? "text-amber-500 hover:text-amber-600"
                : "text-zinc-300 hover:text-amber-500"
            }`
      }`}
      title={isFavorited ? "Убрать из избранного" : "В избранное"}
      aria-label={isFavorited ? "Убрать из избранного" : "В избранное"}
    >
      <BookmarkIcon size={size} filled={isFavorited} className="block shrink-0" />
    </button>
  );
}

function BookmarkIcon({ size, filled, className }: { size: number; filled: boolean; className?: string }) {
  if (filled) {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
      </svg>
    );
  }
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
