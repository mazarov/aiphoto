"use client";

import { useCallback, useEffect, useState } from "react";
import {
  providerImageModeBadgeClass,
  providerImageModeLabel,
  type ProviderImageMode,
} from "@/lib/provider-image-mode";
import { AdminResultLightbox, AdminResultThumb } from "./AdminResultMedia";
import {
  adminDenseActionsClass,
  adminDenseBadgeClass,
  adminDenseFilterClass,
  adminDenseListClass,
  adminDenseMetaClass,
  adminDensePromptClass,
  adminDenseRowClass,
  adminDenseThumbClass,
  formatAdminRowWhen,
} from "./admin-dense-row";
import { CLIENT_SOURCES_ORDER, clientSourceColor, clientSourceLabel } from "./analytics-constants";

type Status = "pending" | "processing" | "completed" | "failed";
type PublicationStatus = "unpublished" | "published" | "card_pending" | "card_missing";
type Item = {
  id: string;
  createdAt: string;
  completedAt: string | null;
  status: Status;
  prompt: string;
  model: string | null;
  requestedModel?: string | null;
  executedModel?: string | null;
  fallbackUsed?: boolean;
  providerImageMode?: ProviderImageMode | null;
  editKind?: string | null;
  sceneRootId?: string | null;
  cameraPose?: { azimuthDeg?: number; elevationDeg?: number; distanceRel?: number } | null;
  aspectRatio: string | null;
  imageSize: string | null;
  creditsSpent: number;
  creditsRefunded: boolean;
  creditsRemaining: number | null;
  errorType: string | null;
  errorMessage: string | null;
  clientSource: string;
  requesterAuthUserId: string | null;
  userId: string;
  identityMismatch: boolean;
  userEmail: string | null;
  userDisplayName: string | null;
  userProvider: string | null;
  sourcePhotoUrls: string[];
  resultUrl: string | null;
  cardUrl: string | null;
  publicationStatus: PublicationStatus;
  canPublish: boolean;
};

const STATUS_OPTIONS = [
  ["all", "Все статусы"],
  ["pending", "В очереди"],
  ["processing", "В работе"],
  ["completed", "Готово"],
  ["failed", "Ошибка"],
] as const;
const PUBLICATION_OPTIONS = [
  ["all", "Все публикации"],
  ["unpublished", "Не опубликовано"],
  ["published", "Опубликовано"],
] as const;
const statusClass: Record<Status, string> = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};
const shortId = (value: string) => `${value.slice(0, 8)}…`;

