"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

type Generation = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  prompt: string;
  model: string;
  aspectRatio: string;
  creditsSpent: number;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  resultUrl: string | null;
};

const STATUS_LABELS: Record<Generation["status"], string> = {
  pending: "В очереди",
  processing: "Генерируется",
  completed: "Готово",
  failed: "Ошибка",
};

const STATUS_CLASSES: Record<Generation["status"], string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  processing: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function GenerationsContent() {
  const { user, loading: authLoading } = useAuth();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try {
      const res = await fetch("/api/generations?limit=50", {
        cache: "no-store",
        credentials: "include",
        signal,
      });
      const data = (await res.json().catch(() => ({}))) as {
        generations?: Generation[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить генерации");
      setGenerations(Array.isArray(data.generations) ? data.generations : []);
    } catch (loadError) {
      if (signal?.aborted) return;
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить генерации");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setGenerations([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    void load(controller.signal);

    const refreshOnFocus = () => void load();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [authLoading, load, user]);

  useEffect(() => {
    const hasActiveGeneration = generations.some(
      (generation) => generation.status === "pending" || generation.status === "processing"
    );
    if (!user || !hasActiveGeneration) return;

    const timer = window.setInterval(() => {
      void load();
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [generations, load, user]);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  if (authLoading || !user) {
    return (
      <p className="text-zinc-500">
        <Link href="/" className="text-indigo-600 hover:underline">
          Войдите
        </Link>
        , чтобы увидеть свои генерации.
      </p>
    );
  }

  if (loading) {
    return <div className="animate-pulse text-zinc-500">Загрузка...</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <p className="text-sm text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="mt-3 min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <p className="text-zinc-500">
        У вас пока нет генераций. Откройте промт в каталоге и нажмите «Сгенерировать» — результат
        появится здесь.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {generations.map((generation) => (
        <article
          key={generation.id}
          className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
        >
          <div className="flex aspect-square items-center justify-center bg-zinc-100">
            {generation.resultUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={generation.resultUrl}
                alt="Результат генерации"
                className="h-full w-full object-contain"
              />
            ) : generation.status === "failed" ? (
              <span className="px-4 text-center text-sm text-rose-600">
                Генерация не завершена
              </span>
            ) : (
              <span className="animate-pulse px-4 text-center text-sm text-zinc-500">
                {STATUS_LABELS[generation.status]}…
              </span>
            )}
          </div>

          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_CLASSES[generation.status]}`}
              >
                {STATUS_LABELS[generation.status]}
              </span>
              <time className="text-xs text-zinc-500" dateTime={generation.createdAt}>
                {formatDate(generation.createdAt)}
              </time>
            </div>

            <p className="line-clamp-3 text-sm leading-relaxed text-zinc-700">
              {generation.prompt}
            </p>

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
              <span>{generation.model}</span>
              <span>{generation.aspectRatio}</span>
              <span>{generation.creditsSpent} баллов</span>
            </div>

            {generation.status === "failed" && generation.errorMessage && (
              <p className="line-clamp-3 text-xs text-rose-600">
                {generation.errorMessage}
              </p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
