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
            Зафиксированные запросы с /search: первая страница, размер выдачи и клик в карточку.
            Инлайн-превью и набор по буквам не пишутся.
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
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Поиски", formatCount(summary.searches)],
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
