"use client";

import { useAuth } from "@/context/AuthContext";
import { signInWithOAuthProvider, YANDEX_OAUTH_PROVIDER } from "@/lib/auth-oauth";

const oauthButtonClass =
  "flex h-12 w-full items-center gap-3 rounded-xl px-4 text-sm font-medium transition-all active:scale-[0.98]";

export function AuthModal() {
  const { showAuthModal, closeAuthModal } = useAuth();

  if (!showAuthModal) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeAuthModal}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-2xl bg-white p-6 shadow-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute top-4 right-4 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-black text-white">
            P
          </div>
          <h2 className="text-lg font-semibold text-zinc-900">Войти в PromptShot</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Войдите, чтобы продолжить — лайки, сохранения и покупка токенов
          </p>
        </div>

        <p className="mb-3 text-center text-sm text-zinc-500">Войти с помощью</p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => signInWithOAuthProvider("google")}
            className={`${oauthButtonClass} border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
              <GoogleIcon />
            </span>
            <span className="flex-1 text-left">Войти через Google</span>
          </button>

          <button
            type="button"
            onClick={() => signInWithOAuthProvider(YANDEX_OAUTH_PROVIDER)}
            className={`${oauthButtonClass} border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
              <YandexIcon />
            </span>
            <span className="flex-1 text-left">Войти через Яндекс</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/** Логотип Яндекс ID: красный круг + «Я» */
function YandexIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#FC3F1D" />
      <path
        fill="#fff"
        d="M13.32 18.4h-2.14V12.55L7.9 5.6h2.28l1.88 5.2c.18.52.35 1.05.48 1.58h.06c.13-.53.31-1.06.48-1.58L14.96 5.6h2.24l-3.28 6.95V18.4z"
      />
    </svg>
  );
}
