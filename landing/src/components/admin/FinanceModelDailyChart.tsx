"use client";

import { useMemo, useState } from "react";
import {
  GEMINI_FAMILY_COLORS,
  GEMINI_FAMILY_LABELS,
  GEMINI_FAMILY_ORDER,
  type FinanceModelDailyPoint,
  type GeminiFamilyId,
} from "@/lib/finance-types";

function formatRub(value: number): string {
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
}

function formatDay(day: string): string {
  const [, month, date] = day.split("-");
  return month && date ? `${date}.${month}` : day;
}

function familiesInSeries(series: FinanceModelDailyPoint[]): GeminiFamilyId[] {
  return GEMINI_FAMILY_ORDER.filter((family) =>
    series.some((row) => (row.byFamily[family] || 0) > 0),
  );
}

export function FinanceModelDailyChart({ series }: { series: FinanceModelDailyPoint[] }) {
  const [active, setActive] = useState<string | null>(null);
  const families = useMemo(() => familiesInSeries(series), [series]);
  const chart = useMemo(() => {
    if (!series.length || !families.length) return null;
    const width = 720;
    const height = 240;
    const pad = { top: 16, right: 16, bottom: 28, left: 56 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const max = Math.max(1, ...series.map((row) => row.totalRub));
    const x = (index: number) => {
      if (series.length === 1) return pad.left + innerW / 2;
      return pad.left + (index / (series.length - 1)) * innerW;
    };
    const y = (value: number) => pad.top + innerH - (Math.max(0, value) / max) * innerH;
    const line = (family: GeminiFamilyId) =>
      series.map((row, index) => `${x(index)},${y(row.byFamily[family] || 0)}`).join(" ");
    const ticks = [0, Math.round(max / 2), Math.round(max)];
    return { width, height, pad, innerH, x, y, line, ticks };
  }, [families, series]);

  if (!chart || !series.length || !families.length) {
    return <div className="rounded-2xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">Нет затрат Gemini за месяц</div>;
  }

  const selected = series.find((row) => row.day === active) || series[series.length - 1];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Модели {formatDay(selected.day)}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">{formatRub(selected.totalRub)}</p>
          <p className="text-xs text-zinc-500">затраты Gemini за день</p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500">
          {families.map((family) => (
            <span key={family}>
              {GEMINI_FAMILY_LABELS[family]} {formatRub(selected.byFamily[family] || 0)}
            </span>
          ))}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-zinc-600">
        {families.map((family) => (
          <span key={family} className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-sm" style={{ background: GEMINI_FAMILY_COLORS[family] }} />
            {GEMINI_FAMILY_LABELS[family]}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="h-60 w-full"
        role="img"
        aria-label="Затраты Gemini по семействам моделей по дням"
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
        {families.map((family) => (
          <polyline
            key={family}
            points={chart.line(family)}
            fill="none"
            stroke={GEMINI_FAMILY_COLORS[family]}
            strokeWidth="2.25"
            strokeLinejoin="round"
          />
        ))}
        {series.map((row, index) => {
          const isActive = row.day === selected.day;
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
              {isActive && families.map((family) => (
                <circle
                  key={family}
                  cx={chart.x(index)}
                  cy={chart.y(row.byFamily[family] || 0)}
                  r="4"
                  fill={GEMINI_FAMILY_COLORS[family]}
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
        Каждая линия — семейство модели в ₽ ($1 = 90). Наведите на день, чтобы увидеть разбивку.
      </p>
    </div>
  );
}
