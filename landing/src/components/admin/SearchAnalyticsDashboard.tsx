"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { SearchAnalyticsDashboard as SearchAnalyticsDashboardData } from "@/lib/search-analytics-data";
import { AdminExpandableCard } from "./AdminExpandableCard";

const PERIODS = [
  { value: 1, label: "Сегодня" },
  { value: 7, label: "7 дней" },
  { value: 30, label: "30 дней" },
  { value: 90, label: "90 дней" },
];
const card = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm";

function AccessMessage({ status }: { status: number }) {
  const { openAuthModal } = useAuth();
  return (
    <div className={`${card} mx-auto max-w-lg text-center`}>
      <h1 className="text-xl font-semibold text-zinc-900">
        {status === 401 ? "Нужен вход" : "Доступ запрещён"}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        {status === 401
          ? "Войдите через PromptShot с разрешённым аккаунтом."
          : "Аккаунт отсутствует в ANALYTICS_ADMIN_EMAILS."}
      </p>
      {status === 401 && (
        <button
          onClick={() => openAuthModal()}
          className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Войти
        </button>
      )}
    </div>
  );
}

function formatCount(value: number): string {
  return value.toLocaleString("ru-RU");
}

function formatRate(value: number): string {
  return `${(value * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
}

function formatAvg(value: number): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

function ObservabilitySection({
  obs,
}: {
  obs: SearchAnalyticsDashboardData["observability"];
}) {
  const { modeSplit, cardCoverage, queryVectors, visualEnabled } = obs;
  const hybridWidth = Math.round(modeSplit.hybridShare * 100);
  const readyVecWidth = Math.round(queryVectors.readyVectorShare * 100);
  const geminiVecWidth = Math.round(queryVectors.sentToGeminiShare * 100);
  const inQueue = cardCoverage.pending + cardCoverage.processing;

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {/* 1. Эмбеддинги vs Текст */}
      <div className={card}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Эмбеддинги vs Текст
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              visualEnabled
                ? "bg-emerald-50 text-emerald-700"
                : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {visualEnabled ? "Hybrid ON" : "Visual OFF"}
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-3">
          <div>
            <p className="text-3xl font-bold tabular-nums text-indigo-600">
              {formatRate(modeSplit.hybridShare)}
            </p>
            <p className="text-xs text-zinc-500">
              по эмбеддингам ({formatCount(modeSplit.hybridRequests)})
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-zinc-700">
              {formatRate(modeSplit.textShare)}
            </p>
            <p className="text-xs text-zinc-500">
              только текст ({formatCount(modeSplit.textOnlyRequests)})
            </p>
          </div>
        </div>

        <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
          {modeSplit.totalRequests > 0 ? (
            <>
              <div
                className="bg-indigo-600 transition-all"
                style={{ width: `${hybridWidth}%` }}
                title={`По эмбеддингам: ${formatCount(modeSplit.hybridRequests)}`}
              />
              <div
                className="bg-zinc-300 transition-all"
                style={{ width: `${Math.max(0, 100 - hybridWidth)}%` }}
                title={`Только текст: ${formatCount(modeSplit.textOnlyRequests)}`}
              />
            </>
          ) : null}
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          Всего запросов к движку:{" "}
          <span className="font-semibold text-zinc-700">
            {formatCount(modeSplit.totalRequests)}
          </span>
          {modeSplit.fallbackRequests > 0 ? (
            <>
              {" · "}fallback на текст:{" "}
              <span className="font-semibold text-amber-600">
                {formatCount(modeSplit.fallbackRequests)}
              </span>
            </>
          ) : null}
        </p>
      </div>

      {/* 2. Карточки без эмбеддинга */}
      <div className={card}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Карточки без эмбеддинга
          </p>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
            gen {cardCoverage.generation}
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-3">
          <div>
            <p
              className={`text-3xl font-bold tabular-nums ${
                cardCoverage.withoutEmbedding === 0
                  ? "text-emerald-600"
                  : "text-amber-600"
              }`}
            >
              {formatCount(cardCoverage.withoutEmbedding)}
            </p>
            <p className="text-xs text-zinc-500">без эмбеддинга сейчас</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-zinc-900">
              {formatRate(cardCoverage.coverageRate)}
            </p>
            <p className="text-xs text-zinc-500">
              готово {formatCount(cardCoverage.ready)} из{" "}
              {formatCount(cardCoverage.publishedWithPhoto)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
          {cardCoverage.publishedWithPhoto > 0 ? (
            <div
              className="bg-emerald-500 transition-all"
              style={{
                width: `${Math.min(100, Math.round(cardCoverage.coverageRate * 100))}%`,
              }}
            />
          ) : null}
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          В очереди:{" "}
          <span className="font-semibold text-zinc-700">
            {formatCount(inQueue)}
          </span>
          {" · "}повтор:{" "}
          <span className="font-semibold text-zinc-700">
            {formatCount(cardCoverage.retry)}
          </span>
          {cardCoverage.dead > 0 ? (
            <>
              {" · "}ошибки (dead):{" "}
              <span className="font-semibold text-red-600">
                {formatCount(cardCoverage.dead)}
              </span>
            </>
          ) : null}
        </p>
      </div>

      {/* 3. Ушло в Gemini за вектором vs Готовый вектор */}
      <div className={card}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Запросы в Gemini за вектором
          </p>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
            в БД: {formatCount(queryVectors.storedVectorsTotal)}
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-3">
          <div>
            <p className="text-3xl font-bold tabular-nums text-amber-600">
              {formatCount(queryVectors.sentToGemini)}
            </p>
            <p className="text-xs text-zinc-500">
              ушло в Gemini ({formatRate(queryVectors.sentToGeminiShare)})
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-emerald-600">
              {formatCount(queryVectors.servedFromReadyVector)}
            </p>
            <p className="text-xs text-zinc-500">
              готовый вектор ({formatRate(queryVectors.readyVectorShare)})
            </p>
          </div>
        </div>

        <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
          {queryVectors.trackedRequests > 0 ? (
            <>
              <div
                className="bg-emerald-500 transition-all"
                style={{ width: `${readyVecWidth}%` }}
                title={`Из готовых векторов (L1+L2): ${formatCount(queryVectors.servedFromReadyVector)}`}
              />
              <div
                className="bg-amber-500 transition-all"
                style={{ width: `${geminiVecWidth}%` }}
                title={`Ушло в Gemini (не было вектора): ${formatCount(queryVectors.sentToGemini)}`}
              />
            </>
          ) : null}
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          Кэш: БД{" "}
          <span className="font-semibold text-zinc-700">
            {formatCount(queryVectors.l2DbHits)}
          </span>
          {" / "}RAM{" "}
          <span className="font-semibold text-zinc-700">
            {formatCount(queryVectors.l1Hits)}
          </span>
          {queryVectors.geminiError > 0 ? (
            <>
              {" · "}таймаут Gemini:{" "}
              <span className="font-semibold text-amber-600">
                {formatCount(queryVectors.geminiError)}
              </span>
            </>
          ) : null}
          {" · "}лимит сегодня:{" "}
          <span className="font-semibold text-zinc-700">
            {formatCount(queryVectors.todayGeminiGlobalUsed)}/
            {formatCount(queryVectors.todayGeminiGlobalLimit)}
          </span>
        </p>
      </div>
    </section>
  );
}

function QueryTable({
  rows,
  empty,
}: {
  rows: SearchAnalyticsDashboardData["topQueries"];
  empty: string;
}) {
  if (!rows.length) return <p className="text-sm text-zinc-500">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="text-xs uppercase text-zinc-400">
          <tr>
            <th className="pb-3">Запрос</th>
            <th>Поиски</th>
            <th>Уники</th>
            <th>Выдача</th>
            <th>Клики</th>
            <th>CTR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.query_norm} className="border-t border-zinc-100">
              <td className="py-3 font-medium text-zinc-800">{row.query_raw || row.query_norm}</td>
              <td>{formatCount(row.searches)}</td>
              <td>{formatCount(row.unique_visitors)}</td>
              <td>{formatAvg(row.avg_result_count)}</td>
              <td>{formatCount(row.clicks)}</td>
              <td>
                {formatRate(row.searches ? row.searches_with_click / row.searches : 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SearchDailyChart({ rows }: { rows: SearchAnalyticsDashboardData["daily"] }) {
  const series = rows.filter((row) => row.day);
  const max = Math.max(1, ...series.map((row) => Math.max(row.searches, row.clicks, row.zero_results)));
  if (!series.length) {
    return <div className="rounded-2xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">Нет данных</div>;
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-zinc-600">
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm bg-indigo-600" /> Поиски
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Клики
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm bg-zinc-400" /> Нулевая выдача
        </span>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex h-52 min-w-[520px] items-end gap-2">
          {series.map((row) => (
            <div key={row.day} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[10px] font-medium text-zinc-500">{row.searches}</span>
              <div className="flex h-40 w-full items-end justify-center gap-0.5">
                <i
                  className="w-1.5 rounded-sm bg-indigo-600"
                  style={{ height: Math.max(3, (row.searches / max) * 160) }}
                  title={`Поиски: ${row.searches}`}
                />
                <i
                  className="w-1.5 rounded-sm bg-emerald-500"
                  style={{ height: Math.max(2, (row.clicks / max) * 160) }}
                  title={`Клики: ${row.clicks}`}
                />
                <i
                  className="w-1.5 rounded-sm bg-zinc-400"
                  style={{ height: Math.max(2, (row.zero_results / max) * 160) }}
                  title={`Нули: ${row.zero_results}`}
                />
              </div>
              <span className="text-[10px] text-zinc-400">{row.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SearchAnalyticsDashboard() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<SearchAnalyticsDashboardData | null>(null);
  const [state, setState] = useState({ loading: true, status: 0, error: "" });

  const load = useCallback(async () => {
    setState({ loading: true, status: 0, error: "" });
    try {
      const response = await fetch(`/api/admin/search-analytics?days=${days}`, {
        credentials: "include",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setData(null);
        setState({
          loading: false,
          status: response.status,
          error: body.error || "Не удалось загрузить поиск",
        });
        return;
      }
      setData(body as SearchAnalyticsDashboardData);
      setState({ loading: false, status: 0, error: "" });
    } catch {
      setState({ loading: false, status: 0, error: "Ошибка сети" });
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load, user]);

  if (state.status === 401 || state.status === 403) {
    return <AccessMessage status={state.status} />;
  }

  const summary = data?.summary;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">PromptShot Admin</p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Поиск</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Состояние гибридного движка, покрытие каталога эмбеддингами и конверсия запросов /search.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((period) => (
            <button
              key={period.value}
              onClick={() => setDays(period.value)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                days === period.value
                  ? "bg-indigo-600 text-white"
                  : "border border-zinc-200 bg-white text-zinc-600"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </header>
      {state.loading && !data ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : state.error ? (
        <div className={`${card} text-red-600`}>{state.error}</div>
      ) : data && summary ? (
        <>
          <ObservabilitySection obs={data.observability} />

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Поиски (/search)", formatCount(summary.searches)],
              ["Уники", formatCount(summary.uniqueVisitors)],
              ["Нулевая выдача", formatRate(summary.zeroResultRate)],
              ["CTR в карточку", formatRate(summary.ctr)],
              ["Средняя выдача", formatAvg(summary.avgResultCount)],
            ].map(([label, value]) => (
              <div key={label} className={card}>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{value}</p>
              </div>
            ))}
          </section>
          <section className={card}>
            <h2 className="mb-4 font-semibold text-zinc-900">Поиски и клики по дням</h2>
            <SearchDailyChart rows={data.daily} />
          </section>
          <section className={card}>
            <h2 className="mb-1 font-semibold text-zinc-900">Топ запросов</h2>
            <p className="mb-4 text-sm text-zinc-500">
              Выдача — среднее число карточек на первой странице (лимит 48).
            </p>
            <QueryTable rows={data.topQueries} empty="За период нет зафиксированных поисков" />
          </section>
          <AdminExpandableCard
            title="Нулевая выдача"
            summary={
              data.zeroQueries.length
                ? `${data.zeroQueries.length} запросов без карточек`
                : "Нет пустых запросов"
            }
          >
            <QueryTable
              rows={data.zeroQueries}
              empty="За период нет запросов с пустой первой страницей"
            />
          </AdminExpandableCard>
        </>
      ) : null}
    </div>
  );
}
