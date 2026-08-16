"use client";

import { useAuth } from "@/context/AuthContext";
import { ANALYZE_QUOTA_AUTH_SUBTITLE } from "@/lib/foto-v-promt-copy";
import { OAuthSignInButtons } from "./OAuthSignInButtons";
import { MobileProfileSheet } from "./MobileProfileSheet";

export function AuthModal() {
  const { showAuthModal, closeAuthModal, authModalReason } = useAuth();
  const subtitle =
    authModalReason === "analyze_quota"
      ? ANALYZE_QUOTA_AUTH_SUBTITLE
      : "Войдите, чтобы продолжить — лайки, сохранения и покупка токенов";

  if (!showAuthModal) return null;

  return (
    <>
      <div className="fixed inset-0 z-[270] hidden items-center justify-center lg:flex">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={closeAuthModal}
        />

        <div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <button
            type="button"
            onClick={closeAuthModal}
            className="absolute top-4 right-4 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-black text-white">
              P
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">Войти в PromptShot</h2>
            <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          </div>

          <p className="mb-3 text-center text-sm text-zinc-500">Войти с помощью</p>
          <OAuthSignInButtons />
        </div>
      </div>

      <MobileProfileSheet open onClose={closeAuthModal} />
    </>
  );
}
