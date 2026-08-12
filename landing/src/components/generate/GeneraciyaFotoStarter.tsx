"use client";

import Image from "next/image";
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useGenerateDock } from "@/context/GenerateDockContext";
import { usePromptCardModal } from "@/context/PromptCardModalContext";
import { CyclingPreviewImage } from "@/components/generate/CyclingPreviewImage";
import type { GenerationExampleCard } from "@/lib/generation/example-card";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_GENERATION_PHOTO_PROMPT_OPEN,
  YM_GOAL_GENERATION_PHOTO_PROMPT_READY,
  YM_GOAL_GENERATION_PHOTO_PROMPT_START,
  YM_GOAL_GENERATION_PHOTO_PROMPT_UPLOAD,
} from "@/lib/yandex-metrika";

type StarterMode = "text" | "photo";
type PhotoPromptPhase = "empty" | "loading" | "ready" | "error";

export function GeneraciyaFotoStarter({
  previewCards,
}: {
  previewCards: GenerationExampleCard[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<StarterMode>("text");
  const [prompt, setPrompt] = useState("");
  const [photoPhase, setPhotoPhase] = useState<PhotoPromptPhase>("empty");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [selectingCardId, setSelectingCardId] = useState<string | null>(null);
  const [selectErrorCardId, setSelectErrorCardId] = useState<string | null>(
    null
  );
  const { user, openAuthModal } = useAuth();
  const { seedBlankPrompt } = useGenerateDock();
  const { open: openCard, loadCard, prefetchCard } = usePromptCardModal();
  const previews = useMemo(
    () => previewCards.filter((card) => card.photoUrl).slice(0, 5),
    [previewCards]
  );
  const frames = useMemo(
    () => previews.map((card) => card.photoUrl as string),
    [previews]
  );
  const activePreview =
    previews[activePreviewIndex % Math.max(1, previews.length)] ?? null;

  const startGeneration = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "photo") {
      reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_START);
    }
    seedBlankPrompt(prompt, { entrySource: "route" });
    if (!user || user.is_anonymous === true) openAuthModal();
  };

  const selectMode = (nextMode: StarterMode) => {
    setMode(nextMode);
    if (nextMode === "photo") {
      reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_OPEN);
    }
  };

  const selectActivePrompt = async () => {
    if (!activePreview || selectingCardId) return;
    const selectedCard = activePreview;
    setSelectingCardId(selectedCard.id);
    setSelectErrorCardId(null);

    const data = await loadCard(selectedCard.slug);
    const selectedPrompt = (data?.promptTexts ?? [])
      .filter((item) => item.trim())
      .join("\n\n");

    setSelectingCardId(null);
    if (!selectedPrompt) {
      setSelectErrorCardId(selectedCard.id);
      window.setTimeout(() => {
        setSelectErrorCardId((current) =>
          current === selectedCard.id ? null : current
        );
      }, 2500);
      return;
    }

    setPrompt(selectedPrompt);
    setMode("text");
    window.requestAnimationFrame(() => {
      promptInputRef.current?.focus();
      promptInputRef.current?.setSelectionRange(
        selectedPrompt.length,
        selectedPrompt.length
      );
    });
  };

  const analyzePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || photoPhase === "loading") return;

    setPhotoPhase("loading");
    setPhotoError("");
    setPhotoPreview("");
    setPrompt("");
    reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_UPLOAD);

    try {
      const { prepareUploadFile } = await import(
        "@/lib/image-upload-prepare"
      );
      const prepared = await prepareUploadFile(file);
      if (!prepared.ok) {
        const message =
          prepared.error === "too_large"
            ? "Файл слишком большой. Максимальный размер — 10 МБ."
            : prepared.error === "invalid_type"
              ? "Выберите изображение JPEG, PNG, WebP или GIF."
              : "Не удалось прочитать изображение. Попробуйте другой файл.";
        setPhotoError(message);
        setPhotoPhase("error");
        return;
      }

      setPhotoPreview(prepared.dataUrl);
      const response = await fetch("/api/extension/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          image_base64: prepared.dataUrl,
          style: "photoreal",
          locale: "ru",
        }),
      });
      const payload = (await response.json()) as {
        prompt?: string;
        message?: string;
        auth_required?: boolean;
      };

      if (!response.ok || !payload.prompt?.trim()) {
        setPhotoError(
          payload.message ||
            (payload.auth_required
              ? "Войдите в PromptShot и повторите анализ."
              : "Не удалось составить промт. Попробуйте другое фото.")
        );
        setPhotoPhase("error");
        return;
      }

      setPrompt(payload.prompt.trim());
      setPhotoPhase("ready");
      reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_READY);
    } catch {
      setPhotoError(
        "Не удалось обработать фото. Проверьте соединение и попробуйте снова."
      );
      setPhotoPhase("error");
    }
  };

  return (
    <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-indigo-100/90 bg-[linear-gradient(145deg,#f2f1ff_0%,#ffffff_48%,#faf7ff_100%)] text-left shadow-[0_30px_90px_-54px_rgba(79,70,229,0.5)] lg:mt-8 lg:rounded-[2rem]">
      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(7.5rem,0.85fr)] lg:grid-cols-[1.08fr_0.92fr] xl:min-h-[36rem] 2xl:min-h-[40rem]">
        <div className="flex flex-col justify-center p-4 lg:p-9">
          <p className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 lg:block">
            Онлайн-генератор
          </p>
          <h2 className="max-w-xl text-xl font-bold tracking-tight text-zinc-900 lg:mt-2 lg:text-3xl">
            Превратите идею в изображение
          </h2>
          <p className="mt-3 hidden max-w-xl text-sm leading-relaxed text-zinc-600 lg:block lg:text-base">
            Опишите будущий кадр своими словами или начните с готового
            промта — настройки модели, формата и качества откроются в
            генераторе.
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

          {mode === "text" ? (
            <form
              onSubmit={startGeneration}
              className="mt-2 rounded-2xl border border-indigo-100 bg-white p-2 shadow-sm transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100/70 lg:mt-3"
            >
              <label htmlFor="generation-starter-prompt" className="sr-only">
                Опишите будущий кадр
              </label>
              <textarea
                ref={promptInputRef}
                id="generation-starter-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Например: портрет девушки в мягком вечернем свете, объектив 85 мм…"
                rows={3}
                className="block h-16 w-full resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 lg:h-auto lg:text-base"
              />
              <div className="border-t border-zinc-100 pt-2">
                <button
                  type="submit"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-[#5b5cf0] to-violet-500 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-105 active:scale-[0.98]"
                >
                  Создать изображение
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
              </div>
            </form>
          ) : (
            <form
              onSubmit={startGeneration}
              className="mt-2 rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm lg:mt-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={analyzePhoto}
                className="sr-only"
                aria-label="Загрузить фото для составления промта"
              />

              {photoPreview ? (
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                    <Image
                      src={photoPreview}
                      alt="Загруженное фото"
                      fill
                      sizes="64px"
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900">
                      {photoPhase === "loading"
                        ? "Составляем промт…"
                        : photoPhase === "ready"
                          ? "Промт по фото готов"
                          : "Не удалось составить промт"}
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={photoPhase === "loading"}
                      className="mt-1 text-xs font-medium text-indigo-600 transition hover:text-indigo-800 disabled:opacity-50"
                    >
                      Выбрать другое фото
                    </button>
                  </div>
                  {photoPhase === "loading" ? (
                    <span
                      className="ml-auto h-5 w-5 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-500"
                      aria-label="Анализируем фото"
                    />
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoPhase === "loading"}
                  className="flex min-h-24 w-full flex-col items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 px-4 text-center transition hover:border-indigo-400 hover:bg-indigo-50 disabled:cursor-wait lg:min-h-28"
                >
                  {photoPhase === "loading" ? (
                    <span
                      className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-500"
                      aria-hidden
                    />
                  ) : (
                    <svg
                      className="h-5 w-5 text-indigo-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <path d="M12 16V4m0 0-4 4m4-4 4 4M5 20h14" />
                    </svg>
                  )}
                  <span className="mt-2 text-sm font-semibold text-zinc-900">
                    {photoPhase === "loading"
                      ? "Подготавливаем фото…"
                      : "Добавить фото"}
                  </span>
                  <span className="mt-1 text-xs text-zinc-500">
                    Получите промт и сразу используйте его для генерации
                  </span>
                </button>
              )}

              {photoPhase === "ready" ? (
                <>
                  <label
                    htmlFor="generation-photo-prompt"
                    className="mt-3 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    Готовый промт
                  </label>
                  <textarea
                    id="generation-photo-prompt"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    rows={4}
                    className="mt-1 block w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-relaxed text-zinc-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/70"
                  />
                  <button
                    type="submit"
                    disabled={!prompt.trim()}
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-[#5b5cf0] to-violet-500 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
                  >
                    Сгенерировать по этому промту
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
                </>
              ) : null}

              {photoError ? (
                <div
                  className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700"
                  role="status"
                >
                  {photoError}
                </div>
              ) : null}
            </form>
          )}

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

        <div className="relative min-h-full overflow-hidden border-l border-indigo-100/70 bg-indigo-100/50 lg:min-h-[25rem]">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.95),transparent_35%),radial-gradient(circle_at_80%_75%,rgba(167,139,250,0.3),transparent_42%)]"
            aria-hidden
          />
          <div className="relative h-full w-full">
            <div className="absolute inset-0 overflow-hidden bg-indigo-200">
              <CyclingPreviewImage
                images={frames}
                alt={
                  activePreview?.title?.trim() ||
                  "Пример генерации фото ИИ"
                }
                sizes="(max-width: 1023px) 40vw, 40vw"
                priority
                quality={75}
                containWithBackdrop
                coverOnMobile
                paused={Boolean(selectingCardId)}
                onFrameChange={setActivePreviewIndex}
              />
              <div className="absolute inset-0 z-10 bg-gradient-to-t from-indigo-950/35 via-transparent to-white/10 lg:from-indigo-950/55" />
            </div>
            {activePreview ? (
              <>
                <button
                  type="button"
                  aria-label={`Открыть карточку «${activePreview.title}»`}
                  onPointerEnter={() => prefetchCard(activePreview.slug)}
                  onClick={() =>
                    openCard(activePreview.slug, {
                      photoUrl: activePreview.photoUrl,
                      photoCount: activePreview.photoCount,
                      hasPrompts: activePreview.hasPrompt,
                    })
                  }
                  className="absolute inset-0 z-20 cursor-zoom-in focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white/80"
                />
                <button
                  type="button"
                  onClick={selectActivePrompt}
                  disabled={
                    !activePreview.hasPrompt || Boolean(selectingCardId)
                  }
                  className="absolute bottom-3 left-1/2 z-30 inline-flex min-h-9 max-w-[calc(100%-1rem)] -translate-x-1/2 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-white/30 bg-gradient-to-r from-indigo-500 via-[#5b5cf0] to-violet-500 px-3 text-xs font-semibold text-white shadow-md shadow-indigo-950/20 transition hover:brightness-105 active:scale-[0.98] disabled:cursor-wait disabled:opacity-75 lg:bottom-4 lg:min-h-11 lg:rounded-xl lg:px-5 lg:text-sm lg:shadow-lg"
                >
                  {selectingCardId === activePreview.id ? (
                    <span
                      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      aria-hidden
                    />
                  ) : null}
                  {selectingCardId === activePreview.id
                    ? "Загрузка…"
                    : selectErrorCardId === activePreview.id
                      ? "Повторить"
                      : "Выбрать"}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

    </div>
  );
}
