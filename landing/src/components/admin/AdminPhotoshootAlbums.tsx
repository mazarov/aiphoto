"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AdminResultLightbox } from "./AdminResultMedia";
import {
  adminDenseActionsClass,
  adminDenseBadgeClass,
  adminDenseFilterClass,
  adminDenseListClass,
  formatAdminRowWhen,
} from "./admin-dense-row";
import { clientSourceColor, clientSourceLabel } from "./analytics-constants";

type PublicationStatus = "unpublished" | "published" | "card_pending" | "card_missing";

type Album = {
  id: string;
  completedAt: string;
  prompt: string;
  model: string | null;
  clientSource: string;
  userEmail: string | null;
  userDisplayName: string | null;
  requesterAuthUserId: string | null;
  frameUrls: string[];
  publicationStatus: PublicationStatus;
  cardSlug: string | null;
  cardUrl: string | null;
  cardTitle: string | null;
  scenarioSlugs: string[];
  subjectAudience: string | null;
  subjectSource: string | null;
  canPublish: boolean;
};

type Scenario = {
  slug: string;
  label: string;
  exclusive: boolean;
  href: string;
  publishedCount: number | null;
};

const PUBLICATION_OPTIONS = [
  ["unpublished", "Не опубликовано"],
  ["published", "Опубликовано"],
  ["all", "Все"],
] as const;

/** Hub collage needs one full album; sitemap/L2 index needs 8. */
const SCENARIO_WARN_BELOW = 8;

const PUBLISH_ERRORS: Record<string, string> = {
  generation_author_missing: "У legacy-генерации нет auth-автора",
  multiple_exclusive_scenarios: "Выбери один сценарий из: мужские, женские, пары, семейная, ньюборн",
  invalid_scenario: "Неизвестный сценарий",
  not_photoshoot: "Это не фотосессия",
};

