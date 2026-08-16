"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ListingGrid } from "@/components/ListingGrid";
import {
  AnalysisHistoryCard,
  type AnalysisHistoryItem,
} from "@/components/AnalysisHistoryCard";

export function AnalysesContent() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<AnalysisHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
      const res = await fetch("/api/analyses?limit=50", {
        cache: "no-store",
        credentials: "include",
        signal,
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: AnalysisHistoryItem[];
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
    if (!user) {
      setLoading(false);
      setItems([]);
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

  if (authLoading || !user) {
    return (
      <p className="text-zinc-500">
        <Link href="/" className="text-indigo-600 hover:underline">
          Войдите
        </Link>
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
        У вас пока нет анализов. Разберите фото на{" "}
        <Link href="/foto-v-promt" className="text-indigo-600 hover:underline">
          «Фото в промт»
        </Link>{" "}
        после входа — результат появится здесь.
      </p>
    );
  }

  return (
    <div>
      <ListingGrid>
        {items.map((item) => (
          <AnalysisHistoryCard key={item.id} item={item} onToast={showToast} />
        ))}
      </ListingGrid>

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
