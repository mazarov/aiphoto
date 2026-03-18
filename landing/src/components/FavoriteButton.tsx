"use client";

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
  const size = isLg ? 22 : isOverlay ? 16 : 20;
  const pad = isLg ? "p-2" : "p-1.5";

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggle(cardId); }}
      className={`rounded-full ${pad} transition-all active:scale-90 ${
        isOverlay
          ? isFavorited
            ? "text-amber-300"
            : "text-white/60 hover:text-white"
          : isFavorited
            ? "text-amber-500 hover:text-amber-600"
            : "text-zinc-300 hover:text-amber-500"
      }`}
      title={isFavorited ? "Убрать из избранного" : "В избранное"}
    >
      <BookmarkIcon size={size} filled={isFavorited} />
    </button>
  );
}

function BookmarkIcon({ size, filled }: { size: number; filled: boolean }) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