export function AdminUserGenerationsList({
  onRegenerate,
}: {
  onRegenerate: (prompt: string) => void;
}) {
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [publication, setPublication] = useState("all");
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [fullPrompt, setFullPrompt] = useState<string | null>(null);

  const load = useCallback(async (next?: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        status,
        publication,
        client_source: source,
        limit: "30",
      });
      if (next) params.set("cursor", next);
      const response = await fetch(`/api/admin/user-generations?${params}`, {
        credentials: "include",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Не удалось загрузить генерации");
      setItems((current) => next ? [...current, ...body.items] : body.items);
      setCursor(body.nextCursor || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [publication, source, status]);

  useEffect(() => { void load(); }, [load]);

  const publish = async (id: string) => {
    setBusy(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/user-generations/${id}/publish`, {
        method: "POST",
        credentials: "include",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = body.error === "generation_author_missing"
          ? "У legacy-генерации отсутствует auth-автор"
          : body.error || "Ошибка публикации";
        throw new Error(message);
      }
      setItems((current) => current.map((item) => item.id === id
        ? { ...item, publicationStatus: "published", cardUrl: body.cardUrl }
        : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ошибка публикации");
    } finally {
      setBusy(null);
    }
  };

  return <div className="space-y-3 sm:space-y-4">
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-2.5 sm:gap-3 sm:rounded-2xl sm:p-4 sm:shadow-sm">
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {STATUS_OPTIONS.map(([value, label]) => <button key={value}
          className={adminDenseFilterClass(status === value)} onClick={() => setStatus(value)}>
          {label}
        </button>)}
      </div>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {PUBLICATION_OPTIONS.map(([value, label]) => <button key={value}
          className={adminDenseFilterClass(publication === value)} onClick={() => setPublication(value)}>
          {label}
        </button>)}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {["all", ...CLIENT_SOURCES_ORDER.filter((item) => item !== "admin")].map((value) =>
          <button key={value} className={adminDenseFilterClass(source === value)} onClick={() => setSource(value)}>
            {value === "all" ? "Все клиенты" : clientSourceLabel(value)}
          </button>)}
        <button disabled={loading} onClick={() => void load()}
          className="ml-auto rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-600 disabled:opacity-50 sm:rounded-xl sm:px-3 sm:py-2">
          Обновить
        </button>
      </div>
    </div>

    {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading && !items.length ? <p className="text-sm text-zinc-500">Загрузка…</p>
      : !items.length ? <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
        Генераций нет
      </div>
      : <div className={adminDenseListClass}>{items.map((item) => <article key={item.id}
        className={adminDenseRowClass}>
        <div className="relative flex shrink-0 gap-1.5 sm:gap-2">
          <button disabled={!item.resultUrl} onClick={() => item.resultUrl && setLightbox(item.resultUrl)}
            className={`${adminDenseThumbClass} disabled:cursor-default`}>
            {item.resultUrl
              ? <AdminResultThumb url={item.resultUrl} alt="Результат генерации" />
              : <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-zinc-400 sm:px-2 sm:text-xs">Нет</span>}
          </button>
          {item.sourcePhotoUrls[0] ? (
            <button
              type="button"
              onClick={() => setLightbox(item.sourcePhotoUrls[0])}
              className="absolute bottom-0.5 right-0.5 h-5 w-5 overflow-hidden rounded border border-white bg-zinc-100 sm:hidden"
              aria-label="Исходное фото"
            >
              <img src={item.sourcePhotoUrls[0]} alt="" className="h-full w-full object-cover" />
            </button>
          ) : null}
          {item.sourcePhotoUrls[0] && <button onClick={() => setLightbox(item.sourcePhotoUrls[0])}
            className={`${adminDenseThumbClass} hidden border border-zinc-200 sm:block`}>
            <img src={item.sourcePhotoUrls[0]} alt="Исходное фото" className="h-full w-full object-cover" />
          </button>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:gap-0">
          <div className={adminDenseMetaClass}>
            <span className={`${adminDenseBadgeClass} ${statusClass[item.status]}`}>
              {item.status}
            </span>
            {item.providerImageMode && (
              <span className={`${adminDenseBadgeClass} ${providerImageModeBadgeClass(item.providerImageMode)}`}>
                {providerImageModeLabel(item.providerImageMode)}
              </span>
            )}
            {item.editKind === "camera_orbit" && (
              <span className={`${adminDenseBadgeClass} bg-sky-100 text-sky-800`}>
                Камера
              </span>
            )}
            <span className={`${adminDenseBadgeClass} text-white`}
              style={{ background: clientSourceColor(item.clientSource) }}>
              {clientSourceLabel(item.clientSource)}
            </span>
            <span>{formatAdminRowWhen(item.completedAt || item.createdAt)}</span>
            <span className="hidden max-w-[16rem] truncate sm:inline">
              {item.executedModel && item.executedModel !== (item.requestedModel || item.model)
                ? `${item.requestedModel || item.model} → ${item.executedModel}`
                : item.model || "model —"}
              {item.fallbackUsed ? " · fallback" : ""}
              {" · "}
              {item.aspectRatio || "ratio —"}
            </span>
          </div>
          <p className="truncate text-[10px] text-zinc-500 sm:mt-1 sm:text-xs">
            <span className="font-semibold text-zinc-700">{item.userEmail || item.userDisplayName || "Пользователь неизвестен"}</span>
            <span className="hidden sm:inline">
              {" · "}{item.userProvider || "provider —"}
              {item.requesterAuthUserId && <> · auth {shortId(item.requesterAuthUserId)}</>}
              {item.identityMismatch && <> · billing {shortId(item.userId)}</>}
            </span>
            {" · "}{item.creditsSpent}
            {item.creditsRefunded ? " возвр" : ""}
            {" / "}{item.creditsRemaining == null ? "—" : item.creditsRemaining}
          </p>
          {item.editKind === "camera_orbit" && item.cameraPose && (
            <p className="hidden text-xs text-zinc-500 sm:mt-1 sm:block">
              ракурс {item.cameraPose.azimuthDeg ?? 0}° / {item.cameraPose.elevationDeg ?? 0}° / ×{item.cameraPose.distanceRel ?? 1}
              {item.sceneRootId ? ` · root ${shortId(item.sceneRootId)}` : ""}
            </p>
          )}
          <button onClick={() => setFullPrompt(item.prompt)} className={adminDensePromptClass}>
            {item.prompt}
          </button>
          {item.status === "failed" && <p className="line-clamp-1 text-[11px] text-red-700 sm:mt-2 sm:line-clamp-none sm:text-xs">
            {item.errorType || "generation_failed"}{item.errorMessage ? `: ${item.errorMessage}` : ""}
          </p>}
          {item.status === "completed" && <div className={adminDenseActionsClass}>
            <button onClick={() => navigator.clipboard.writeText(item.prompt)} className="text-indigo-600">Копировать</button>
            <button onClick={() => onRegenerate(item.prompt)} className="text-violet-600">Повторить</button>
            {item.publicationStatus !== "published" && <button
              disabled={Boolean(busy) || !item.canPublish} onClick={() => void publish(item.id)}
              className="text-amber-700 disabled:opacity-40">
              {busy === item.id ? "Публикация…" : item.requesterAuthUserId ? "Опубликовать" : "Нет автора"}
            </button>}
            {item.publicationStatus === "published" && <span className="text-emerald-600">Опубликовано</span>}
            {item.cardUrl && <a href={item.cardUrl} target="_blank" rel="noreferrer" className="text-sky-600">Открыть карточку</a>}
          </div>}
        </div>
      </article>)}</div>}

    {cursor && <button disabled={loading} onClick={() => void load(cursor)}
      className="mx-auto block rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50">
      {loading ? "Загрузка…" : "Показать ещё"}
    </button>}
    {lightbox && <AdminResultLightbox url={lightbox} onClose={() => setLightbox(null)} />}
    {fullPrompt && <div onClick={() => setFullPrompt(null)}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div onClick={(event) => event.stopPropagation()}
        className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold">Полный промпт</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{fullPrompt}</p>
        <button onClick={() => navigator.clipboard.writeText(fullPrompt)}
          className="mt-4 text-sm font-semibold text-indigo-600">Копировать</button>
      </div>
    </div>}
  </div>;
}
