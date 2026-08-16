"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AdminGenerateModal } from "./AdminGenerateModal";
import { AdminGenerationQueue } from "./AdminGenerationQueue";
import { AdminUserGenerationsList } from "./AdminUserGenerationsList";
import { CLIENT_SOURCES_ORDER, clientSourceColor, clientSourceLabel } from "./analytics-constants";

type Item = {
  id: string;
  created_at: string;
  kind: "analyze" | "remix";
  client_source: string;
  user_email?: string | null;
  user_display_name?: string | null;
  prompt: string;
  change_request: string | null;
  image_url: string | null;
  style: string | null;
  model: string | null;
  is_published: boolean;
  card_url: string | null;
  credits_spent?: number;
  quota_mode?: string | null;
};
type View = "analyses" | "user_generations" | "unpublished" | "published";
const tabClass = (active: boolean) => `rounded-xl px-3 py-2 text-xs font-semibold ${
  active ? "bg-indigo-600 text-white" : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"}`;

export function AnalyzeHistoryList() {
  const { user, openAuthModal } = useAuth();
  const [view, setView] = useState<View>("analyses");
  const [source, setSource] = useState("all");
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(0);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [fullPrompt, setFullPrompt] = useState<string | null>(null);
  const [generatePrompt, setGeneratePrompt] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [queueRefresh, setQueueRefresh] = useState(0);

  const load = useCallback(async (next?: string) => {
    setLoading(true); setError(""); setStatus(0);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (source !== "all") params.set("client_source", source);
      if (next) params.set("cursor", next);
      const response = await fetch(`/api/admin/analyze-history?${params}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(response.status); throw new Error(body.error || "Не удалось загрузить историю");
      }
      setItems((current) => next ? [...current, ...body.items] : body.items);
      setCursor(body.next_cursor || null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Ошибка сети"); }
    finally { setLoading(false); }
  }, [source]);
  useEffect(() => { if (view === "analyses") void load(); }, [load, user, view]);

  const publish = async (id: string) => {
    setPublishing(id); setError("");
    try {
      const response = await fetch(`/api/admin/analyze-history/${id}/publish`, { method: "POST", credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || body.error || "Ошибка публикации");
      setItems((current) => current.map((item) => item.id === id
        ? { ...item, is_published: true, card_url: body.cardUrl } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Ошибка публикации"); }
    finally { setPublishing(null); }
  };

  if (status === 401 || status === 403) return <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
    <h1 className="text-xl font-semibold">{status === 401 ? "Нужен вход" : "Доступ запрещён"}</h1>
    <p className="mt-2 text-sm text-zinc-500">{status === 401 ? "Войдите через PromptShot." : "Ваш email не включён в allowlist."}</p>
    {status === 401 && <button onClick={() => openAuthModal()} className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white">Войти</button>}
  </div>;

  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-medium text-indigo-600">PromptShot Admin</p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">История и публикации</h1>
        <p className="mt-1 text-sm text-zinc-500">Анализы, генерации и карточки</p></div>
      <Link href="/admin/analytics" className="text-sm font-semibold text-indigo-600">← Аналитика</Link>
    </header>
    <nav className="flex flex-wrap gap-2">
      <button className={tabClass(view === "analyses")} onClick={() => setView("analyses")}>Анализы</button>
      <button className={tabClass(view === "user_generations")} onClick={() => setView("user_generations")}>
        Генерации других пользователей
      </button>
      <button className={tabClass(view === "unpublished")} onClick={() => setView("unpublished")}>Не опубликовано</button>
      <button className={tabClass(view === "published")} onClick={() => setView("published")}>Опубликовано</button>
    </nav>
    {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {view === "user_generations" ? <AdminUserGenerationsList onRegenerate={setGeneratePrompt} />
      : view !== "analyses" ? <AdminGenerationQueue status={view} refreshKey={queueRefresh}
      onRegenerate={setGeneratePrompt} /> : <>
      <div className="flex flex-wrap gap-2">
        {["all", ...CLIENT_SOURCES_ORDER].map((item) => <button key={item} onClick={() => setSource(item)}
          className={tabClass(source === item)}>{item === "all" ? "Все" : clientSourceLabel(item)}</button>)}
      </div>
      {loading && !items.length ? <p className="text-sm text-zinc-500">Загрузка…</p> : !items.length
        ? <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">История пуста</div>
        : <div className="space-y-3">{items.map((item) => <article key={item.id}
          className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <button onClick={() => item.image_url && setLightbox(item.image_url)}
            className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
            {item.image_url && <img src={item.image_url} alt="" className="h-full w-full object-cover" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
              <span className="rounded-full px-2 py-0.5 font-semibold text-white"
                style={{ background: clientSourceColor(item.client_source) }}>{clientSourceLabel(item.client_source)}</span>
              {item.kind === "remix" && (
                <span className="rounded-full bg-violet-600 px-2 py-0.5 font-semibold text-white">Remix</span>
              )}
              {Number(item.credits_spent) > 0 && (
                <span className="rounded-full bg-amber-600 px-2 py-0.5 font-semibold text-white">
                  {item.credits_spent} токен
                </span>
              )}
              <span>{new Date(item.created_at).toLocaleString()}</span>
              {item.model && <span>{item.model}</span>}
            </div>
            {(item.user_email || item.user_display_name) && (
              <p className="mt-1 text-xs text-zinc-500">
                <span className="font-semibold text-zinc-700">
                  {item.user_email || item.user_display_name}
                </span>
              </p>
            )}
            {item.kind === "remix" && item.change_request && (
              <p className="mt-1 line-clamp-2 text-xs leading-4 text-violet-700">
                <span className="font-semibold">Что изменить:</span> {item.change_request}
              </p>
            )}
            <button onClick={() => setFullPrompt(item.prompt)} className="mt-1 line-clamp-2 text-left text-sm leading-5 text-zinc-800">{item.prompt}</button>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
              <button onClick={() => navigator.clipboard.writeText(item.prompt)} className="text-indigo-600">Копировать</button>
              <button onClick={() => setGeneratePrompt(item.prompt)} className="text-violet-600">Сгенерировать</button>
              {!item.is_published ? <button disabled={Boolean(publishing) || !item.image_url}
                onClick={() => void publish(item.id)} className="text-amber-700 disabled:opacity-40">
                {publishing === item.id ? "Публикация…" : "Опубликовать"}
              </button> : <span className="text-emerald-600">Опубликовано</span>}
              {item.card_url && <a href={item.card_url} target="_blank" rel="noreferrer" className="text-sky-600">Открыть карточку</a>}
            </div>
          </div>
        </article>)}</div>}
      {cursor && <button disabled={loading} onClick={() => void load(cursor)}
        className="mx-auto block rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold">Показать ещё</button>}
    </>}
    {generatePrompt && <AdminGenerateModal initialPrompt={generatePrompt} onClose={() => setGeneratePrompt(null)}
      onCompleted={() => setQueueRefresh((value) => value + 1)} />}
    {lightbox && <div onClick={() => setLightbox(null)} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4">
      <img src={lightbox} alt="" onClick={(event) => event.stopPropagation()} className="max-h-[90vh] max-w-full rounded-2xl object-contain" />
    </div>}
    {fullPrompt && <div onClick={() => setFullPrompt(null)} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div onClick={(event) => event.stopPropagation()} className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="font-semibold">Полный промпт</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{fullPrompt}</p>
        <button onClick={() => navigator.clipboard.writeText(fullPrompt)} className="mt-4 text-sm font-semibold text-indigo-600">Копировать</button>
      </div>
    </div>}
  </div>;
}
