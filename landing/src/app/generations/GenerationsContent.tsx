"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ListingGrid } from "@/components/ListingGrid";
import {
  GenerationHistoryCard,
  type GenerationHistoryItem,
} from "@/components/GenerationHistoryCard";
import { VIDEO_GENERATION_MODALITY } from "@/lib/generation/image-options";
import {
  GENERATIONS_PAGE_SIZE,
  mergeGenerationFirstPage,
} from "@/lib/generations-list";
import { isPhotoshootEditKind } from "@/lib/photoshoot";
import { useListingSentinelLoadMore } from "@/hooks/useListingSentinelLoadMore";
import {
  readCachedVideoAnimateEnabled,
  writeCachedVideoAnimateEnabled,
} from "@/lib/video-animate-availability";
import { usePublishReward } from "@/lib/use-publish-reward";

type GenerationsContentProps = {
  /** Bump to force-reload list (e.g. after blank generate completes). */
  refreshToken?: number;
  /** Extra bottom padding for floating composer dock on /generate. */
  className?: string;
};

export function GenerationsContent({
  refreshToken = 0,
  className,
}: GenerationsContentProps = {}) {
  const { user, loading: authLoading } = useAuth();
  const [generations, setGenerations] = useState<GenerationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const generationsRef = useRef<GenerationHistoryItem[]>([]);
  const hasMoreRef = useRef(false);
  const loadingRef = useRef(true);
  const loadingMoreRef = useRef(false);
  generationsRef.current = generations;
  hasMoreRef.current = hasMore;
  loadingRef.current = loading;
  loadingMoreRef.current = loadingMore;
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [toast, setToast] = useState("");
  const [videoEnabled, setVideoEnabled] = useState(
    () => readCachedVideoAnimateEnabled() === true
  );
  const publishReward = usePublishReward();

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const fetchPage = useCallback(async (offset: number, signal?: AbortSignal) => {
    const res = await fetch(
      `/api/generations?limit=${GENERATIONS_PAGE_SIZE}&offset=${offset}`,
      { cache: "no-store", credentials: "include", signal },
    );
    const data = (await res.json().catch(() => ({}))) as {
      generations?: GenerationHistoryItem[];
      hasMore?: boolean;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error || "Не удалось загрузить генерации");
    return {
      generations: Array.isArray(data.generations) ? data.generations : [],
      hasMore: Boolean(data.hasMore),
    };
  }, []);

  const loadFirstPage = useCallback(async (input?: { signal?: AbortSignal; replace?: boolean }) => {
    const signal = input?.signal;
    const replace = input?.replace === true;
    setError("");
    try {
      const page = await fetchPage(0, signal);
      if (signal?.aborted) return;
      setGenerations((prev) =>
        replace || prev.length === 0
          ? page.generations
          : mergeGenerationFirstPage(prev, page.generations),
      );
      if (replace || page.generations.length < GENERATIONS_PAGE_SIZE) {
        setHasMore(page.hasMore);
      } else if (page.hasMore) {
        setHasMore(true);
      }
    } catch (loadError) {
      if (signal?.aborted) return;
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить генерации");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || loadingMoreRef.current || !hasMoreRef.current) return;
    setLoadingMore(true);
    loadingMoreRef.current = true;
    try {
      const page = await fetchPage(generationsRef.current.length);
      setGenerations((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...page.generations.filter((item) => !seen.has(item.id))];
      });
      setHasMore(page.hasMore);
    } catch {
      setHasMore(true);
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [fetchPage]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setGenerations([]);
      setHasMore(false);
      writeCachedVideoAnimateEnabled(false);
      setVideoEnabled(false);
      return;
    }

    const controller = new AbortController();
    void fetch(`/api/generation-config?modality=${VIDEO_GENERATION_MODALITY}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { enabled?: boolean };
        if (res.ok) {
          const enabled = Boolean(data.enabled);
          writeCachedVideoAnimateEnabled(enabled);
          setVideoEnabled(enabled);
        }
      })
      .catch(() => {
        /* keep default false */
      });
    return () => controller.abort();
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setGenerations([]);
      setHasMore(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setHasMore(false);
    void loadFirstPage({ signal: controller.signal, replace: true });

    const refreshOnFocus = () => void loadFirstPage();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [authLoading, loadFirstPage, refreshToken, user]);

  useEffect(() => {
    const hasActiveGeneration = generations.some((generation) => {
      if (generation.status === "pending" || generation.status === "processing") return true;
      if (generation.status !== "completed") return false;
      if (!isPhotoshootEditKind(generation.editKind)) return false;
      const tilesReady = generation.photoshootTileUrls?.length === 4;
      return !generation.resultUrl && !tilesReady;
    });
    if (!user || !hasActiveGeneration) return;

    const timer = window.setInterval(() => {
      void loadFirstPage();
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [generations, loadFirstPage, user]);

  const { sentinelRef, scheduleDrain } = useListingSentinelLoadMore(
    () => {
      void loadMore();
    },
    () => loadingRef.current || loadingMoreRef.current,
    () => hasMoreRef.current,
  );

  useEffect(() => {
    if (loading) return;
    scheduleDrain();
  }, [generations.length, hasMore, loading, scheduleDrain]);

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

  const handleCardMetadataUpdated = (
    id: string,
    metadata: Pick<GenerationHistoryItem, "cardId" | "cardSlug" | "isPublished">
  ) => {
    setGenerations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...metadata } : item))
    );
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
      <div className={className}>
        <p className="text-zinc-500">
          <Link href="/" className="text-indigo-600 hover:underline">
            Войдите
          </Link>
          , чтобы увидеть свои генерации.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`animate-pulse text-zinc-500${className ? ` ${className}` : ""}`}>
        Загрузка...
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadFirstPage({ replace: true });
            }}
            className="mt-3 min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <div className={className}>
        <p className="text-zinc-500">
          У вас пока нет генераций. Опишите изображение ниже и нажмите «Сгенерировать» — результат
          появится здесь.
        </p>
      </div>
    );
  }

  const selectedCount = selectedIds.size;

  return (
    <div className={className}>
      <ListingGrid clamp={hasMore} className={selectMode ? "pb-24" : undefined}>
        {generations.map((generation) => (
          <GenerationHistoryCard
            key={generation.id}
            generation={generation}
            selectMode={selectMode}
            selected={selectedIds.has(generation.id)}
            videoEnabled={videoEnabled}
            publishReward={publishReward.config}
            publishRewardRemaining={publishReward.remainingToday}
            onEnterSelectMode={enterSelectMode}
            onToggleSelect={toggleSelect}
            onDeleted={handleDeleted}
            onCardMetadataUpdated={handleCardMetadataUpdated}
            onToast={showToast}
          />
        ))}
      </ListingGrid>
      <div ref={sentinelRef} className="h-px w-full" aria-hidden />
      {loadingMore ? (
        <p className="mt-4 text-center text-[13px] text-zinc-500">Загружаем ещё…</p>
      ) : null}

      {selectMode ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:left-72">
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
    </div>
  );
}
