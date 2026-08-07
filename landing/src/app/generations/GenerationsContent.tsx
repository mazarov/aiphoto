"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ListingGrid } from "@/components/ListingGrid";
import {
  GenerationHistoryCard,
  type GenerationHistoryItem,
} from "@/components/GenerationHistoryCard";

export function GenerationsContent() {
  const { user, loading: authLoading } = useAuth();
  const [generations, setGenerations] = useState<GenerationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try {
      const res = await fetch("/api/generations?limit=50", {
        cache: "no-store",
        credentials: "include",
        signal,
      });
      const data = (await res.json().catch(() => ({}))) as {
        generations?: GenerationHistoryItem[];
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

  useEffect(() => {
    if (!selectMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectMode(false);
        setSelectedIds(new Set());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectMode]);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const enterSelectMode = (id: string) => {
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleted = (id: string) => {
    setGenerations((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0 || bulkDeleting) return;
    if (!window.confirm(`Удалить выбранные генерации (${ids.length})?`)) return;

    setBulkDeleting(true);
    try {
      const res = await fetch("/api/generations", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        deleted?: number;
      };
      if (!res.ok) throw new Error(data.error || "Delete failed");

      const idSet = new Set(ids);
      setGenerations((prev) => prev.filter((item) => !idSet.has(item.id)));
      exitSelectMode();
      showToast(
        data.deleted && data.deleted > 0
          ? `Удалено: ${data.deleted}`
          : "Удалено"
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Не удалось удалить");
    } finally {
      setBulkDeleting(false);
    }
  };

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

  const selectedCount = selectedIds.size;

  return (
    <>
      <ListingGrid className={selectMode ? "pb-24" : undefined}>
        {generations.map((generation) => (
          <GenerationHistoryCard
            key={generation.id}
            generation={generation}
            selectMode={selectMode}
            selected={selectedIds.has(generation.id)}
            onEnterSelectMode={enterSelectMode}
            onToggleSelect={toggleSelect}
            onDeleted={handleDeleted}
            onToast={showToast}
          />
        ))}
      </ListingGrid>

      {selectMode ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl bg-zinc-950/95 p-2 shadow-2xl ring-1 ring-white/10 backdrop-blur-md">
            <button
              type="button"
              disabled={selectedCount === 0 || bulkDeleting}
              onClick={() => void handleBulkDelete()}
              className="min-h-11 flex-1 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkDeleting ? "Удаляем…" : `Удалить (${selectedCount})`}
            </button>
            <button
              type="button"
              disabled={bulkDeleting}
              onClick={exitSelectMode}
              className="min-h-11 rounded-xl bg-zinc-800 px-4 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
