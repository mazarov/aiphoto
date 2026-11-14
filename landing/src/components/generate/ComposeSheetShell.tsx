"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";

export type ComposeSheetShellProps = {
  id?: string;
  title: string;
  titleId?: string;
  ariaLabel?: string;
  collapseAriaLabel?: string;
  closeAriaLabel?: string;
  isDock: boolean;
  isMobile: boolean;
  /** Desktop dock: hug content naturally instead of stretching to 85vh (e.g. model sheet). */
  compactDesktop?: boolean;
  /**
   * Renders in-flow inside the existing dock block so the dock itself stretches smoothly
   * upward without spawning a second modal overlay, extra backdrop, or duplicate CTA.
   */
  inFlowDock?: boolean;
  /** Opaque dark surface when opened on top of a bright result photo (e.g. «Что изменить»). */
  opaqueBackdrop?: boolean;
  onClose: () => void;
  headerAction?: ReactNode;
  bodyClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
};

const LIGHT_HANDLE_CLASS = "mx-auto mb-2 h-1 w-9 shrink-0 rounded-full bg-zinc-300";

/**
 * Smoothly animates height from `0px` <-> content/viewport height (and glides between
 * heights when switching dock tools) while keeping outgoing content mounted during close
 * so collapsing never snaps abruptly.
 *
 * - `fillViewport = true` (e.g. «Выбрать стиль»): stretches all the way to the top of the
 *   available viewport slot on both desktop and mobile.
 * - `fillViewport = false` (default): grows to fit content and caps at the top of the
 *   available viewport slot (scrolling internally when content fills the screen).
 */
