"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useGenerateDock } from "@/context/GenerateDockContext";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_GENERATION_PHOTO_PROMPT_OPEN,
  YM_GOAL_GENERATION_PHOTO_PROMPT_START,
  YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
} from "@/lib/yandex-metrika";

type StarterMode = "text" | "photo";

const MODES: Array<{
  id: StarterMode;
  title: string;
  description: string;
}> = [
  {
    id: "text",
    title: "По описанию",
    description: "Напишите сцену своими словами",
  },
  {
    id: "photo",
    title: "По фото",
    description: "Загрузите снимок — промт соберём сами",
  },
];

function ModeIcon({ mode }: { mode: StarterMode }) {
  if (mode === "photo") {
    return (
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
      </svg>
    );
  }

  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <path d="M12 4v16" />
    </svg>
  );
}

export function GeneraciyaFotoStarter() {
  const [mode, setMode] = useState<StarterMode>("text");
  const textTabRef = useRef<HTMLButtonElement>(null);
  const photoTabRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const { user, openAuthModal } = useAuth();
  const { seedBlankPrompt, needsCredits, runBusy, runProgress } =
    useGenerateDock();
  const isAuthed = Boolean(user && user.is_anonymous !== true);

  const selectMode = (nextMode: StarterMode) => {
    setMode(nextMode);
    if (nextMode === "photo") {
      reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_OPEN);
    }
  };

  const openComposer = (nextMode: StarterMode = mode) => {
    if (!isAuthed) {
      openAuthModal();
      return;
    }
    if (needsCredits) {
      reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_PRICING);
      router.push("/pricing");
      return;
    }
    if (nextMode === "photo") {
      reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_START);
      seedBlankPrompt("", {
        entrySource: "route",
        intent: "photo_prompt",
        dockSurface: "photos",
      });
      return;
    }
    seedBlankPrompt("", {
      entrySource: "route",
      intent: "text",
      dockSurface: "prompt",
    });
  };

  const onModeKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    nextMode: StarterMode
  ) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const other = nextMode === "text" ? "photo" : "text";
      selectMode(other);
      (other === "photo" ? photoTabRef : textTabRef).current?.focus();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      selectMode(nextMode);
      openComposer(nextMode);
    }
  };

  return (
    <div className="mt-10 w-full overflow-hidden rounded-[1.75rem] border border-indigo-100/90 bg-[linear-gradient(145deg,#f2f1ff_0%,#ffffff_48%,#faf7ff_100%)] px-3 py-6 text-left text-zinc-900 shadow-[0_28px_80px_-46px_rgba(79,70,229,0.45)] sm:mt-12 sm:px-5 sm:py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
        Онлайн-генератор
      </p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
        Превратите идею в изображение
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
        Опишите будущий кадр своими словами или начните с готового промта —
        настройки модели, формата и качества откроются в генераторе.
      </p>

      <div
        className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
        role="tablist"
        aria-label="Способ создания изображения"
      >
        {MODES.map((item) => {
          const selected = mode === item.id;
          return (
            <button
              key={item.id}
              ref={item.id === "text" ? textTabRef : photoTabRef}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectMode(item.id)}
              onKeyDown={(event) => onModeKeyDown(event, item.id)}
              className={`flex min-h-11 items-start gap-4 rounded-2xl border p-4 text-left transition sm:p-5 ${
                selected
                  ? "border-transparent bg-white text-zinc-900 shadow-sm ring-2 ring-indigo-500"
                  : "border-indigo-100/90 bg-white/70 text-zinc-600 hover:bg-white"
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  selected
                    ? "bg-indigo-50 text-indigo-600"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                <ModeIcon mode={item.id} />
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="block text-base font-semibold text-zinc-900">
                  {item.title}
                </span>
                <span className="mt-1 block text-sm leading-snug text-zinc-600">
                  {item.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          id="generaciya-foto-starter-cta"
          onClick={() => openComposer()}
          aria-busy={runBusy || undefined}
          aria-valuemin={runBusy ? 0 : undefined}
          aria-valuemax={runBusy ? 100 : undefined}
          aria-valuenow={runBusy ? Math.round(runProgress) : undefined}
          className={`relative inline-flex min-h-11 items-center justify-center overflow-hidden rounded-full px-8 text-sm font-semibold text-white transition active:scale-[0.98] ${
            runBusy
              ? ""
              : needsCredits
                ? "bg-rose-500/85 shadow-lg shadow-rose-500/20 hover:bg-rose-500/95"
                : "bg-gradient-to-r from-indigo-500 via-[#5b5cf0] to-violet-500 shadow-lg shadow-indigo-500/20 hover:brightness-105"
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
    </div>
  );
}
