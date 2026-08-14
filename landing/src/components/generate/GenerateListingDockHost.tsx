"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  isGenerateDockListingPath,
  isGenerateDockSeoPagePath,
  useGenerateDock,
} from "@/context/GenerateDockContext";
import { useListingScrollActivity } from "@/hooks/useListingScrollActivity";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
} from "@/lib/yandex-metrika";

const DOCK_MOTION =
  "motion-safe:transition-[opacity,transform,max-height] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

const CardInlineGeneratePanel = dynamic(
  () =>
    import("@/components/CardInlineGeneratePanel").then(
      (module) => module.CardInlineGeneratePanel
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-24 w-full animate-pulse rounded-[1.75rem] bg-zinc-200/80"
        aria-label="Загружаем генератор"
      />
    ),
  }
);

/**
 * Global floating generate composer on listing routes.
 * Glass / result chrome lives on CardInlineGeneratePanel (photo clipped inside plate).
 * Host only positions the shell and close control.
 */
export function GenerateListingDockHost() {
  const pathname = usePathname();
  const seoPage = isGenerateDockSeoPagePath(pathname);
  const router = useRouter();
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const {
    seed,
    seedToken,
    plateOpen,
    setPlateOpen,
    dockSurface,
    setDockSurface,
    notifyGenerationComplete,
    runBusy,
    runProgress,
    needsCredits,
    focusBlank,
  } = useGenerateDock();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 1023px)").matches
      : false
  );
  /** Tall + sticky plate: result chrome and/or in-flight generation. */
  const [plateLocked, setPlateLocked] = useState(false);

  const isAuthed = Boolean(user && user.is_anonymous !== true);
  const halfOpenCompose =
    isAuthed &&
    plateOpen &&
    !isMobile &&
    !plateLocked &&
    dockSurface === null;
  /** Collapse only after a deliberate scroll — not trackpad/touch jitter. */
  const scrolling = useListingScrollActivity({
    enabled: halfOpenCompose,
    minDeltaPx: 160,
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!scrolling || !halfOpenCompose) return;
    setPlateOpen(false);
    setDockSurface(null);
  }, [scrolling, halfOpenCompose, setPlateOpen, setDockSurface]);

  /** Mobile generate: lock body scroll while the fullscreen shell is open. */
  useEffect(() => {
    if (!isMobile || !plateOpen || !isAuthed) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, plateOpen, isAuthed]);

  const handleDockSurfaceChange = useCallback(
    (surface: typeof dockSurface) => {
      setDockSurface(surface);
    },
    [setDockSurface]
  );

  const handleResultChromeChange = useCallback((active: boolean) => {
    setPlateLocked(active);
  }, []);

  const closePlate = useCallback(() => {
    setPlateOpen(false);
    setDockSurface(null);
    setPlateLocked(false);
  }, [setPlateOpen, setDockSurface]);

  const handleFabClick = useCallback(() => {
    if (!isAuthed) {
      openAuthModal();
      return;
    }
    if (needsCredits) {
      reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_PRICING);
      router.push("/pricing");
      return;
    }
    focusBlank({ entrySource: "tab" });
  }, [isAuthed, needsCredits, openAuthModal, router, focusBlank]);

  if (!isGenerateDockListingPath(pathname)) return null;

  const collapsed = authLoading || !isAuthed || !plateOpen;
  const showFab = !isMobile && collapsed;
  const keepPanelMounted =
    isAuthed &&
    !authLoading &&
    (plateOpen || runBusy || plateLocked || dockSurface !== null);
  const editorOpen = dockSurface !== null;
  /** Mobile tab open = always fullscreen; desktop tall for editor / result. */
  const mobileFullscreen =
    isMobile && !collapsed && keepPanelMounted;
  const dockTall =
    !collapsed &&
    keepPanelMounted &&
    (mobileFullscreen || editorOpen || plateLocked);
  const layout = isMobile ? "mobile" : "desktop";

  if (isMobile && !isAuthed && !authLoading) return null;

  /**
   * Mobile compose host X — hide while editor sheet is open so it doesn't sit
   * on top of the sheet's own close control (would close the whole screen).
   * Result screen uses in-plate ⋯ + X.
   */
  const showCloseControl =
    !collapsed && isMobile && !plateLocked && !editorOpen;
  const showResultScrim = !collapsed && plateLocked && !isMobile;
  const warmHidden =
    isMobile && collapsed && keepPanelMounted;

  const dockShellClass = isMobile
    ? warmHidden
      ? "pointer-events-none fixed inset-0 z-[-1] opacity-0"
      : // Full viewport above tab bar (z-40) and listing nav/header.
        "pointer-events-none fixed inset-0 z-[122] flex flex-col"
    : dockTall
      ? "pointer-events-none fixed inset-x-0 bottom-0 top-[calc(var(--ps-header-height,57px)+0.75rem)] z-[52] flex flex-col px-3 pb-4 pt-2 lg:left-72 lg:top-3 lg:px-5"
      : "pointer-events-none fixed inset-x-0 bottom-0 z-[52] px-3 pb-4 pt-2 lg:left-72 lg:px-5";

  return (
    <>
      {showResultScrim ? (
        <button
          type="button"
          aria-label="Закрыть"
          className={`${OVERLAY_BUTTON_UA_RESET} fixed inset-0 z-[51] bg-black/55 backdrop-blur-[2px] lg:left-72`}
          onClick={closePlate}
        />
      ) : !collapsed && editorOpen && !isMobile ? (
        <button
          type="button"
          aria-label="Свернуть редактор"
          className={`${OVERLAY_BUTTON_UA_RESET} fixed inset-0 z-[51] bg-black/35 backdrop-blur-[1px] lg:left-72`}
          onClick={() => setDockSurface(null)}
        />
      ) : null}

      {showCloseControl ? (
        <button
          type="button"
          aria-label="Закрыть"
          onClick={closePlate}
          className={`${OVERLAY_BUTTON_UA_RESET} fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[123] flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white shadow-lg ring-1 ring-white/20 backdrop-blur-md transition hover:bg-black/60 active:scale-[0.98] lg:right-5`}
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}

      <div className={dockShellClass} aria-hidden={warmHidden || undefined}>
        <div
          className={`pointer-events-none relative mx-auto flex w-full flex-col ${
            mobileFullscreen
              ? "h-full min-h-0 max-w-none"
              : dockTall
                ? "h-full min-h-0 max-w-3xl overflow-hidden"
                : "max-w-3xl items-center"
          }`}
        >
          {keepPanelMounted ? (
            <div
              className={`w-full overflow-hidden ${
                isMobile ? "" : DOCK_MOTION
              } ${
                warmHidden
                  ? "pointer-events-none opacity-100"
                  : collapsed
                    ? "pointer-events-none max-h-0 translate-y-3 scale-[0.96] opacity-0"
                    : mobileFullscreen
                      ? "pointer-events-auto flex h-full min-h-0 flex-1 flex-col"
                      : dockTall
                        ? "pointer-events-auto flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem]"
                        : "pointer-events-auto max-h-[100dvh]"
              }`}
              aria-hidden={collapsed}
            >
              <div
                className={
                  dockTall || mobileFullscreen
                    ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
                    : undefined
                }
              >
                <CardInlineGeneratePanel
                  key={seedToken}
                  source={seed.source}
                  chrome="dock"
                  generationSurface={seoPage ? "seo_page" : undefined}
                  promptText={seed.promptText}
                  cardId={seed.cardId}
                  onBack={closePlate}
                  layout={layout}
                  onGenerationComplete={notifyGenerationComplete}
                  dockSurface={dockSurface}
                  onDockSurfaceChange={handleDockSurfaceChange}
                  onDockResultChromeChange={handleResultChromeChange}
                />
              </div>
            </div>
          ) : null}

          {showFab ? (
            <div
              className={`hidden w-full justify-center lg:flex ${DOCK_MOTION} pointer-events-auto max-h-16 translate-y-0 scale-100 opacity-100`}
            >
              <button
                type="button"
                onClick={handleFabClick}
                aria-busy={runBusy || undefined}
                aria-valuemin={runBusy ? 0 : undefined}
                aria-valuemax={runBusy ? 100 : undefined}
                aria-valuenow={runBusy ? Math.round(runProgress) : undefined}
                className={`${OVERLAY_BUTTON_UA_RESET} relative inline-flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-full px-5 text-[13px] font-semibold text-white transition active:scale-[0.98] ${
                  runBusy
                    ? ""
                    : needsCredits
                      ? "bg-rose-500/85 shadow-[0_12px_28px_-14px_rgba(244,63,94,0.45)] hover:bg-rose-500/95"
                      : "bg-indigo-600 shadow-[0_12px_32px_-10px_rgba(79,70,229,0.55)] hover:bg-indigo-700"
                }`}
                style={
                  runBusy ? { backgroundColor: "rgba(39,39,42,0.95)" } : undefined
                }
              >
                {runBusy ? (
                  <span
                    className="pointer-events-none absolute inset-y-0 left-0 z-0 origin-left transition-transform duration-300 ease-out"
                    style={{
                      width: "100%",
                      transform: `scaleX(${Math.min(1, Math.max(0.06, runProgress / 100))})`,
                      background:
                        "linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)",
                    }}
                    aria-hidden
                  />
                ) : null}
                <span className="relative z-10 inline-flex items-center gap-2">
                  {runBusy || needsCredits ? null : (
                    <svg
                      className="h-4 w-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"
                      />
                    </svg>
                  )}
                  {runBusy
                    ? `Генерируем · ${Math.round(runProgress)}%`
                    : needsCredits
                      ? "Недостаточно кредитов"
                      : isAuthed
                        ? "Сгенерировать"
                        : "Войти и сгенерировать"}
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
