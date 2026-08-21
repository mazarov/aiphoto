"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { SeoQueryMetricsChart } from "@/components/admin/SeoQueryMetricsChart";
import type {
  SeoDailyPoint,
  SeoDeltaBlock,
  SeoMetricBlock,
  SeoPageRow,
  SeoWatchlistSnapshot,
} from "@/lib/seo-watchlist";
import { projectPageToRange, snapshotDates } from "@/lib/seo-watchlist";

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

function formatInt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function formatCtr(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
}

function formatPos(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

function Delta({
  value,
  invert,
  suffix,
}: {
  value: number | null;
  invert?: boolean;
  suffix?: string;
}) {
  if (value == null || Math.abs(value) < 0.005) {
    return <span className="text-xs text-zinc-400">0</span>;
  }
  const good = invert ? value < 0 : value > 0;
  const sign = value > 0 ? "+" : "";
  const text =
    suffix === "%"
      ? `${sign}${value.toFixed(2)}`
      : suffix === "pos"
        ? `${sign}${value.toFixed(1)}`
        : `${sign}${formatInt(value)}`;
  return (
    <span className={`text-xs font-medium ${good ? "text-emerald-600" : "text-red-600"}`}>
      {text}
    </span>
  );
}

function MetricCell({
  current,
  delta,
  kind,
}: {
  current: SeoMetricBlock;
  delta: SeoDeltaBlock;
  kind: "impressions" | "clicks" | "ctr" | "position";
}) {
  if (kind === "ctr") {
    return (
      <div className="text-right">
        <div className="text-sm font-semibold text-zinc-900">{formatCtr(current.ctr)}</div>
        <Delta value={delta.ctr} suffix="%" />
      </div>
    );
  }
  if (kind === "position") {
    return (
      <div className="text-right">
        <div className="text-sm font-semibold text-zinc-900">{formatPos(current.position)}</div>
        <Delta value={delta.position} invert suffix="pos" />
      </div>
    );
  }
  return (
    <div className="text-right">
      <div className="text-sm font-semibold text-zinc-900">{formatInt(current[kind])}</div>
      <Delta value={delta[kind]} />
    </div>
  );
}

function Sparkline({ series }: { series: SeoDailyPoint[] }) {
  const max = Math.max(1, ...series.map((point) => point.impressions));
  return (
    <div className="flex h-6 items-end gap-px" aria-hidden>
      {series.map((point) => (
        <span
          key={point.date}
          title={`${point.date}: ${formatInt(point.impressions)} показов`}
          className="w-1.5 rounded-sm bg-indigo-300"
          style={{ height: `${Math.max(8, (point.impressions / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function SeoWatchlistDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<SeoWatchlistSnapshot | null>(null);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [openCharts, setOpenCharts] = useState<Record<string, boolean>>({});
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [state, setState] = useState({ loading: true, status: 0, error: "" });

  const load = useCallback(async () => {
    setState({ loading: true, status: 0, error: "" });
    try {
      const response = await fetch("/api/admin/seo-watchlist", { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setData(null);
        setState({
          loading: false,
          status: response.status,
          error: body.error || "Ошибка загрузки",
        });
      } else {
        setData(body);
        const dates = snapshotDates(body);
        setFrom((current) => current || dates[0] || "");
        setTo((current) => current || dates[dates.length - 1] || "");
        setState({ loading: false, status: 0, error: "" });
      }
    } catch {
      setState({ loading: false, status: 0, error: "Ошибка сети" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, user]);

  const allDates = useMemo(() => (data ? snapshotDates(data) : []), [data]);
  const minDate = allDates[0] || "";
  const maxDate = allDates[allDates.length - 1] || "";
  const pages = useMemo(() => {
    if (!data) return [];
    const start = from || minDate;
    const end = to || maxDate;
    if (!start || !end) return data.pages;
    return data.pages
      .map((page) => {
        const projected = projectPageToRange(page, start, end, allDates);
        return {
          ...projected,
          queries: [...projected.queries].sort(
            (a, b) => b.current.impressions - a.current.impressions,
          ),
        };
      })
      .sort((a, b) => b.current.impressions - a.current.impressions);
  }, [allDates, data, from, maxDate, minDate, to]);

  if (state.status === 401 || state.status === 403) {
    return <AccessMessage status={state.status} />;
  }

  function applyPreset(kind: "all" | "7" | "1") {
    if (allDates.length === 0) return;
    if (kind === "all") {
      setFrom(minDate);
      setTo(maxDate);
      return;
    }
    if (kind === "1") {
      setFrom(maxDate);
      setTo(maxDate);
      return;
    }
    const start = allDates[Math.max(0, allDates.length - 7)] || minDate;
    setFrom(start);
    setTo(maxDate);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-medium text-indigo-600">PromptShot Admin</p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">SEO вотчлист</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Топ-30 страниц по показам. Раскройте строку — запросы, из которых складываются цифры.
          {data?.grainWindow
            ? ` Снимок Вебмастера ${data.grainWindow.from} — ${data.grainWindow.to}.`
            : " Снимок ещё не собран."}{" "}
          Цифры и Δ считаются по выбранным дням; Δ — минус такое же окно сразу до фильтра.
        </p>
        {allDates.length > 0 && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-2">
              <FilterChip active={from === minDate && to === maxDate} onClick={() => applyPreset("all")}>
                Все дни
              </FilterChip>
              <FilterChip
                active={from === (allDates[Math.max(0, allDates.length - 7)] || minDate) && to === maxDate}
                onClick={() => applyPreset("7")}
              >
                7 дней
              </FilterChip>
              <FilterChip active={from === maxDate && to === maxDate} onClick={() => applyPreset("1")}>
                1 день
              </FilterChip>
            </div>
            <label className="text-sm text-zinc-600">
              С{" "}
              <input
                type="date"
                min={minDate}
                max={maxDate}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="ml-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm text-zinc-600">
              По{" "}
              <input
                type="date"
                min={minDate}
                max={maxDate}
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="ml-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
              />
            </label>
            <p className="text-xs text-zinc-500">
              Показано {from || "—"} — {to || "—"}.
            </p>
          </div>
        )}
      </header>

      {state.loading && !data ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : state.error ? (
        <div className={`${card} text-red-600`}>{state.error}</div>
      ) : pages.length === 0 ? (
        <div className={card}>
          <p className="text-sm text-zinc-600">
            Снимок пустой. Локально:{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
              node src/standalone/refresh-seo-watchlist.mjs
            </code>
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Страница</th>
                <th className="px-4 py-3 text-right">Показы</th>
                <th className="px-4 py-3 text-right">Клики</th>
                <th className="px-4 py-3 text-right">CTR</th>
                <th className="px-4 py-3 text-right">Позиция</th>
                <th className="px-4 py-3 text-right">Дни</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <PageBlock
                  key={page.path}
                  page={page}
                  open={openPath === page.path}
                  openCharts={openCharts}
                  onToggle={() =>
                    setOpenPath((current) => (current === page.path ? null : page.path))
                  }
                  onToggleChart={(query) =>
                    setOpenCharts((current) => {
                      const key = `${page.path}::${query}`;
                      return { ...current, [key]: !current[key] };
                    })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
        active ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function PageBlock({
  page,
  open,
  openCharts,
  onToggle,
  onToggleChart,
}: {
  page: SeoPageRow;
  open: boolean;
  openCharts: Record<string, boolean>;
  onToggle: () => void;
  onToggleChart: (query: string) => void;
}) {
  return (
    <>
      <tr className="border-t border-zinc-100 hover:bg-zinc-50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={open ? "Скрыть запросы" : "Показать запросы"}
              className="w-4 shrink-0 text-sm text-zinc-400"
            >
              {open ? "▾" : "▸"}
            </button>
            <a
              href={page.path}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-indigo-700 hover:underline"
            >
              {page.path}
            </a>
          </div>
        </td>
        <td className="px-4 py-3">
          <MetricCell current={page.current} delta={page.delta} kind="impressions" />
        </td>
        <td className="px-4 py-3">
          <MetricCell current={page.current} delta={page.delta} kind="clicks" />
        </td>
        <td className="px-4 py-3">
          <MetricCell current={page.current} delta={page.delta} kind="ctr" />
        </td>
        <td className="px-4 py-3">
          <MetricCell current={page.current} delta={page.delta} kind="position" />
        </td>
        <td className="px-4 py-3">
          <Sparkline series={page.series} />
        </td>
      </tr>
      {open && (
        <tr className="border-t border-zinc-100 bg-zinc-50">
          <td colSpan={6} className="px-4 py-4">
            {page.queries.length === 0 ? (
              <p className="text-sm text-zinc-500">Запросов в окне Вебмастера нет.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="py-2 text-left">Запрос</th>
                    <th className="py-2 text-right">Показы</th>
                    <th className="py-2 text-right">Спрос</th>
                    <th className="py-2 text-right">Клики</th>
                    <th className="py-2 text-right">CTR</th>
                    <th className="py-2 text-right">Позиция</th>
                    <th className="py-2 text-right">Дни</th>
                  </tr>
                </thead>
                <tbody>
                  {page.queries.map((row) => {
                    const chartOpen = Boolean(openCharts[`${page.path}::${row.query}`]);
                    return (
                      <QueryBlock
                        key={row.query}
                        row={row}
                        chartOpen={chartOpen}
                        onToggleChart={() => onToggleChart(row.query)}
                      />
                    );
                  })}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function QueryBlock({
  row,
  chartOpen,
  onToggleChart,
}: {
  row: SeoPageRow["queries"][number];
  chartOpen: boolean;
  onToggleChart: () => void;
}) {
  return (
    <>
      <tr className="border-t border-zinc-200">
        <td className="py-2 pr-3">
          <button
            type="button"
            onClick={onToggleChart}
            aria-expanded={chartOpen}
            className="flex items-center gap-2 text-left text-sm text-zinc-800"
          >
            <span className="w-4 text-zinc-400">{chartOpen ? "▾" : "▸"}</span>
            {row.query}
          </button>
        </td>
        <td className="py-2">
          <MetricCell current={row.current} delta={row.delta} kind="impressions" />
        </td>
        <td className="py-2 text-right">
          <div className="text-sm font-semibold text-zinc-900">
            {row.current.demand == null ? "—" : formatInt(row.current.demand)}
          </div>
          <Delta value={row.delta.demand} />
        </td>
        <td className="py-2">
          <MetricCell current={row.current} delta={row.delta} kind="clicks" />
        </td>
        <td className="py-2">
          <MetricCell current={row.current} delta={row.delta} kind="ctr" />
        </td>
        <td className="py-2">
          <MetricCell current={row.current} delta={row.delta} kind="position" />
        </td>
        <td className="py-2">
          <Sparkline series={row.series} />
        </td>
      </tr>
      {chartOpen && (
        <tr className="border-t border-zinc-200">
          <td colSpan={7} className="pb-3">
            <SeoQueryMetricsChart series={row.series} />
          </td>
        </tr>
      )}
    </>
  );
}