export function AdminPhotoshootAlbums() {
  const { openAuthModal } = useAuth();
  const [publication, setPublication] = useState<string>("unpublished");
  const [items, setItems] = useState<Album[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string[]>>({});

  const exclusiveSlugs = useMemo(
    () => new Set(scenarios.filter((s) => s.exclusive).map((s) => s.slug)),
    [scenarios],
  );
  const scenarioLabel = useMemo(
    () => new Map(scenarios.map((s) => [s.slug, s.label])),
    [scenarios],
  );

  const load = useCallback(async (next?: string) => {
    setLoading(true);
    setError("");
    setStatus(0);
    try {
      const params = new URLSearchParams({ publication, limit: "20" });
      if (next) {
        params.set("cursor", next);
        params.set("counts", "0");
      }
      const response = await fetch(`/api/admin/fotosessii?${params}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(response.status);
        throw new Error(body.error || "Не удалось загрузить фотосессии");
      }
      setItems((current) => (next ? [...current, ...body.items] : body.items));
      if (!next && Array.isArray(body.scenarios)) setScenarios(body.scenarios);
      setCursor(body.nextCursor || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [publication]);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePick = (albumId: string, slug: string) => {
    setPicked((current) => {
      const existing = current[albumId] ?? [];
      if (existing.includes(slug)) {
        return { ...current, [albumId]: existing.filter((s) => s !== slug) };
      }
      // One exclusive audience per card: picking a second one replaces the first.
      const next = exclusiveSlugs.has(slug)
        ? existing.filter((s) => !exclusiveSlugs.has(s))
        : existing;
      return { ...current, [albumId]: [...next, slug] };
    });
  };

  const publish = async (album: Album) => {
    setBusy(album.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/fotosessii/${album.id}/publish`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarios: picked[album.id] ?? [] }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(PUBLISH_ERRORS[body.error] || body.error || "Ошибка публикации");
      }
      setItems((current) => current.map((item) => item.id === album.id
        ? {
            ...item,
            publicationStatus: "published",
            cardUrl: body.cardUrl,
            cardSlug: body.slug,
            scenarioSlugs: body.scenarioSlugs ?? item.scenarioSlugs,
            subjectAudience: body.subjectAudience ?? item.subjectAudience,
            subjectSource: body.subjectSource ?? item.subjectSource,
          }
        : item));
      setPicked((current) => ({ ...current, [album.id]: [] }));
      setScenarios((current) => current.map((scenario) =>
        (body.scenarioSlugs ?? []).includes(scenario.slug)
          && !album.scenarioSlugs.includes(scenario.slug)
          && scenario.publishedCount != null
          ? { ...scenario, publishedCount: scenario.publishedCount + 1 }
          : scenario));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ошибка публикации");
    } finally {
      setBusy(null);
    }
  };

  if (status === 401 || status === 403) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">{status === 401 ? "Нужен вход" : "Доступ запрещён"}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {status === 401 ? "Войдите через PromptShot." : "Ваш email не включён в allowlist."}
        </p>
        {status === 401 && (
          <button onClick={() => openAuthModal()} className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white">
            Войти
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3 sm:space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="hidden text-sm font-medium text-indigo-600 sm:block">PromptShot Admin</p>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Фотосессии</h1>
          <p className="mt-0.5 hidden text-sm text-zinc-500 sm:mt-1 sm:block">
            Альбомы пользователей для <Link href="/ii-fotosessiya" className="text-indigo-600">/ii-fotosessiya</Link>: публикация и сценарии
          </p>
        </div>
        <Link href="/admin/analyze-history" className="shrink-0 text-xs font-semibold text-indigo-600 sm:text-sm">← История</Link>
      </header>

      {scenarios.length > 0 && (
        <section aria-label="Опубликованные альбомы по сценариям" className="rounded-xl border border-zinc-200 bg-white p-2.5 sm:rounded-2xl sm:p-4 sm:shadow-sm">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-xs">
            Опубликовано по сценариям · порог sitemap {SCENARIO_WARN_BELOW}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {scenarios.map((scenario) => {
              const count = scenario.publishedCount;
              const tone = count == null
                ? "border-zinc-200 text-zinc-500"
                : count === 0
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : count < SCENARIO_WARN_BELOW
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800";
              return (
                <Link key={scenario.slug} href={scenario.href} target="_blank" rel="noreferrer"
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:text-xs ${tone}`}>
                  {scenario.label} · {count == null ? "—" : count}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {PUBLICATION_OPTIONS.map(([value, label]) => (
          <button key={value} className={adminDenseFilterClass(publication === value)} onClick={() => setPublication(value)}>
            {label}
          </button>
        ))}
        <button disabled={loading} onClick={() => void load()}
          className="ml-auto rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-600 disabled:opacity-50 sm:rounded-xl sm:px-3 sm:py-2">
          Обновить
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading && !items.length ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : !items.length ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">Альбомов нет</div>
      ) : (
        <div className={adminDenseListClass}>
          {items.map((album) => {
            const selected = picked[album.id] ?? [];
            const isPublished = album.publicationStatus === "published";
            return (
              <article key={album.id} className="flex flex-col gap-2.5 rounded-xl border border-zinc-200 bg-white p-2.5 sm:flex-row sm:gap-3 sm:rounded-2xl sm:p-3 sm:shadow-sm">
                <div className="grid w-full shrink-0 grid-cols-4 gap-1 sm:w-64 sm:grid-cols-2">
                  {album.frameUrls.map((url, index) => (
                    <button key={url} type="button" onClick={() => setLightbox(url)}
                      className="relative aspect-[3/4] overflow-hidden rounded-md bg-zinc-100 sm:rounded-lg">
                      <img src={url} alt={`Кадр ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                    <span className={`${adminDenseBadgeClass} ${isPublished ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {isPublished ? "опубликовано" : album.publicationStatus === "card_pending" ? "без карточки" : "черновик"}
                    </span>
                    <span className={`${adminDenseBadgeClass} text-white`} style={{ background: clientSourceColor(album.clientSource) }}>
                      {clientSourceLabel(album.clientSource)}
                    </span>
                    <span>{formatAdminRowWhen(album.completedAt)}</span>
                    {album.model && <span className="hidden sm:inline">{album.model}</span>}
                    {album.subjectAudience && (
                      <span className={`${adminDenseBadgeClass} bg-sky-100 text-sky-800`}>
                        subject {album.subjectAudience}{album.subjectSource === "manual" ? " · manual" : ""}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-zinc-600 sm:text-xs">
                    <span className="font-semibold text-zinc-800">{album.userEmail || album.userDisplayName || "Пользователь неизвестен"}</span>
                    {album.cardTitle ? <> · {album.cardTitle}</> : null}
                  </p>
                  {album.prompt && (
                    <p className="line-clamp-2 text-xs leading-4 text-zinc-700 sm:text-sm sm:leading-5">{album.prompt}</p>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {scenarios.map((scenario) => {
                      const has = album.scenarioSlugs.includes(scenario.slug);
                      const on = selected.includes(scenario.slug);
                      return (
                        <button key={scenario.slug} type="button"
                          disabled={has || Boolean(busy)}
                          onClick={() => togglePick(album.id, scenario.slug)}
                          aria-pressed={on}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition sm:text-[11px] ${
                            has
                              ? "cursor-default border-emerald-200 bg-emerald-50 text-emerald-800"
                              : on
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                          } disabled:opacity-70`}>
                          {has ? "✓ " : ""}{scenario.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className={adminDenseActionsClass}>
                    <button
                      type="button"
                      disabled={Boolean(busy) || !album.canPublish || (isPublished && selected.length === 0)}
                      onClick={() => void publish(album)}
                      className="text-amber-700 disabled:opacity-40">
                      {busy === album.id
                        ? "Публикация…"
                        : !album.requesterAuthUserId
                          ? "Нет автора"
                          : isPublished
                            ? selected.length ? `Добавить: ${selected.map((s) => scenarioLabel.get(s) ?? s).join(", ")}` : "Выбери сценарий"
                            : selected.length
                              ? `Опубликовать: ${selected.map((s) => scenarioLabel.get(s) ?? s).join(", ")}`
                              : "Опубликовать без сценария"}
                    </button>
                    {album.cardUrl && (
                      <a href={album.cardUrl} target="_blank" rel="noreferrer" className="text-sky-600">Открыть карточку</a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {cursor && (
        <button disabled={loading} onClick={() => void load(cursor)}
          className="mx-auto block rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50">
          {loading ? "Загрузка…" : "Показать ещё"}
        </button>
      )}
      {lightbox && <AdminResultLightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
