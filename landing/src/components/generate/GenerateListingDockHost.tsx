"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { usePricingModal } from "@/context/PricingModalContext";
import {
  isGenerateDockListingPath,
  isGenerateDockSeoPagePath,
  useGenerateDock,
} from "@/context/GenerateDockContext";
import {
  isAdminGenerateDockPath,
  listingComposeExampleInitialFilter,
  listingGenerateIdleDockSurface,
  listingGenerateIdleIntent,
} from "@/lib/generate-dock-path";
import { useListingScrollActivity } from "@/hooks/useListingScrollActivity";
import { useListingIsMobile } from "@/hooks/useListingIsMobile";
import { setListingChromeAutoHideBlocked } from "@/hooks/useListingChromeAutoHide";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { isPrimaryOverlayDismissPointer } from "@/lib/generate-compose-job";
import { COMPOSE_BUY_CREDITS_CTA } from "@/lib/generate-compose-mode";
import {
  prefetchGenerateDockWarmup,
  scheduleGenerateDockPrefetch,
} from "@/lib/generate-dock-prefetch";
import { peekOptimisticAuthUserId } from "@/lib/generate-bootstrap-client";
import { listingGenerateIdleCta } from "@/lib/promty-dlya-ii-fotosessii-cluster";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
} from "@/lib/yandex-metrika";
import {
  GenerateHostAdapterProvider,
  type GenerateHostAdapter,
} from "@/components/generate/host-adapter";

const DOCK_MOTION_V1 =
  "motion-safe:transition-[opacity,transform,max-height] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

const CardInlineGeneratePanel = dynamic(
  () =>
    import("@/components/CardInlineGeneratePanel").then(
      (module) => module.CardInlineGeneratePanel,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          backgroundColor: "rgba(12, 12, 17, 0.95)",
          backdropFilter: "blur(44px) saturate(1.55)",
          WebkitBackdropFilter: "blur(44px) saturate(1.55)",
        }}
        className="ps-dock-glass h-44 min-h-0 w-full flex-1 rounded-[1.75rem] bg-zinc-950/95 shadow-[0_-20px_60px_-12px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/15"
        aria-label="Загружаем генератор"
      />
    ),
  },
);

/**
 * Global floating generate composer on listing routes and on admin history
 * («Сгенерировать» / «Повторить»). Admin has no idle FAB.
 * Glass / result chrome lives on CardInlineGeneratePanel (photo clipped inside plate).
 * Host positions the shell, close control, and liquid morph from the floating action button.
 */