export function DockInlineDrawer({
  open,
  fillViewport = false,
  elevatedStage = false,
  children,
  className = "",
}: {
  open: boolean;
  fillViewport?: boolean;
  /** Bottom-to-top lighter gradient to distinguish the rising upper stage above Промт. */
  elevatedStage?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);
  const lastElevatedRef = useRef(Boolean(elevatedStage));
  const lastNonNullChildrenRef = useRef<ReactNode>(null);
  if (open && children != null) {
    lastNonNullChildrenRef.current = children;
  }
  if (open) {
    lastElevatedRef.current = Boolean(elevatedStage);
  }

  const [shouldRender, setShouldRender] = useState(open);
  if (open && !shouldRender) {
    setShouldRender(true);
  }
  const [heightPx, setHeightPx] = useState<number>(0);

  useEffect(() => {
    if (open) {
      return;
    }
    setHeightPx(0);
    const timer = window.setTimeout(() => {
      wasOpenRef.current = false;
      setShouldRender(false);
    }, 340);
    return () => window.clearTimeout(timer);
  }, [open]);

  useLayoutEffect(() => {
    if (!shouldRender) return;
    const wrapperEl = wrapperRef.current;
    const innerEl = innerRef.current;
    if (!wrapperEl || !innerEl) return;

    let rafId = 0;

    const sumStaticSiblings = (
      parent: HTMLElement | null,
      skip: Element | null,
    ): number => {
      if (!parent) return 0;
      let total = 0;
      for (let i = 0; i < parent.children.length; i += 1) {
        const child = parent.children[i] as HTMLElement;
        if (child === skip) continue;
        if (child.getAttribute("data-dock-tucking") === "true") continue;
        const pos = window.getComputedStyle(child).position;
        if (pos === "absolute" || pos === "fixed") continue;
        total += child.offsetHeight;
      }
      return total;
    };

    const computeAvailableMaxPx = (): number => {
      const slotEl = wrapperEl.closest(
        "[data-dock-viewport-slot]",
      ) as HTMLElement | null;
      const panelEl = wrapperEl.closest(
        "[data-dock-panel-root]",
      ) as HTMLElement | null;
      const bodyParent = wrapperEl.parentElement;
      if (slotEl && panelEl && bodyParent) {
        const slotCs = window.getComputedStyle(slotEl);
        const slotPadY =
          (parseFloat(slotCs.paddingTop) || 0) +
          (parseFloat(slotCs.paddingBottom) || 0);
        const slotInnerH = Math.max(0, slotEl.clientHeight - slotPadY);
        const nonDrawerH =
          sumStaticSiblings(panelEl, bodyParent) +
          sumStaticSiblings(bodyParent, wrapperEl);
        return Math.max(180, Math.floor(slotInnerH - nonDrawerH));
      }
      const vh =
        typeof window !== "undefined"
          ? (window.visualViewport?.height ?? window.innerHeight)
          : 800;
      return Math.max(200, Math.floor(vh - 280));
    };

    const measure = () => {
      if (!wrapperRef.current || !innerRef.current) return;
      const maxPx = computeAvailableMaxPx();
      innerRef.current.style.maxHeight = `${maxPx}px`;
      innerRef.current.style.height = fillViewport ? `${maxPx}px` : "auto";
      const next = fillViewport
        ? maxPx
        : Math.min(maxPx, innerRef.current.offsetHeight);
      setHeightPx((prev) => (Math.abs(prev - next) >= 1 ? next : prev));
    };

    if (open) {
      if (wasOpenRef.current) {
        measure();
      } else {
        // Paint 0px first so the upward stretch animates smoothly on initial open.
        void wrapperEl.offsetHeight;
        rafId = window.requestAnimationFrame(() => {
          wasOpenRef.current = true;
          measure();
        });
      }

      const slotEl = wrapperEl.closest(
        "[data-dock-viewport-slot]",
      ) as HTMLElement | null;
      const bodyParent = wrapperEl.parentElement;
      const observer =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(() => measure())
          : null;
      observer?.observe(innerEl);
      if (slotEl) observer?.observe(slotEl);
      if (bodyParent) {
        for (let i = 0; i < bodyParent.children.length; i += 1) {
          const sib = bodyParent.children[i];
          if (sib !== wrapperEl) observer?.observe(sib);
        }
      }

      window.addEventListener("resize", measure);
      const vv = window.visualViewport;
      vv?.addEventListener("resize", measure);

      return () => {
        if (rafId) window.cancelAnimationFrame(rafId);
        observer?.disconnect();
        window.removeEventListener("resize", measure);
        vv?.removeEventListener("resize", measure);
      };
    } else {
      setHeightPx(0);
    }
  }, [open, fillViewport, elevatedStage, shouldRender, children]);

  if (!shouldRender) return null;

  const content = open ? children : lastNonNullChildrenRef.current;
  const activeElevated = open ? Boolean(elevatedStage) : lastElevatedRef.current;

  const elevatedStageStyle = activeElevated
    ? {
        backgroundImage:
          "radial-gradient(115% 70% at 50% 0%, rgba(165, 180, 252, 0.12) 0%, rgba(165, 180, 252, 0) 65%)",
      }
    : undefined;

  return (
    <div
      ref={wrapperRef}
      aria-hidden={!open}
      style={{
        height: `${open ? heightPx : 0}px`,
        opacity: open ? 1 : 0,
        transition:
          "height 340ms cubic-bezier(0.19, 1, 0.22, 1), opacity 200ms ease-out",
        ...elevatedStageStyle,
      }}
      className={`relative z-20 min-h-0 overflow-hidden will-change-[height,opacity] motion-reduce:transition-none ${
        activeElevated ? "ps-dock-upper-stage" : ""
      } ${open ? "" : "pointer-events-none"} ${className}`.trim()}
    >
      <div ref={innerRef} className="flex min-h-0 w-full flex-col">
        {content}
      </div>
    </div>
  );
}

/**
 * Middle summary deck (`Промт` + `[Ваши фото · Инструмент · Стиль · Модель]`, or mobile hub header)
 * that glides smoothly underneath the foreground `<footer>` (`z-30`) whenever any step opens,
 * and glides back out with updated selections when returning to the hub.
 */
