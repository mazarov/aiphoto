"use client";

import { useMemo, useState } from "react";
import { FINANCE_COGS_PROVIDER_LABELS, type FinanceDailyPoint } from "@/lib/finance-types";

const COST_STACK = [
  { id: "yookassaFeesRub", label: "ЮKassa", color: "#71717a" },
  { id: "taxRub", label: "УСН 6%", color: "#d97706" },
  { id: "google", label: FINANCE_COGS_PROVIDER_LABELS.google, color: "#0d9488" },
  { id: "xai", label: FINANCE_COGS_PROVIDER_LABELS.xai, color: "#18181b" },
  { id: "openrouter", label: FINANCE_COGS_PROVIDER_LABELS.openrouter, color: "#ea580c" },
  { id: "other", label: FINANCE_COGS_PROVIDER_LABELS.other, color: "#a1a1aa" },
] as const;

const LINES = [
  { id: "revenueRub", label: "Выручка", color: "#4f46e5" },
  { id: "operatingRub", label: "Опер. маржа", color: "#059669" },
] as const;

function formatRub(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
}

function formatDay(day: string): string {
  const [, month, date] = day.split("-");
  return month && date ? `${date}.${month}` : day;
}

function stackValues(row: FinanceDailyPoint): Record<(typeof COST_STACK)[number]["id"], number> {
  return {
    yookassaFeesRub: row.yookassaFeesRub,
    taxRub: row.taxRub,
    google: row.cogsByProviderRub.google,
    xai: row.cogsByProviderRub.xai,
    openrouter: row.cogsByProviderRub.openrouter,
    other: row.cogsByProviderRub.other,
  };
}

