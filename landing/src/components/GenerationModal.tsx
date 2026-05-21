"use client";

import { useMemo, useState, useEffect } from "react";
import { useGeneration } from "@/context/GenerationContext";

/**
 * STV в iframe — выезжающая панель справа (как Chrome side panel), тот же `/embed/stv`.
 */
export function GenerationModal() {
  const generation = useGeneration();
  const isOpen = generation?.isOpen ?? false;
  const closeGenerationModal = generation?.closeGenerationModal ?? (() => {});
  const initialCardId = generation?.initialCardId ?? null;
  const sourceImageUrl = generation?.sourceImageUrl ?? null;

  const [panelIn, setPanelIn] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPanelIn(false);
      return;
    }
    const id = requestAnimationFrame(() => setPanelIn(true));
    return () => cancelAnimationFrame(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const iframeSrc = useMemo(() => {
    if (!isOpen) return "";
    const p = new URLSearchParams();
    if (initialCardId) p.set("cardId", initialCardId);
    if (sourceImageUrl) p.set("sourceImageUrl", sourceImageUrl);
    const q = p.toString();
    return q ? `/embed/stv?${q}` : "/embed/stv";
  }, [isOpen, initialCardId, sourceImageUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120]" role="presentation">
      <button
        type="button"
        aria-label="Закрыть панель генерации"
        className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
          panelIn ? "opacity-100" : "opacity-0"
        }`}
        onClick={closeGenerationModal}
      />

      <aside
        className={`absolute top-0 right-0 z-[121] flex h-[100dvh] max-h-[100vh] w-full max-w-[min(100%,528px)] flex-col border-l border-zinc-800/90 bg-zinc-950 shadow-[-12px_0_40px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out ${
          panelIn ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Генерация PromptShot"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/90 px-3 py-2.5">
          <span className="truncate text-sm font-semibold tracking-tight text-zinc-200">
            Steal This Vibe
          </span>
          <button
            type="button"
            onClick={closeGenerationModal}
            className="shrink-0 rounded-lg border border-zinc-700/80 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800"
          >
            Закрыть
          </button>
        </div>
        <iframe
          key={iframeSrc}
          title="Генерация PromptShot"
          src={iframeSrc}
          className="min-h-0 w-full flex-1 border-0 bg-zinc-950"
        />
      </aside>
    </div>
  );
}
