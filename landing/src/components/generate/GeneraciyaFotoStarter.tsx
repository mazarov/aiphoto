"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useGenerateDock } from "@/context/GenerateDockContext";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_GENERATION_PHOTO_PROMPT_OPEN,
  YM_GOAL_GENERATION_PHOTO_PROMPT_START,
} from "@/lib/yandex-metrika";

type StarterMode = "text" | "photo";

export function GeneraciyaFotoStarter() {
  const [mode, setMode] = useState<StarterMode>("text");
  const { user, openAuthModal } = useAuth();
  const { seedBlankPrompt } = useGenerateDock();

  const selectMode = (nextMode: StarterMode) => {
    setMode(nextMode);
    if (nextMode === "photo") {
      reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_OPEN);
    }
  };

  const openComposer = () => {
    if (mode === "photo") {
      reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_START);
      seedBlankPrompt("", {
        entrySource: "route",
        intent: "photo_prompt",
        dockSurface: "photos",
      });
    } else {
      seedBlankPrompt("", {
        entrySource: "route",
        intent: "text",
        dockSurface: "prompt",
      });
    }
    if (!user || user.is_anonymous === true) openAuthModal();
  };

  return (
    <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-indigo-100/90 bg-[linear-gradient(145deg,#f2f1ff_0%,#ffffff_48%,#faf7ff_100%)] text-left shadow-[0_30px_90px_-54px_rgba(79,70,229,0.5)] lg:mt-8 lg:rounded-[2rem]">
      <div className="flex flex-col p-4 lg:p-9">
        <p className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 lg:block">
          Онлайн-генератор
        </p>
        <h2 className="max-w-xl text-xl font-bold tracking-tight text-zinc-900 lg:mt-2 lg:text-3xl">
          Превратите идею в изображение
        </h2>
        <p className="mt-3 hidden max-w-xl text-sm leading-relaxed text-zinc-600 lg:block lg:text-base">
          Напишите промт в генераторе или начните с фото — настройки модели,
          формата и качества откроются сразу.
        </p>

        <div
          className="mt-4 grid grid-cols-2 rounded-xl bg-indigo-50 p-1 lg:mt-6"
          role="tablist"
          aria-label="Способ создания изображения"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "text"}
            onClick={() => selectMode("text")}
            className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition ${
              mode === "text"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-zinc-500 hover:text-indigo-700"
            }`}
          >
            По описанию
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "photo"}
            onClick={() => selectMode("photo")}
            className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition ${
              mode === "photo"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-zinc-500 hover:text-indigo-700"
            }`}
          >
            По фото
          </button>
        </div>

        <button
          type="button"
          onClick={openComposer}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-[#5b5cf0] to-violet-500 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-105 active:scale-[0.98]"
        >
          Создать промт
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <p className="mt-2 text-center text-xs text-zinc-500 lg:text-sm">
          {mode === "photo"
            ? "Сначала фото, промт составим автоматически"
            : "Откроется поле промта"}
        </p>

        <button
          type="button"
          onClick={() =>
            document
              .getElementById("primery")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className="mt-5 hidden w-fit self-center items-center gap-2 text-sm font-semibold text-indigo-600 transition hover:text-indigo-800 lg:inline-flex"
        >
          Или выберите готовый образ
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
