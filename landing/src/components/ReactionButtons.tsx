"use client";

import { CARD_OVERLAY_ACTION_PILL } from "@/lib/card-overlay-action-pill";

type Props = {
  cardId: string;
  likesCount: number;
  dislikesCount: number;
  userReaction: "like" | "dislike" | null;
  onToggle: (cardId: string, reaction: "like" | "dislike") => void;
  variant?: "overlay" | "overlay-lg" | "surface";
  /** Vertical stack (e.g. top-right metrics column on card preview). */
  stacked?: boolean;
};

export function ReactionButtons({
  cardId,
  likesCount,
  dislikesCount,
  userReaction,
  onToggle,
  variant = "surface",
  stacked = false,
}: Props) {
  const isOverlay = variant === "overlay" || variant === "overlay-lg";
  const isLg = variant === "overlay-lg";

  const base = isOverlay
    ? "text-white/70 hover:text-white"
    : "text-zinc-400 hover:text-zinc-600";

  const activeUp = isOverlay
    ? "text-emerald-300"
    : "text-emerald-500";

  const activeDown = isOverlay
    ? "text-red-300"
    : "text-red-400";

  const size = isLg ? 20 : isOverlay ? 14 : 18;
  const countClass = isLg ? "text-xs" : isOverlay ? "text-[10px]" : "text-xs";
  const stackedOverlay = stacked && isOverlay;
  const padding = isLg ? "p-1.5" : isOverlay ? "px-2 py-1" : "p-1";

  const likeAria =
    userReaction === "like"
      ? likesCount > 0
        ? `Снять лайк, сейчас ${likesCount}`
        : "Снять лайк"
      : likesCount > 0
        ? `Лайк, ${likesCount}`
        : "Лайк";
  const dislikeAria =
    userReaction === "dislike"
      ? dislikesCount > 0
        ? `Снять дизлайк, сейчас ${dislikesCount}`
        : "Снять дизлайк"
      : dislikesCount > 0
        ? `Дизлайк, ${dislikesCount}`
        : "Дизлайк";

  return (
    <div
      className={
        stacked
          ? `flex flex-col items-end ${stackedOverlay ? "gap-1.5" : "gap-0.5"}`
          : `flex items-center ${isOverlay ? "gap-1.5" : "gap-0.5"}`
      }
    >
      <button
        type="button"
        aria-label={likeAria}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggle(cardId, "like"); }}
        className={`flex items-center transition-colors active:scale-95 ${
          isOverlay
            ? `${CARD_OVERLAY_ACTION_PILL} min-w-[2.75rem]`
            : `appearance-none gap-0.5 rounded-md border-0 shadow-none ${padding}`
        } ${userReaction === "like" ? activeUp : base}`}
      >
        <ThumbUpIcon size={size} filled={userReaction === "like"} />
        {likesCount > 0 && (
          <span className={`${countClass} tabular-nums font-medium`}>{likesCount}</span>
        )}
      </button>
      <button
        type="button"
        aria-label={dislikeAria}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggle(cardId, "dislike"); }}
        className={`flex items-center transition-colors active:scale-95 ${
          isOverlay
            ? `${CARD_OVERLAY_ACTION_PILL} min-w-[2.75rem]`
            : `appearance-none gap-0.5 rounded-md border-0 shadow-none ${padding}`
        } ${userReaction === "dislike" ? activeDown : base}`}
      >
        <ThumbDownIcon size={size} filled={userReaction === "dislike"} />
        {dislikesCount > 0 && (
          <span className={`${countClass} tabular-nums font-medium`}>{dislikesCount}</span>
        )}
      </button>
    </div>
  );
}

function ThumbUpIcon({ size, filled }: { size: number; filled: boolean }) {
  if (filled) {
    return (
      <svg className="block shrink-0" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66a4.8 4.8 0 0 0-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84C7 18.95 8.05 20 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z" />
      </svg>
    );
  }
  return (
    <svg className="block shrink-0" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function ThumbDownIcon({ size, filled }: { size: number; filled: boolean }) {
  if (filled) {
    return (
      <svg className="block shrink-0" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M22 4h-2c-.55 0-1 .45-1 1v9c0 .55.45 1 1 1h2V4zM2.17 11.12c-.11.25-.17.52-.17.8V13c0 1.1.9 2 2 2h5.5l-.92 4.65c-.05.22-.02.46.08.66.23.45.52.86.88 1.22L10 22l6.41-6.41c.38-.38.59-.89.59-1.42V6.34C17 5.05 15.95 4 14.66 4h-8.1c-.71 0-1.36.37-1.72.97l-2.67 6.15z" />
      </svg>
    );
  }
  return (
    <svg className="block shrink-0" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}
