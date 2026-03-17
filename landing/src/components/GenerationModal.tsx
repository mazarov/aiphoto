"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useGeneration } from "@/context/GenerationContext";
import { PhotoUploader, type PhotoFile } from "./PhotoUploader";

type GenerationConfig = {
  models: { id: string; label: string; cost: number }[];
  aspectRatios: { value: string; label: string }[];
  imageSizes: { value: string; label: string }[];
  defaults: { model: string; aspectRatio: string; imageSize: string };
  limits: { maxPhotos: number; maxFileSizeMb: number; minPromptLength: number };
};

type ModalState = "form" | "processing" | "completed" | "failed";

export function GenerationModal() {
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const generation = useGeneration();
  const isOpen = generation?.isOpen ?? false;
  const closeGenerationModal = generation?.closeGenerationModal ?? (() => {});
  const initialCardId = generation?.initialCardId ?? null;
  const initialPrompt = generation?.initialPrompt ?? null;

  const [config, setConfig] = useState<GenerationConfig | null>(null);
  const [credits, setCredits] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [aspectRatio, setAspectRatio] = useState("");
  const [imageSize, setImageSize] = useState("");
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [state, setState] = useState<ModalState>("form");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const fetchConfig = useCallback(async () => {
    const res = await fetch("/api/generation-config");
    const data = await res.json();
    setConfig(data);
    setModel(data.defaults?.model || "gemini-2.5-flash-image");
    setAspectRatio(data.defaults?.aspectRatio || "1:1");
    setImageSize(data.defaults?.imageSize || "1K");
  }, []);

  const fetchCredits = useCallback(async () => {
    const res = await fetch("/api/me", { credentials: "include" });
    const data = await res.json();
    setCredits(data.credits ?? 0);
  }, []);

  const fetchPrompt = useCallback(async (cardId: string) => {
    const res = await fetch(`/api/generation-prompt?cardId=${encodeURIComponent(cardId)}`);
    const data = await res.json();
    if (data.promptEn) setPrompt(data.promptEn);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      fetchCredits();
      setPrompt(initialPrompt || "");
      if (initialCardId && !initialPrompt) {
        fetchPrompt(initialCardId);
      }
      setState("form");
      setGenerationId(null);
      setResultUrl(null);
      setErrorMessage(null);
      setFormError(null);
      setPhotos([]);
      setProgress(0);
    }
  }, [isOpen, initialCardId, initialPrompt, fetchConfig, fetchCredits, fetchPrompt]);

  const pollGeneration = useCallback(async (id: string) => {
    const res = await fetch(`/api/generations/${id}`, { credentials: "include" });
    const data = await res.json();
    setProgress(data.progress ?? 0);

    if (data.status === "completed") {
      setResultUrl(data.resultUrl);
      setState("completed");
      fetchCredits();
    } else if (data.status === "failed") {
      setErrorMessage(data.errorMessage || "Произошла ошибка");
      setState("failed");
      fetchCredits();
    }
  }, [fetchCredits]);

  useEffect(() => {
    if (state !== "processing" || !generationId) return;

    const interval = setInterval(() => pollGeneration(generationId), 2500);
    pollGeneration(generationId);

    return () => clearInterval(interval);
  }, [state, generationId, pollGeneration]);

  const handleGenerate = async () => {
    if (!user) {
      openAuthModal();
      return;
    }

    const storagePaths = photos
      .filter((p) => p.storagePath && !p.uploading && !p.error)
      .map((p) => p.storagePath!);

    if (storagePaths.length < 1) {
      setFormError("Добавьте хотя бы одно фото");
      return;
    }
    if (prompt.trim().length < (config?.limits.minPromptLength ?? 8)) {
      setFormError(`Промпт должен быть минимум ${config?.limits.minPromptLength ?? 8} символов`);
      return;
    }
    if (credits < (config?.models.find((m) => m.id === model)?.cost ?? 1)) {
      setFormError("Нет кредитов");
      return;
    }

    setFormError(null);

    setState("processing");
    setProgress(10);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          aspectRatio,
          imageSize,
          cardId: initialCardId || null,
          photoStoragePaths: storagePaths,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "unauthorized") {
          openAuthModal();
        } else {
          setErrorMessage(data.message || data.error || "Ошибка");
          setState("failed");
        }
        return;
      }

      setGenerationId(data.id);
    } catch {
      setErrorMessage("Ошибка сети");
      setState("failed");
    }
  };

  const handleReset = () => {
    setState("form");
    setGenerationId(null);
    setResultUrl(null);
    setErrorMessage(null);
    setFormError(null);
    setProgress(0);
  };

  if (!isOpen) return null;

  const canGenerate =
    user &&
    photos.some((p) => p.storagePath && !p.uploading && !p.error) &&
    prompt.trim().length >= (config?.limits.minPromptLength ?? 8) &&
    state === "form";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={state === "form" ? closeGenerationModal : undefined}
      />

      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Генерация фото</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600">Баланс: {credits}</span>
            <button
              type="button"
              onClick={closeGenerationModal}
              className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {state === "form" && config && (
          <div className="space-y-2">
            {!user && (
              <p className="text-sm text-amber-600">Войдите, чтобы генерировать</p>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Нейросеть</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900"
              >
                {config.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.cost} кр.)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Формат</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900"
                >
                  {config.aspectRatios.map((ar) => (
                    <option key={ar.value} value={ar.value}>
                      {ar.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Качество</label>
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900"
                >
                  {config.imageSizes.map((sz) => (
                    <option key={sz.value} value={sz.value}>
                      {sz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Фото</label>
              <PhotoUploader
                photos={photos}
                onPhotosChange={setPhotos}
                maxPhotos={config.limits.maxPhotos}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Промпт</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Опишите изображение..."
                rows={4}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Промпт должен быть минимум {config.limits.minPromptLength} символов
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>🚀</span>
              Создать фото
            </button>
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
          </div>
        )}

        {state === "processing" && (
          <div className="space-y-4">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-sm text-zinc-600">
              {progress < 30 ? "Подготовка..." : progress < 90 ? "Генерация изображения..." : "Сохранение..."}
            </p>
          </div>
        )}

        {state === "completed" && resultUrl && (
          <div className="space-y-4">
            <img
              src={resultUrl}
              alt=""
              className="w-full rounded-xl border border-zinc-200 object-cover"
            />
            <div className="flex gap-2">
              <a
                href={resultUrl}
                download="generated.png"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Скачать
              </a>
              <button
                type="button"
                onClick={handleReset}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Сгенерировать ещё
              </button>
            </div>
          </div>
        )}

        {state === "failed" && (
          <div className="space-y-4">
            <p className="text-center text-sm text-red-600">{errorMessage}</p>
            <p className="text-center text-xs text-zinc-500">Кредит возвращён на баланс</p>
            <button
              type="button"
              onClick={handleReset}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Попробовать снова
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
