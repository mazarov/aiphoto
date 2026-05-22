"use client";

import { useCallback, useState } from "react";
import {
  copyLexyPromptSyncExec,
  copyLexyPromptToClipboard,
  openLexyGptPlaygroundTab,
} from "@/lib/lexygpt-generate";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_LEXYGPT_GENERATE,
} from "@/lib/yandex-metrika";
import {
  OVERLAY_BUTTON_APPEARANCE_RESET,
  OVERLAY_BUTTON_UA_RESET,
} from "@/lib/card-overlay-action-pill";

type Props = {
  promptText: string;
  variant: "listing" | "expanded" | "sticky";
  disabled?: boolean;
  className?: string;
};

type Phase =
  | "idle"
  | "opening"
  | "tab_only"
  | "clipboard_popup_blocked"
  | "blocked";

const VARIANT_BASE: Record<Props["variant"], string> = {
  listing: `${OVERLAY_BUTTON_APPEARANCE_RESET} flex-1 min-w-0 rounded-full border border-emerald-400/40 bg-emerald-600/85 px-2 py-1.5 text-[10px] font-semibold text-white backdrop-blur-md shadow-sm transition-all hover:bg-emerald-600 active:scale-[0.98] sm:px-3 sm:py-2 sm:text-[11px]`,
  expanded: `${OVERLAY_BUTTON_UA_RESET} flex-1 shrink-0 min-w-0 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50`,
  sticky:
    "inline-flex flex-1 min-h-[3rem] min-w-0 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-2 text-center text-xs font-semibold leading-snug text-white shadow-lg transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm sm:leading-normal",
};

const PHASE_MS = 2800;

/** Outbound CTA → LexyGPT: вкладка открывается синхронно по клику, промпт уходит в буфер когда возможно. */
export function LexyGptGenerateButton({
  promptText,
  variant,
  disabled,
  className = "",
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);

  const resetPhaseLater = useCallback(() => {
    window.setTimeout(() => {
      setPhase("idle");
      setBusy(false);
    }, PHASE_MS);
  }, []);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const trimmed = promptText.trim();
      if (disabled || !trimmed || busy) return;

      reachYandexMetrikaGoal(YM_GOAL_LEXYGPT_GENERATE, {
        placement: variant,
      });

      setBusy(true);

      /** Сразу после клика (тот же user gesture) — иначе pop-up и Clipboard режутся. */
      const openedWindow = openLexyGptPlaygroundTab();
      /** Сразу синхронно после клика; часто срабатывает, когда async Clipboard уже отказывает. */
      const copiedViaExecSync = copyLexyPromptSyncExec(trimmed);

      void (async () => {
        try {
          const copied =
            copiedViaExecSync ||
            (await copyLexyPromptToClipboard(trimmed));
          const tabOk = openedWindow != null && !openedWindow.closed;

          if (tabOk && copied) {
            setPhase("opening");
          } else if (tabOk && !copied) {
            setPhase("tab_only");
          } else if (!tabOk && copied) {
            setPhase("clipboard_popup_blocked");
          } else {
            setPhase("blocked");
          }
        } catch {
          setPhase("blocked");
        } finally {
          resetPhaseLater();
        }
      })();
    },
    [busy, disabled, promptText, resetPhaseLater, variant]
  );

  const ariaLabelDetailed =
    phase === "opening"
      ? "Скопировано, новая вкладка LexyGPT открыта"
      : phase === "tab_only"
        ? "Вкладка LexyGPT открыта — скопируйте промпт из страницы"
        : phase === "clipboard_popup_blocked"
          ? "Промпт скопирован — разрешите всплывающие окна для LexyGPT"
          : phase === "blocked"
            ? "Не удалось открыть LexyGPT"
            : "Повторить в LexyGPT: скопировать промпт и открыть вкладку";

  const visibleLabel =
    variant === "sticky"
      ? phase === "opening"
        ? "Готово"
        : phase === "tab_only"
          ? "Скопируйте промпт"
          : phase === "clipboard_popup_blocked"
            ? "Разрешите окна"
            : phase === "blocked"
              ? "Ошибка"
              : "Повторить"
      : phase === "opening"
        ? "Скопировано · новая вкладка"
        : phase === "tab_only"
          ? "Вкладка открыта — скопируйте промпт"
          : phase === "clipboard_popup_blocked"
            ? "Промпт скопирован · разрешите окна"
            : phase === "blocked"
              ? "Не удалось открыть вкладку"
              : "Сгенерировать";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !promptText.trim() || busy}
      aria-label={ariaLabelDetailed}
      className={`${VARIANT_BASE[variant]} ${className}`.trim()}
    >
      {visibleLabel}
    </button>
  );
}
