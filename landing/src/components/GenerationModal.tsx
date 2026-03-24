"use client";

import { useMemo } from "react";
import { useGeneration } from "@/context/GenerationContext";

/**
 * Full-screen iframe: same STV UI + API as the Chrome extension (`/embed/stv`).
 */
export function GenerationModal() {
  const generation = useGeneration();
  const isOpen = generation?.isOpen ?? false;
  const closeGenerationModal = generation?.closeGenerationModal ?? (() => {});
  const initialCardId = generation?.initialCardId ?? null;
  const sourceImageUrl = generation?.sourceImageUrl ?? null;

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
    <div className="fixed inset-0 z-[120] flex flex-col bg-black/55 backdrop-blur-[2px]">
      <div className="flex shrink-0 justify-end gap-2 px-3 py-2">
        <button
          type="button"
          onClick={closeGenerationModal}
          className="rounded-xl border border-white/20 bg-zinc-900/90 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800"
        >
          Закрыть
        </button>
      </div>
      <iframe
        key={iframeSrc}
        title="Генерация PromptShot"
        src={iframeSrc}
        className="min-h-0 flex-1 w-full border-0 bg-zinc-950"
      />
    </div>
  );
}
