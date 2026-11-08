"use client";

import { useEffect, useState } from "react";
import {
  EyeOffIcon,
  REVEAL_ON_HOVER,
  SpinnerIcon,
  TILE_BUTTON,
} from "@/components/admin/tile-action-ui";
import { useAuth } from "@/context/AuthContext";
import { isCatalogAdminEmail } from "@/lib/catalog-admin";
import { dispatchDebugCardVisibility } from "@/lib/debug-tools-session";

type HideState = "idle" | "confirm" | "pending" | "error";

const CONFIRM_MS = 3000;

const TONE: Record<HideState, string> = {
  idle: `${REVEAL_ON_HOVER} bg-zinc-950/70 text-white ring-white/15 hover:bg-zinc-950/90`,
  confirm: "bg-red-600 text-white ring-red-500/40 shadow-red-600/30 hover:bg-red-700",
  pending: "bg-zinc-950/70 text-white ring-white/15",
  error: "bg-red-600 text-white ring-red-500/40",
};

/** Catalog admin only: first tap arms, second tap unpublishes the card everywhere. */
export function DebugHideTileButton({
  cardId,
  slug,
  decorative = false,
}: {
  cardId: string;
  slug: string;
  decorative?: boolean;
}) {
  const { user } = useAuth();
  const isAdmin = isCatalogAdminEmail(user?.email);
  const [state, setState] = useState<HideState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state !== "confirm" && state !== "error") return;
    const timer = window.setTimeout(() => setState("idle"), state === "confirm" ? CONFIRM_MS : 4500);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (!isAdmin) return null;

  async function hide() {
    setState("pending");
    try {
      const res = await fetch("/api/debug-hide-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cardId, confirmSlug: slug, published: false }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || res.statusText);
      dispatchDebugCardVisibility({ cardId, slug, published: false });
      setState("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось скрыть");
      setState("error");
    }
  }

  const label =
    state === "confirm" ? "Точно скрыть?" : state === "error" ? "Ошибка" : "Скрыть";

  return (
    <button
      type="button"
      title={state === "error" ? error ?? undefined : "Скрыть карточку с витрины: каталог, поиск, шапки"}
      aria-label={state === "confirm" ? "Подтвердите: скрыть карточку с витрины" : "Скрыть с витрины"}
      aria-busy={state === "pending" || undefined}
      tabIndex={decorative ? -1 : undefined}
      disabled={state === "pending"}
      className={`${TILE_BUTTON} ${TONE[state]}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (state === "confirm") void hide();
        else setState("confirm");
      }}
    >
      {state === "pending" ? <SpinnerIcon /> : <EyeOffIcon />}
      {label}
    </button>
  );
}