export function DockSummaryPocket({
  enabled = true,
  tucked,
  children,
  outerClassName = "",
  className = "",
}: {
  enabled?: boolean;
  tucked: boolean;
  children: ReactNode;
  outerClassName?: string;
  className?: string;
}) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const tuckedRef = useRef(tucked);
  tuckedRef.current = tucked;
  const prevTuckedRef = useRef(tucked);
  const [animateReady, setAnimateReady] = useState(false);
  const [heightPx, setHeightPx] = useState<number | null>(() =>
    tucked ? 0 : null,
  );

  if (prevTuckedRef.current !== tucked) {
    prevTuckedRef.current = tucked;
    if (!animateReady) {
      setAnimateReady(true);
    }
  }

  useEffect(() => {
    if (!enabled) return;
    const raf = window.requestAnimationFrame(() => {
      setAnimateReady(true);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [enabled]);

  useLayoutEffect(() => {
    if (!enabled) return;
    const node = innerRef.current;
    if (!node) return;
    const syncHeight = () => {
      if (!innerRef.current) return;
      if (tuckedRef.current) {
        setHeightPx(0);
        return;
      }
      const next = innerRef.current.offsetHeight;
      setHeightPx((prev) =>
        prev === null || Math.abs(prev - next) >= 1 ? next : prev,
      );
    };
    syncHeight();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => syncHeight())
        : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [enabled, tucked, children]);

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  const resolvedHeight = tucked
    ? "0px"
    : heightPx !== null
      ? `${heightPx}px`
      : undefined;

  return (
    <div
      data-dock-tucking={tucked ? "true" : undefined}
      aria-hidden={tucked || undefined}
      style={{
        height: resolvedHeight,
        transition: animateReady
          ? "height 340ms cubic-bezier(0.19, 1, 0.22, 1)"
          : undefined,
      }}
      className={`relative z-10 shrink-0 overflow-hidden will-change-[height] motion-reduce:transition-none ${
        tucked ? "pointer-events-none" : ""
      } ${outerClassName}`.trim()}
    >
      <div
        ref={innerRef}
        style={{
          transform: tucked
            ? "translate3d(0, 14px, 0) scale(0.985)"
            : "translate3d(0, 0, 0) scale(1)",
          opacity: tucked ? 0 : 1,
          transition: animateReady
            ? tucked
              ? "transform 280ms cubic-bezier(0.19, 1, 0.22, 1), opacity 190ms ease-out"
              : "transform 340ms cubic-bezier(0.19, 1, 0.22, 1), opacity 240ms ease-out 35ms"
            : undefined,
        }}
        className={`w-full will-change-[transform,opacity] motion-reduce:transition-none ${className}`.trim()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Smoothly morphs container height when switching between compact footer CTA (`Войдите`)
 * and inline sign-in buttons (`Войти через Google / Яндекс`).
 */
export function DockAutoHeightBox({
  enabled = true,
  children,
  className = "",
}: {
  enabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [heightPx, setHeightPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!enabled) return;
    const node = innerRef.current;
    if (!node) return;
    const measure = () => {
      if (!innerRef.current) return;
      const next = innerRef.current.offsetHeight;
      setHeightPx((prev) =>
        prev === null || Math.abs(prev - next) >= 1 ? next : prev,
      );
    };
    measure();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measure())
        : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [children, enabled]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div
      style={
        heightPx !== null
          ? {
              height: `${heightPx}px`,
              transition: "height 320ms cubic-bezier(0.19, 1, 0.22, 1)",
            }
          : undefined
      }
      className={`overflow-hidden will-change-[height] motion-reduce:transition-none ${className}`.trim()}
    >
      <div ref={innerRef} className="w-full">
        {children}
      </div>
    </div>
  );
}

/**
 * Unified zero-CLS layout shell for compose sheets (`prompt`, `photos`,
 * `model`, `example`, `tool`, `auth`).
 * - When `inFlowDock` is true, renders directly inside the dock block (zero nested backdrop).
 * - Otherwise renders an overlay sheet (`chrome="fullscreen"` or result-photo remix sheet).
 */
export function ComposeSheetShell({
  id,
  title,
  titleId,
  ariaLabel,
  collapseAriaLabel = "Свернуть",
  closeAriaLabel = "Закрыть",
  isDock,
  isMobile,
  compactDesktop = false,
  inFlowDock = false,
  opaqueBackdrop = false,
  onClose,
  headerAction,
  bodyClassName = "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain",
  footer,
  children,
}: ComposeSheetShellProps) {
  if (inFlowDock) {
    return (
      <div
        id={id}
        role="region"
        aria-labelledby={titleId}
        aria-label={titleId ? undefined : (ariaLabel || title)}
        className="relative flex min-h-0 w-full flex-[1_1_auto] flex-col gap-3 p-3 text-zinc-100"
      >
        <div className="flex min-h-8 shrink-0 items-center justify-between gap-2">
          <h3
            id={titleId}
            className="min-w-0 truncate text-[13px] font-semibold tracking-tight text-white"
          >
            {title}
          </h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {headerAction}
            <button
              type="button"
              aria-label={collapseAriaLabel || closeAriaLabel}
              onClick={onClose}
              className={`${OVERLAY_BUTTON_UA_RESET} flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/25 text-white/85 ring-1 ring-inset ring-white/15 transition hover:bg-white/15 hover:text-white active:scale-95`}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m6 9 6 6 6-6"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className={bodyClassName}>{children}</div>

        {footer ? <div className="shrink-0">{footer}</div> : null}
      </div>
    );
  }

  const dockFill = opaqueBackdrop
    ? "bg-zinc-950/95 backdrop-blur-xl"
    : "ps-dock-glass bg-zinc-950/90";

  const containerClass = isDock
    ? isMobile
      ? `absolute inset-0 z-50 flex h-full min-h-0 flex-col overflow-hidden rounded-none ${dockFill} p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] text-zinc-100`
      : compactDesktop
        ? `relative z-50 flex max-h-[min(82dvh,42rem)] min-h-0 w-full flex-col overflow-hidden rounded-[1.75rem] ${dockFill} p-3 pb-3 text-zinc-100`
        : `absolute inset-0 z-50 flex h-full min-h-0 flex-col overflow-hidden rounded-[1.75rem] ${dockFill} p-3 pb-3 text-zinc-100`
    : isMobile
      ? "absolute inset-0 z-50 flex h-full min-h-0 flex-col overflow-hidden bg-white p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900"
      : "absolute inset-x-0 bottom-0 z-50 flex max-h-[min(82dvh,44rem)] min-h-0 flex-col overflow-hidden rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900 shadow-[0_-20px_60px_-24px_rgba(0,0,0,0.45)]";

  const closeBtnClass = isDock
    ? `${OVERLAY_BUTTON_UA_RESET} flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15`
    : `${OVERLAY_BUTTON_UA_RESET} flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200`;

  return (
    <div
      id={id}
      role={isDock ? undefined : "dialog"}
      aria-modal={isDock ? undefined : "true"}
      aria-labelledby={titleId}
      aria-label={titleId ? undefined : (ariaLabel || title)}
      className={containerClass}
    >
      {!isDock ? <div className={LIGHT_HANDLE_CLASS} aria-hidden /> : null}

      <div className="mb-3 flex min-h-10 shrink-0 items-center justify-between gap-3">
        <h3
          id={titleId}
          className={`truncate text-[13px] font-semibold ${
            isDock ? "text-white" : "text-zinc-900"
          }`}
        >
          {title}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {headerAction}
          <button
            type="button"
            aria-label={closeAriaLabel}
            onClick={onClose}
            className={closeBtnClass}
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
        </div>
      </div>

      <div className={bodyClassName}>{children}</div>

      {footer ? <div className="mt-3 shrink-0">{footer}</div> : null}
    </div>
  );
}
