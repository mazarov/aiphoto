"use client";

import { useMemo, useState } from "react";
import type { FinanceDailyPoint } from "@/lib/finance-types";

const SERIES = [
  { id: "revenueRub", label: "Выручка", color: "#4f46e5" },
  { id: "costRub", label: "Косты", color: "#e11d48" },
  { id: "profitRub", label: "Чистая прибыль", color: "#059669" },
] as const;

function formatRub(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
}

function formatDay(day: string): string {
  const [, month, date] = day.split("-");
  return month && date ? `${date}.${month}` : day;
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
    const height = 240;
    const pad = { top: 16, right: 16, bottom: 28, left: 56 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const values = series.flatMap((row) => [row.revenueRub, row.costRub, row.profitRub]);
    if (liabilityRub != null) values.push(liabilityRub);
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);
    const span = max - min || 1;
    const x = (index: number) => {
      if (series.length === 1) return pad.left + innerW / 2;
      return pad.left + (index / (series.length - 1)) * innerW;
    };
    const y = (value: number) => pad.top + innerH - ((value - min) / span) * innerH;
    const line = (key: (typeof SERIES)[number]["id"]) =>
      series.map((row, index) => `${x(index)},${y(row[key])}`).join(" ");
    const ticks = [min, min + span / 2, max].map((value) => Math.round(value));
    return { width, height, pad, innerH, x, y, line, ticks, min };
  }, [liabilityRub, series]);

  if (!chart || !series.length) {
    return <div className="rounded-2xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">Нет дневных данных за месяц</div>;
  }

  const hovered = series.find((row) => row.day === active) || null;
  const month = {
    revenueRub: series.reduce((sum, row) => sum + row.revenueRub, 0),
    costRub: series.reduce((sum, row) => sum + row.costRub, 0),
    profitRub: series.reduce((sum, row) => sum + row.profitRub, 0),
  };
  const selected = hovered || month;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {hovered ? formatDay(hovered.day) : "За месяц"}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">
            {formatRub(selected.profitRub)}
          </p>
          <p className="text-xs text-zinc-500">
            {hovered ? "чистая прибыль за день" : "чистая прибыль за месяц"}
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
        {SERIES.map((item) => (
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
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="h-60 w-full"
        role="img"
        aria-label="Выручка, косты, прибыль и текущие обязательства по дням"
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
            y1={chart.y(0)}
            y2={chart.y(0)}
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
        {SERIES.map((item) => (
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
                x={chart.x(index) - (series.length > 20 ? 6 : 10)}
                y={chart.pad.top}
                width={series.length > 20 ? 12 : 20}
                height={chart.innerH}
                fill="transparent"
                onMouseEnter={() => setActive(row.day)}
              />
              {isActive && SERIES.map((item) => (
                <circle
                  key={item.id}
                  cx={chart.x(index)}
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
            x={chart.x(series.findIndex((item) => item.day === row.day))}
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
        Выручка на графике — сумма платежей клиентов (gross), не «на счёт» после комиссии.
        Косты за день = комиссия ЮKassa + налог 6% + Gemini × 90 ₽.
        Пунктир — оценка непотраченных кредитов прямо сейчас.
      </p>
    </div>
  );
}
