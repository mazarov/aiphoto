"use client";

import type { ReactNode } from "react";
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
  onClose: () => void;
  bodyClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
};

const DOCK_HANDLE_CLASS = "h-1 w-9 rounded-full bg-white/35";
const LIGHT_HANDLE_CLASS = "mx-auto mb-2 h-1 w-9 shrink-0 rounded-full bg-zinc-300";

/**
 * Unified zero-CLS layout shell for all compose sheets (`prompt`, `photos`,
 * `model`, `example`, `tool`, `auth`). Always pins the drag-handle + header at
 * top, scrolls or stretches the middle body, and pins the CTA footer at bottom.
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
  onClose,
  bodyClassName = "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain",
  footer,
  children,
}: ComposeSheetShellProps) {
  const containerClass = isDock
    ? isMobile
      ? "absolute inset-0 z-50 flex h-full min-h-0 flex-col overflow-hidden rounded-none bg-transparent bg-[linear-gradient(180deg,transparent_0%,transparent_58%,rgba(9,9,11,0.28)_100%)] p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] text-zinc-100"
      : "absolute inset-0 z-50 flex h-full min-h-0 flex-col overflow-hidden rounded-[1.75rem] bg-transparent bg-[linear-gradient(180deg,transparent_0%,transparent_58%,rgba(9,9,11,0.28)_100%)] p-3 pb-3 text-zinc-100"
    : isMobile
      ? "absolute inset-0 z-50 flex h-full min-h-0 flex-col overflow-hidden bg-white p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900"
      : "absolute inset-x-0 bottom-0 z-50 flex max-h-[min(82dvh,44rem)] min-h-0 flex-col overflow-hidden rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900 shadow-[0_-20px_60px_-24px_rgba(0,0,0,0.45)]";

  const closeBtnClass = isDock
    ? `${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15`
    : `${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200`;

  return (
    <div
      id={id}
      role={isDock ? undefined : "dialog"}
      aria-modal={isDock ? undefined : "true"}
      aria-labelledby={titleId}
      aria-label={titleId ? undefined : (ariaLabel || title)}
      className={containerClass}
    >
      {isDock ? (
        <button
          type="button"
          aria-label={collapseAriaLabel}
          onClick={onClose}
          className={`${OVERLAY_BUTTON_UA_RESET} mx-auto mb-1 flex w-full shrink-0 flex-col items-center gap-1 py-1`}
        >
          <span className={DOCK_HANDLE_CLASS} aria-hidden />
        </button>
      ) : (
        <div className={LIGHT_HANDLE_CLASS} aria-hidden />
      )}

      <div className="mb-3 flex min-h-11 shrink-0 items-center justify-between gap-3">
        <h3
          id={titleId}
          className={`truncate text-[13px] font-semibold ${
            isDock ? "text-white" : "text-zinc-900"
          }`}
        >
          {title}
        </h3>
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

      <div className={bodyClassName}>{children}</div>

      {footer ? <div className="mt-3 shrink-0">{footer}</div> : null}
    </div>
  );
}