export function FinanceDailyChart({
  series,
  liabilityRub,
}: {
  series: FinanceDailyPoint[];
  liabilityRub: number | null;
}) {
  const [active, setActive] = useState<string | null>(null);
  const chart = useMemo(() => {
    if (!series.length) return null;
    const width = 720;
    const height = 260;
    const pad = { top: 16, right: 16, bottom: 28, left: 56 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const values = series.flatMap((row) => [
      row.revenueRub,
      row.costRub,
      row.operatingRub,
      ...Object.values(stackValues(row)),
    ]);
    if (liabilityRub != null) values.push(liabilityRub);
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);
    const span = max - min || 1;
    const slot = series.length === 1 ? innerW : innerW / series.length;
    const barW = Math.max(6, Math.min(28, slot * 0.56));
    const xCenter = (index: number) => {
      if (series.length === 1) return pad.left + innerW / 2;
      return pad.left + slot * index + slot / 2;
    };
    const y = (value: number) => pad.top + innerH - ((value - min) / span) * innerH;
    const zeroY = y(0);
    const line = (key: (typeof LINES)[number]["id"]) =>
      series.map((row, index) => `${xCenter(index)},${y(row[key])}`).join(" ");
    const ticks = [min, min + span / 2, max].map((value) => Math.round(value));
    return { width, height, pad, innerH, slot, barW, xCenter, y, zeroY, line, ticks, min };
  }, [liabilityRub, series]);

  if (!chart || !series.length) {
    return <div className="rounded-2xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">Нет дневных данных за период</div>;
  }

  const hovered = series.find((row) => row.day === active) || null;
  const month = {
    revenueRub: series.reduce((sum, row) => sum + row.revenueRub, 0),
    costRub: series.reduce((sum, row) => sum + row.costRub, 0),
    operatingRub: series.reduce((sum, row) => sum + row.operatingRub, 0),
    yookassaFeesRub: series.reduce((sum, row) => sum + row.yookassaFeesRub, 0),
    taxRub: series.reduce((sum, row) => sum + row.taxRub, 0),
    cogsByProviderRub: {
      google: series.reduce((sum, row) => sum + row.cogsByProviderRub.google, 0),
      xai: series.reduce((sum, row) => sum + row.cogsByProviderRub.xai, 0),
      openrouter: series.reduce((sum, row) => sum + row.cogsByProviderRub.openrouter, 0),
      other: series.reduce((sum, row) => sum + row.cogsByProviderRub.other, 0),
    },
  };
  const selected = hovered || {
    ...month,
    day: "",
    profitRub: month.operatingRub,
    costRub: month.costRub,
  };
  const selectedStack = stackValues(selected);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {hovered ? formatDay(hovered.day) : "За период"}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">
            {formatRub(selected.operatingRub)}
          </p>
          <p className="text-xs text-zinc-500">
            {hovered ? "операционная маржа за день" : "операционная маржа за период"}
          </p>
        </div>
        <p className="text-sm text-zinc-500">
          выручка {formatRub(selected.revenueRub)}
          <span className="mx-2 text-zinc-300">·</span>
          косты {formatRub(selected.costRub)}
          <span className="mx-2 text-zinc-300">·</span>
          обязательства {formatRub(liabilityRub)}
        </p>
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-zinc-600">
        {LINES.map((item) => (
          <span key={item.id} className="flex items-center gap-1.5">
            <i className="h-0.5 w-4 rounded-sm" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        {COST_STACK.map((item) => (
          <span key={item.id} className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <i className="h-px w-4 border-t border-dashed border-amber-500" />
          Обязательства сейчас
        </span>
      </div>
      {hovered ? (
        <p className="mb-3 text-xs text-zinc-500">
          {COST_STACK.map((item) => `${item.label} ${formatRub(selectedStack[item.id])}`).join(" · ")}
        </p>
      ) : null}
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="h-64 w-full"
        role="img"
        aria-label="Выручка, косты по статьям и операционная маржа по дням"
        onMouseLeave={() => setActive(null)}
      >
        {chart.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={chart.pad.left}
              x2={chart.width - chart.pad.right}
              y1={chart.y(tick)}
              y2={chart.y(tick)}
              stroke="#f4f4f5"
            />
            <text x={8} y={chart.y(tick) + 4} className="fill-zinc-400" fontSize="10">
              {formatRub(tick)}
            </text>
          </g>
        ))}
        {chart.min < 0 && (
          <line
            x1={chart.pad.left}
            x2={chart.width - chart.pad.right}
            y1={chart.zeroY}
            y2={chart.zeroY}
            stroke="#d4d4d8"
          />
        )}
        {liabilityRub != null && (
          <line
            x1={chart.pad.left}
            x2={chart.width - chart.pad.right}
            y1={chart.y(liabilityRub)}
            y2={chart.y(liabilityRub)}
            stroke="#d97706"
            strokeDasharray="5 4"
            strokeWidth="1.5"
          />
        )}
        {series.map((row, index) => {
          const stack = stackValues(row);
          let cursor = 0;
          const x = chart.xCenter(index) - chart.barW / 2;
          return (
            <g key={`bar-${row.day}`}>
              {COST_STACK.map((item) => {
                const value = stack[item.id];
                if (value <= 0) return null;
                const top = cursor + value;
                const y = chart.y(top);
                const height = Math.max(0, chart.y(cursor) - y);
                cursor = top;
                return (
                  <rect
                    key={item.id}
                    x={x}
                    y={y}
                    width={chart.barW}
                    height={height}
                    fill={item.color}
                    opacity={hovered && hovered.day !== row.day ? 0.35 : 0.85}
                  />
                );
              })}
            </g>
          );
        })}
        {LINES.map((item) => (
          <polyline
            key={item.id}
            points={chart.line(item.id)}
            fill="none"
            stroke={item.color}
            strokeWidth="2.25"
            strokeLinejoin="round"
          />
        ))}
        {series.map((row, index) => {
          const isActive = hovered?.day === row.day;
          return (
            <g key={row.day}>
              <rect
                x={chart.xCenter(index) - Math.max(chart.slot, 12) / 2}
                y={chart.pad.top}
                width={Math.max(chart.slot, 12)}
                height={chart.innerH}
                fill="transparent"
                onMouseEnter={() => setActive(row.day)}
              />
              {isActive && LINES.map((item) => (
                <circle
                  key={item.id}
                  cx={chart.xCenter(index)}
                  cy={chart.y(row[item.id])}
                  r="4"
                  fill={item.color}
                />
              ))}
            </g>
          );
        })}
        {series.filter((_, index) => {
          const step = series.length > 20 ? 5 : series.length > 10 ? 2 : 1;
          return index === 0 || index === series.length - 1 || index % step === 0;
        }).map((row) => (
          <text
            key={`label-${row.day}`}
            x={chart.xCenter(series.findIndex((item) => item.day === row.day))}
            y={chart.height - 8}
            textAnchor="middle"
            className="fill-zinc-400"
            fontSize="10"
          >
            {formatDay(row.day)}
          </text>
        ))}
      </svg>
      <p className="mt-2 text-xs text-zinc-400">
        Столбики — косты дня (ЮKassa + УСН + Google / Grok / OpenRouter).
        Линии — выручка и операционная маржа. Директ в график не входит.
        Пунктир — оценка непотраченных кредитов прямо сейчас.
      </p>
    </div>
  );
}
