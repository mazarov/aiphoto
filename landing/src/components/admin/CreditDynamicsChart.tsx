"use client";

import { useMemo, useState } from "react";
import type { CreditSeriesDay } from "@/lib/admin-credits";

function formatCredits(value: number): string {
  return value.toLocaleString("ru-RU");
}

function formatDay(day: string): string {
  const [, month, date] = day.split("-");
  return month && date ? `${date}.${month}` : day;
}

export function CreditDynamicsChart({ series }: { series: CreditSeriesDay[] }) {
  const [active, setActive] = useState<string | null>(null);
  const chart = useMemo(() => {
    if (!series.length) return null;
    const width = 720;
    const height = 200;
    const pad = { top: 16, right: 12, bottom: 28, left: 44 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const max = Math.max(1, ...series.map((row) => row.remaining));
    const x = (index: number) => {
      if (series.length === 1) return pad.left + innerW / 2;
      return pad.left + (index / (series.length - 1)) * innerW;
    };
    const y = (value: number) => pad.top + innerH - (Math.max(0, value) / max) * innerH;
    const points = series.map((row, index) => `${x(index)},${y(row.remaining)}`).join(" ");
    const area = `${pad.left},${pad.top + innerH} ${points} ${x(series.length - 1)},${pad.top + innerH}`;
    const ticks = [0, Math.round(max / 2), max];
    return { width, height, pad, innerH, max, x, y, points, area, ticks };
  }, [series]);

  if (!chart || !series.length) {
    return <div className="rounded-2xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">Нет движения кредитов за период</div>;
  }

  const selected = series.find((row) => row.day === active) || series[series.length - 1];
  const net = selected.granted + selected.refunded - selected.spent;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Остаток на {formatDay(selected.day)}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">
            {formatCredits(selected.remaining)}
          </p>
        </div>
        <p className="text-sm text-zinc-500">
          {net >= 0 ? "+" : ""}{formatCredits(net)} за день
          <span className="mx-2 text-zinc-300">·</span>
          +{formatCredits(selected.granted)} начислено
          <span className="mx-2 text-zinc-300">·</span>
          −{formatCredits(selected.spent)} потрачено
          {selected.refunded > 0 ? ` · +${formatCredits(selected.refunded)} возврат` : ""}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="h-52 w-full"
        role="img"
        aria-label="Остаток непотраченных кредитов по дням"
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
              {formatCredits(tick)}
            </text>
          </g>
        ))}
        <polygon points={chart.area} fill="#eef2ff" />
        <polyline points={chart.points} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinejoin="round" />
        {series.map((row, index) => {
          const isActive = row.day === selected.day;
          return (
            <g key={row.day}>
              <rect
                x={chart.x(index) - (series.length > 40 ? 4 : 8)}
                y={chart.pad.top}
                width={series.length > 40 ? 8 : 16}
                height={chart.innerH}
                fill="transparent"
                onMouseEnter={() => setActive(row.day)}
              />
              <circle
                cx={chart.x(index)}
                cy={chart.y(row.remaining)}
                r={isActive ? 4.5 : series.length > 40 ? 0 : 2.5}
                fill={isActive ? "#4f46e5" : "#a5b4fc"}
              />
            </g>
          );
        })}
        {series.filter((_, index) => {
          const step = series.length > 40 ? 14 : series.length > 14 ? 4 : 1;
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
        Линия — сколько кредитов оставалось на конец дня. Считается от текущего баланса назад:
        ЮKassa и Stars минус списания генераций.
      </p>
    </div>
  );
}
