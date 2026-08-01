"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useGeneration } from "@/context/GenerationContext";

/**
 * STV в iframe — выезжающая панель справа (как Chrome side panel), тот же `/embed/stv`.
 */
export function GenerationModal() {
  const generation = useGeneration();
  const isOpen = generation?.isOpen ?? false;
  const closeGenerationModal = generation?.closeGenerationModal ?? (() => {});
  const initialCardId = generation?.initialCardId ?? null;
  const initialPrompt = generation?.initialPrompt ?? null;
  const sourceImageUrl = generation?.sourceImageUrl ?? null;

  const [panelIn, setPanelIn] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  const sendInitialPrompt = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "STV_INITIAL_PROMPT",
        cardId: initialCardId,
        prompt: initialPrompt ?? "",
      },
      window.location.origin
    );
  }, [initialCardId, initialPrompt]);

  useEffect(() => {
    if (!isOpen) return;
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.source === iframeRef.current?.contentWindow &&
        event.data?.type === "STV_READY_FOR_PROMPT"
      ) {
        sendInitialPrompt();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isOpen, sendInitialPrompt]);

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
        className={`absolute top-0 right-0 z-[121] flex h-[100dvh] max-h-[100vh] w-full max-w-[min(100%,600px)] flex-col border-l border-white/10 bg-[#09090b] shadow-[-20px_0_64px_rgba(0,0,0,0.56)] transition-transform duration-300 ease-out ${
          panelIn ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Генерация PromptShot"
      >
        <div className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 md:px-5">
          <span className="truncate text-lg font-semibold tracking-tight text-zinc-100">
            Генерация
          </span>
          <button
            type="button"
            onClick={closeGenerationModal}
            aria-label="Закрыть генерацию"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-300 transition hover:bg-white/10 hover:text-white active:scale-[0.97]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <iframe
          ref={iframeRef}
          key={iframeSrc}
          title="Генерация PromptShot"
          src={iframeSrc}
          onLoad={sendInitialPrompt}
          className="min-h-0 w-full flex-1 border-0 bg-zinc-950"
        />
      </aside>
    </div>
  );
}
