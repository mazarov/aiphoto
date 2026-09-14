"use client";

import { useCallback, useEffect, useState } from "react";
import type { SearchAnalyticsDashboard } from "@/lib/search-analytics-data";
import { AdminExpandableCard } from "./AdminExpandableCard";

const card = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm";

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
  rows: SearchAnalyticsDashboard["topQueries"];
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

function SearchDailyChart({ rows }: { rows: SearchAnalyticsDashboard["daily"] }) {
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

export function SearchAnalyticsSection({ days }: { days: number }) {
  const [data, setData] = useState<SearchAnalyticsDashboard | null>(null);
  const [state, setState] = useState({ loading: true, error: "" });

  const load = useCallback(async () => {
    setState({ loading: true, error: "" });
    try {
      const response = await fetch(`/api/admin/search-analytics?days=${days}`, {
        credentials: "include",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setData(null);
        setState({ loading: false, error: body.error || "Не удалось загрузить поиск" });
        return;
      }
      setData(body as SearchAnalyticsDashboard);
      setState({ loading: false, error: "" });
    } catch {
      setState({ loading: false, error: "Ошибка сети" });
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.loading && !data) {
    return <section className={card}><p className="text-sm text-zinc-500">Загрузка поиска…</p></section>;
  }
  if (state.error) {
    return <section className={`${card} text-red-600`}>{state.error}</section>;
  }
  if (!data) return null;

  const { summary } = data;

  return (
    <div className="space-y-4">
      <section className={card}>
        <div className="mb-5">
          <h2 className="font-semibold text-zinc-900">Поиск по каталогу</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Зафиксированные запросы с /search: первая страница, размер выдачи и клик в карточку.
            Инлайн-превью и набор по буквам не пишутся.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Поиски", formatCount(summary.searches)],
            ["Уники", formatCount(summary.uniqueVisitors)],
            ["Нулевая выдача", formatRate(summary.zeroResultRate)],
            ["CTR в карточку", formatRate(summary.ctr)],
            ["Средняя выдача", formatAvg(summary.avgResultCount)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">{value}</p>
            </div>
          ))}
        </div>
      </section>
      <section className={card}>
        <h3 className="mb-4 font-semibold text-zinc-900">Поиски и клики по дням</h3>
        <SearchDailyChart rows={data.daily} />
      </section>
      <section className={card}>
        <h3 className="mb-1 font-semibold text-zinc-900">Топ запросов</h3>
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
    </div>
  );
}
