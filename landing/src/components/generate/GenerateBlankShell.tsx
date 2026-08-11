"use client";

import { GenerationsContent } from "@/app/generations/GenerationsContent";
import { useAuth } from "@/context/AuthContext";
import { useGenerateDock } from "@/context/GenerateDockContext";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";

type Props = {
  onBack: () => void;
  layout?: "desktop" | "mobile";
};

/**
 * /generate history surface only. Floating composer lives in GenerateListingDockHost (PageLayout).
 */
export function GenerateBlankShell({ onBack, layout = "desktop" }: Props) {
  const { user, openAuthModal } = useAuth();
  const { historyRefreshToken } = useGenerateDock();
  const isMobile = layout === "mobile";

  return (
    <div
      className={`relative flex flex-col bg-white text-zinc-900 ${
        isMobile ? "h-full min-h-[100dvh] min-h-0 flex-1 overflow-hidden" : ""
      }`}
    >
      {isMobile ? (
        <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-zinc-200/80 bg-white/95 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md">
          <button
            type="button"
            onClick={onBack}
            className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-11 items-center rounded-full bg-zinc-100 px-4 text-[13px] font-semibold text-zinc-900 transition hover:bg-zinc-200`}
          >
            Назад
          </button>
          <h1 className="text-[15px] font-semibold text-zinc-900">История</h1>
          <span className="h-11 w-11" aria-hidden />
        </header>
      ) : null}

      <div
        className={
          isMobile
            ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 sm:px-5"
            : "px-3 pb-6 pt-1 sm:px-5"
        }
      >
        {!user ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
              <svg
                className="h-7 w-7 text-indigo-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"
                />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-zinc-900">История генераций</h2>
            <p className="mt-1.5 max-w-xs text-[13px] text-zinc-500">
              Авторизуйтесь, чтобы увидеть историю генераций
            </p>
            <button
              type="button"
              onClick={openAuthModal}
              className={`${OVERLAY_BUTTON_UA_RESET} mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-[13px] font-semibold text-white transition hover:bg-zinc-800`}
            >
              Войти
            </button>
          </div>
        ) : (
          <div className="py-4">
            <GenerationsContent refreshToken={historyRefreshToken} />
          </div>
        )}
      </div>
    </div>
  );
}