export function GenerateListingDockHost() {
  const pathname = usePathname();
  const seoPage = isGenerateDockSeoPagePath(pathname);
  const adminDock = isAdminGenerateDockPath(pathname);
  const { open: openPricing } = usePricingModal();
  const { user, loading: authLoading } = useAuth();
  const {
    seed,
    seedToken,
    generateDockV2Enabled,
    plateOpen,
    setPlateOpen,
    dockSurface,
    setDockSurface,
    notifyGenerationComplete,
    runBusy,
    runProgress,
    activeJobs,
    activeJobsSummary,
    needsCredits,
    focusBlank,
    seedBlankPrompt,
    seedPhotoshoot,
    seedSticker,
  } = useGenerateDock();
  const isMobile = useListingIsMobile();
  /** Tall + sticky plate: result chrome and/or in-flight generation. */
  const [plateLocked, setPlateLocked] = useState(false);
  const [heroCtaInView, setHeroCtaInView] = useState(true);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [everOpened, setEverOpened] = useState(false);
  const [liquidEntered, setLiquidEntered] = useState(false);
  const dockCardRef = useRef<HTMLDivElement | null>(null);

  const effectiveUserId = peekOptimisticAuthUserId({ user, authLoading });
  const isAuthed = Boolean(
    (user && user.is_anonymous !== true) || effectiveUserId,
  );
  const halfOpenCompose =
    plateOpen &&
    !isMobile &&
    !plateLocked &&
    dockSurface === null &&
    !seoPage;
  /** Collapse only after a deliberate scroll — not trackpad/touch jitter. */
  const scrolling = useListingScrollActivity({
    enabled: halfOpenCompose,
    minDeltaPx: 160,
  });

  const hostAdapter = useMemo<GenerateHostAdapter>(
    () => ({
      apiBaseUrl: "",
      credentialsMode: "include",
      openPricing,
      trackGoal: (goal, params) => reachYandexMetrikaGoal(goal, params),
      resolveInitialIntent: () => listingGenerateIdleIntent(pathname),
      resolveInitialExampleFilter: () =>
        listingComposeExampleInitialFilter(pathname),
    }),
    [openPricing, pathname],
  );

  useEffect(() => {
    setPortalEl(document.body);
  }, []);

  useEffect(() => {
    if (plateOpen) {
      setEverOpened(true);
    }
  }, [plateOpen]);

  useEffect(() => {
    if (!plateOpen) {
      setLiquidEntered(false);
      return;
    }
    const raf = window.requestAnimationFrame(() => {
      setLiquidEntered(true);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [plateOpen]);

  useEffect(
    () => scheduleGenerateDockPrefetch(pathname, effectiveUserId),
    [effectiveUserId, pathname],
  );

  useEffect(() => {
    setListingChromeAutoHideBlocked(plateOpen);
    return () => setListingChromeAutoHideBlocked(false);
  }, [plateOpen]);

  useEffect(() => {
    if (!seoPage) {
      setHeroCtaInView(false);
      return;
    }
    setHeroCtaInView(true);
    const cta = document.getElementById("generaciya-foto-starter-cta");
    if (!cta) {
      setHeroCtaInView(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setHeroCtaInView(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.4 },
    );
    observer.observe(cta);
    return () => observer.disconnect();
  }, [seoPage]);

  useEffect(() => {
    if (!scrolling || !halfOpenCompose) return;
    setPlateOpen(false);
    setDockSurface(null);
  }, [scrolling, halfOpenCompose, setPlateOpen, setDockSurface]);

  /**
   * V2: lock body scroll only when fullscreen result chrome (`plateLocked`) or sub-sheet is active on mobile.
   * V1: mobile generate shell is always fullscreen while `plateOpen`, so lock body scroll whenever `plateOpen`.
   */
  useEffect(() => {
    const shouldLockScroll = generateDockV2Enabled
      ? isMobile && plateOpen && (plateLocked || dockSurface !== null)
      : isMobile && plateOpen;
    if (!shouldLockScroll) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [dockSurface, generateDockV2Enabled, isMobile, plateLocked, plateOpen]);

  /**
   * V2 only: clicking outside the dock while a sub-surface (`photos`, `tool`, `example`,
   * `model`, `prompt`, `auth`) is expanded smoothly folds it back without a dimmed backdrop.
   */
  useEffect(() => {
    if (!generateDockV2Enabled || !plateOpen || plateLocked || dockSurface === null) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (dockCardRef.current?.contains(target)) return;
      if (target.closest('[role="dialog"], [data-keep-dock-surface]')) return;
      setDockSurface(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [dockSurface, generateDockV2Enabled, plateLocked, plateOpen, setDockSurface]);

  const handleDockSurfaceChange = useCallback(
    (surface: typeof dockSurface) => {
      setDockSurface(surface);
    },
    [setDockSurface],
  );

  const handleResultChromeChange = useCallback((active: boolean) => {
    setPlateLocked(active);
  }, []);

  const closePlate = useCallback(() => {
    setPlateOpen(false);
    setDockSurface(null);
    setPlateLocked(false);
  }, [setPlateOpen, setDockSurface]);

  const handleFabPrefetch = useCallback(() => {
    prefetchGenerateDockWarmup(effectiveUserId);
  }, [effectiveUserId]);

  const handleFabClick = useCallback(() => {
    if (needsCredits && !runBusy) {
      reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_PRICING);
      openPricing();
      return;
    }
    if (generateDockV2Enabled && activeJobs.length > 0) {
      setPlateOpen(true);
      setDockSurface(null);
      return;
    }
    const idleIntent = listingGenerateIdleIntent(pathname);
    if (idleIntent === "photo_prompt") {
      seedBlankPrompt("", { entrySource: "fab", intent: "photo_prompt" });
      return;
    }
    if (idleIntent === "photoshoot") {
      seedPhotoshoot({ entrySource: "fab" });
      return;
    }
    if (idleIntent === "sticker") {
      seedSticker({ entrySource: "fab" });
      return;
    }
    const idleSurface = listingGenerateIdleDockSurface(pathname, {
      dockV2: generateDockV2Enabled,
    });
    if (idleIntent === "text" || idleSurface === "example") {
      seedBlankPrompt("", {
        entrySource: "fab",
        intent: idleIntent ?? "text",
        dockSurface: idleSurface ?? undefined,
      });
      return;
    }
    focusBlank({ entrySource: "fab" });
  }, [
    activeJobs.length,
    focusBlank,
    generateDockV2Enabled,
    needsCredits,
    openPricing,
    pathname,
    runBusy,
    seedBlankPrompt,
    seedPhotoshoot,
    seedSticker,
    setDockSurface,
    setPlateOpen,
  ]);

  if (!isGenerateDockListingPath(pathname) && !adminDock) return null;

  const collapsed = !plateOpen;
  const fabAllowedOnRoute =
    !adminDock && !isMobile && !(seoPage && heroCtaInView);
  const showFab = fabAllowedOnRoute && collapsed;
  const keepPanelMounted =
    everOpened ||
    plateOpen ||
    runBusy ||
    plateLocked ||
    dockSurface !== null ||
    (generateDockV2Enabled && activeJobs.length > 0);
  const editorOpen = dockSurface !== null;
  const mobileFullscreen = generateDockV2Enabled
    ? isMobile && !collapsed && keepPanelMounted && plateLocked
    : isMobile && !collapsed && keepPanelMounted;
  const dockTall = generateDockV2Enabled
    ? !collapsed && keepPanelMounted && plateLocked
    : !collapsed && keepPanelMounted && (mobileFullscreen || editorOpen || plateLocked);
  const layout = isMobile ? "mobile" : "desktop";

  const showResultScrim = !collapsed && plateLocked && !isMobile;
  const showLegacyCloseControl =
    !generateDockV2Enabled && !collapsed && isMobile && !plateLocked && !editorOpen;
  const warmHiddenV1 = !generateDockV2Enabled && isMobile && collapsed && keepPanelMounted;

  const dockShellClass = generateDockV2Enabled
    ? isMobile
      ? mobileFullscreen
        ? "pointer-events-none fixed inset-0 z-[122] flex h-screen min-h-0 flex-col overflow-hidden supports-[height:100dvh]:h-[100dvh]"
        : "pointer-events-none fixed inset-x-0 bottom-0 top-[max(0.25rem,env(safe-area-inset-top))] z-[122] flex min-h-0 flex-col justify-end"
      : "pointer-events-none fixed inset-x-0 bottom-0 top-[calc(var(--ps-header-height,96px)+0.75rem)] z-[52] flex min-h-0 flex-col justify-end px-3 pb-3 pt-0 lg:left-72 lg:top-[calc(var(--ps-unpaid-banner-height,0px)+0.75rem)] lg:px-5"
    : isMobile
      ? warmHiddenV1
        ? "pointer-events-none fixed inset-0 z-[-1] opacity-0"
        : "pointer-events-none fixed inset-0 z-[122] flex h-screen min-h-0 flex-col overflow-hidden supports-[height:100dvh]:h-[100dvh]"
      : dockTall
        ? "pointer-events-none fixed inset-x-0 bottom-0 top-[calc(var(--ps-header-height,96px)+0.75rem)] z-[52] flex flex-col px-3 pb-4 pt-2 lg:left-72 lg:top-[calc(var(--ps-unpaid-banner-height,0px)+0.75rem)] lg:px-5"
        : "pointer-events-none fixed inset-x-0 bottom-0 z-[52] px-3 pb-4 pt-2 lg:left-72 lg:px-5";

  const isLiquidOpen = !collapsed && liquidEntered;
  const panelWrapperClass = generateDockV2Enabled
    ? isMobile
      ? mobileFullscreen
        ? isLiquidOpen
          ? "ps-dock-liquid-shell ps-dock-liquid-shell--mobile-open pointer-events-auto flex h-full min-h-0 flex-1 flex-col"
          : "ps-dock-liquid-shell ps-dock-liquid-shell--mobile-closed pointer-events-none flex h-full min-h-0 flex-1 flex-col overflow-hidden"
        : isLiquidOpen
          ? "ps-dock-liquid-shell ps-dock-liquid-shell--mobile-open pointer-events-auto flex max-h-full min-h-0 w-full flex-col rounded-t-[1.75rem]"
          : "ps-dock-liquid-shell ps-dock-liquid-shell--mobile-closed pointer-events-none flex max-h-14 w-full flex-col overflow-hidden rounded-t-[1.75rem]"
      : isLiquidOpen
        ? dockTall
          ? "ps-dock-liquid-shell ps-dock-liquid-shell--open pointer-events-auto flex h-full min-h-0 flex-1 flex-col rounded-[1.75rem]"
          : "ps-dock-liquid-shell ps-dock-liquid-shell--open pointer-events-auto flex max-h-full min-h-0 w-full flex-col rounded-[1.75rem]"
        : "ps-dock-liquid-shell ps-dock-liquid-shell--closed pointer-events-none max-h-14 w-full overflow-hidden rounded-[1.75rem]"
    : `w-full overflow-hidden ${isMobile ? "" : DOCK_MOTION_V1} ${
        warmHiddenV1
          ? "pointer-events-none opacity-100"
          : collapsed
            ? "pointer-events-none max-h-0 translate-y-3 scale-[0.96] opacity-0"
            : mobileFullscreen
              ? "pointer-events-auto flex h-full min-h-0 flex-1 flex-col"
              : dockTall
                ? "pointer-events-auto flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem]"
                : "pointer-events-auto max-h-[100dvh]"
      }`;

  const parallelCount = generateDockV2Enabled ? activeJobsSummary.activeCount : 0;
  const unseenDoneCount = generateDockV2Enabled
    ? activeJobsSummary.unseenCompletedCount
    : 0;
  const fabBusyText =
    (generateDockV2Enabled ? activeJobsSummary.fabLabel : null) ??
    `Генерируем · ${Math.round(runProgress)}%`;

  const overlay = (
    <GenerateHostAdapterProvider value={hostAdapter}>
      {showResultScrim ? (
        <button
          type="button"
          aria-label="Закрыть"
          className={`${OVERLAY_BUTTON_UA_RESET} fixed inset-0 z-[51] bg-black/55 backdrop-blur-[2px] lg:left-72`}
          onClick={closePlate}
        />
      ) : generateDockV2Enabled ? (
        !collapsed && isMobile && !plateLocked ? (
          <button
            type="button"
            aria-label={editorOpen ? "Свернуть раздел" : "Закрыть генератор"}
            className={`${OVERLAY_BUTTON_UA_RESET} fixed inset-0 z-[121] bg-transparent`}
            onPointerDown={(event) => {
              if (!isPrimaryOverlayDismissPointer(event)) return;
              if (editorOpen) {
                setDockSurface(null);
              } else {
                closePlate();
              }
            }}
          />
        ) : null
      ) : !collapsed && editorOpen && !isMobile ? (
        <button
          type="button"
          aria-label="Свернуть редактор"
          className={`${OVERLAY_BUTTON_UA_RESET} fixed inset-0 z-[51] bg-black/35 backdrop-blur-[1px] lg:left-72`}
          onPointerDown={(event) => {
            if (!isPrimaryOverlayDismissPointer(event)) return;
            setDockSurface(null);
          }}
        />
      ) : null}

      {showLegacyCloseControl ? (
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

      {keepPanelMounted || fabAllowedOnRoute ? (
        <div
          data-dock-viewport-slot={generateDockV2Enabled ? "" : undefined}
          className={dockShellClass}
          aria-hidden={
            warmHiddenV1 || (isMobile && collapsed) ? true : undefined
          }
        >
          <div
            className={`pointer-events-none relative mx-auto flex min-h-0 w-full flex-col ${
              generateDockV2Enabled ? "h-full justify-end " : ""
            }${
              mobileFullscreen || (generateDockV2Enabled && isMobile)
                ? "h-full max-w-none"
                : dockTall
                  ? "h-full max-w-3xl"
                  : "max-w-3xl items-center"
            }`}
          >
            {keepPanelMounted ? (
              <div
                ref={dockCardRef}
                className={panelWrapperClass}
                aria-hidden={collapsed}
              >
                <div
                  className={
                    generateDockV2Enabled
                      ? `ps-dock-liquid-inner ${
                          dockTall || mobileFullscreen
                            ? "flex h-full min-h-0 flex-1 flex-col"
                            : "flex max-h-full min-h-0 w-full flex-col"
                        }`
                      : dockTall || mobileFullscreen
                        ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
                        : undefined
                  }
                >
                  <CardInlineGeneratePanel
                    seedToken={seedToken}
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

            {fabAllowedOnRoute && (generateDockV2Enabled || showFab) ? (
              <div
                className={
                  generateDockV2Enabled
                    ? `hidden w-full justify-center lg:flex ${
                        keepPanelMounted ? "absolute inset-x-0 bottom-0 z-10" : ""
                      } transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        showFab
                          ? "pointer-events-auto translate-y-0 scale-100 opacity-100 delay-75"
                          : "pointer-events-none -translate-y-1.5 scale-x-[1.14] scale-y-[1.04] opacity-0"
                      }`
                    : `hidden w-full justify-center lg:flex ${DOCK_MOTION_V1} pointer-events-auto max-h-16 translate-y-0 scale-100 opacity-100`
                }
                aria-hidden={!showFab}
              >
                <button
                  type="button"
                  tabIndex={showFab ? 0 : -1}
                  onPointerEnter={handleFabPrefetch}
                  onPointerDown={handleFabPrefetch}
                  onTouchStart={handleFabPrefetch}
                  onClick={handleFabClick}
                  aria-busy={runBusy || undefined}
                  aria-valuemin={runBusy ? 0 : undefined}
                  aria-valuemax={runBusy ? 100 : undefined}
                  aria-valuenow={runBusy ? Math.round(runProgress) : undefined}
                  className={`${OVERLAY_BUTTON_UA_RESET} relative isolate inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full px-5 text-[13px] font-semibold leading-none text-white transition active:scale-[0.98] ${
                    runBusy
                      ? generateDockV2Enabled
                        ? "ring-1 ring-white/20 shadow-[0_12px_32px_-10px_rgba(24,24,27,0.65)]"
                        : ""
                      : generateDockV2Enabled
                        ? "fab-create-cta bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:brightness-110"
                        : "bg-indigo-600 shadow-[0_12px_32px_-10px_rgba(79,70,229,0.55)] hover:bg-indigo-700"
                  }`}
                  style={
                    runBusy
                      ? {
                          backgroundColor: generateDockV2Enabled
                            ? "rgba(24,24,27,0.92)"
                            : "rgba(39,39,42,0.95)",
                        }
                      : undefined
                  }
                >
                  {generateDockV2Enabled && !runBusy ? (
                    <>
                      <span className="fab-create-cta__sheen" aria-hidden />
                      <span className="fab-create-cta__orbit" aria-hidden>
                        <span className="fab-create-cta__spin" />
                      </span>
                    </>
                  ) : runBusy ? (
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
                  <span className="relative z-10 inline-flex items-center justify-center gap-2 leading-none">
                    {runBusy ? (
                      generateDockV2Enabled ? (
                        <>
                          {parallelCount >= 2 ? (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-[11px] font-bold tabular-nums text-white">
                              {parallelCount}
                            </span>
                          ) : (
                            <span
                              className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
                              aria-hidden
                            />
                          )}
                          <span className="tabular-nums">{fabBusyText}</span>
                        </>
                      ) : (
                        <span>{fabBusyText}</span>
                      )
                    ) : needsCredits ? (
                      <span>{COMPOSE_BUY_CREDITS_CTA}</span>
                    ) : generateDockV2Enabled ? (
                      <>
                        <svg
                          className="h-4 w-4 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"
                          />
                        </svg>
                        <span>{listingGenerateIdleCta({ pathname, isAuthed })}</span>
                        {unseenDoneCount > 0 ? (
                          <span className="inline-flex h-5 items-center rounded-full bg-emerald-400/95 px-1.5 text-[11px] font-bold leading-none text-zinc-950">
                            +{unseenDoneCount}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span>{listingGenerateIdleCta({ pathname, isAuthed })}</span>
                    )}
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </GenerateHostAdapterProvider>
  );

  if (isMobile && portalEl) {
    return createPortal(overlay, portalEl);
  }
  return overlay;
}
