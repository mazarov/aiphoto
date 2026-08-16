"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { FotoVPromtGenerateButton } from "@/components/foto-v-promt/FotoVPromtGenerateButton";

type AnalysisItem = {
  id: string;
  created_at: string;
  kind: "analyze" | "remix";
  prompt: string;
  change_request: string | null;
  image_url: string | null;
};

export function AnalysesContent() {
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const [items, setItems] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isAuthed = Boolean(user && user.is_anonymous !== true);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try {
      const res = await fetch("/api/analyses?limit=30", {
        cache: "no-store",
        credentials: "include",
        signal,
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: AnalysisItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить анализы");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (loadError) {
      if (signal?.aborted) return;
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить анализы");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthed) {
      setLoading(false);
      setItems([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void load(controller.signal);
    return () => controller.abort();
  }, [authLoading, isAuthed, load]);

  const copyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      /* ignore */
    }
  };

  if (authLoading || !isAuthed) {
    return (
      <p className="text-zinc-500">
        <button
          type="button"
          onClick={() => openAuthModal()}
          className="font-medium text-indigo-600 hover:underline"
        >
          Войдите
        </button>
        , чтобы увидеть свои анализы.
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

  if (items.length === 0) {
    return (
      <p className="text-zinc-500">
        Пока нет сохранённых анализов. Разберите фото на{" "}
        <Link href="/foto-v-promt" className="font-medium text-indigo-600 hover:underline">
          /foto-v-promt
        </Link>{" "}
        после входа — результат появится здесь.
      </p>
    );
  }

  return (
    <ul className="mx-auto grid max-w-3xl list-none gap-4">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-inset ring-zinc-200">
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image_url} alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                {item.kind === "remix" ? "Remix" : "Нет фото"}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-medium uppercase tracking-wide text-zinc-500">
              {new Date(item.created_at).toLocaleString("ru-RU", {
                dateStyle: "short",
                timeStyle: "short",
              })}
              {item.kind === "remix" ? " · Remix" : ""}
            </p>
            <p className="mt-1 line-clamp-4 text-sm leading-snug text-zinc-800">{item.prompt}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyPrompt(item.prompt)}
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Копировать
              </button>
              <FotoVPromtGenerateButton
                promptText={item.prompt}
                variant="sm"
                label="Сгенерировать"
                entrySource="analyses"
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
