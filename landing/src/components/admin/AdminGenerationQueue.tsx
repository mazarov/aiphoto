"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminResultLightbox, AdminResultThumb } from "./AdminResultMedia";

type Item = {
  id: string; createdAt: string; completedAt: string | null; prompt: string; model: string | null;
  aspectRatio: string | null; resultUrl: string | null; cardUrl: string | null; publicationStatus: string;
};

export function AdminGenerationQueue({ status, refreshKey, onRegenerate }: {
  status: "unpublished" | "published"; refreshKey: number; onRegenerate: (prompt: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (next?: string) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ status, limit: "30" });
      if (next) params.set("cursor", next);
      const response = await fetch(`/api/admin/generations?${params}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Не удалось загрузить очередь");
      setItems((current) => next ? [...current, ...body.items] : body.items);
      setCursor(body.nextCursor || null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Ошибка сети"); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  const publish = async (id: string) => {
    setBusy(id); setError("");
    try {
      const response = await fetch(`/api/admin/generations/${id}/publish`, { method: "POST", credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || body.error || "Ошибка публикации");
      setItems((current) => status === "unpublished" ? current.filter((item) => item.id !== id)
        : current.map((item) => item.id === id ? { ...item, publicationStatus: "published", cardUrl: body.cardUrl } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Ошибка публикации"); }
    finally { setBusy(null); }
  };
  if (loading && !items.length) return <p className="text-sm text-zinc-500">Загрузка…</p>;
  if (!items.length) return <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">{error || "Список пуст"}</div>;
  return <div className="space-y-3">
    {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {items.map((item) => <article key={item.id} className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <button onClick={() => item.resultUrl && setLightbox(item.resultUrl)}
        className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
        {item.resultUrl && <AdminResultThumb url={item.resultUrl} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${item.publicationStatus === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {item.publicationStatus}
          </span>
          <span>{new Date(item.completedAt || item.createdAt).toLocaleString()}</span>
          <span>{item.model} · {item.aspectRatio}</span>
        </div>
        <button onClick={() => setPrompt(item.prompt)} className="mt-1 line-clamp-2 text-left text-sm text-zinc-800">{item.prompt}</button>
        <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
          <button onClick={() => navigator.clipboard.writeText(item.prompt)} className="text-indigo-600">Копировать</button>
          <button onClick={() => onRegenerate(item.prompt)} className="text-violet-600">Повторить</button>
          {item.publicationStatus !== "published" && <button disabled={Boolean(busy)} onClick={() => void publish(item.id)} className="text-amber-700 disabled:opacity-40">
            {busy === item.id ? "Публикация…" : "Опубликовать"}
          </button>}
          {item.cardUrl && <a href={item.cardUrl} target="_blank" rel="noreferrer" className="text-sky-600">Открыть карточку</a>}
        </div>
      </div>
    </article>)}
    {cursor && <button disabled={loading} onClick={() => void load(cursor)}
      className="mx-auto block rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700">Показать ещё</button>}
    {lightbox && <AdminResultLightbox url={lightbox} onClose={() => setLightbox(null)} />}
    {prompt && <div onClick={() => setPrompt(null)} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div onClick={(event) => event.stopPropagation()} className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="font-semibold">Полный промпт</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{prompt}</p>
      </div>
    </div>}
  </div>;
}
