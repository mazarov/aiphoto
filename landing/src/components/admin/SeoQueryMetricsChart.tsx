"use client";

import { useMemo, useState } from "react";
import type { SeoDailyPoint } from "@/lib/seo-watchlist";

const SERIES = [
  { key: "impressions", label: "Показы", color: "#4f46e5", axis: "volume" },
  { key: "demand", label: "Спрос", color: "#7c3aed", axis: "volume" },
  { key: "clicks", label: "Клики", color: "#059669", axis: "volume" },
  { key: "ctr", label: "CTR %", color: "#d97706", axis: "rate" },
  { key: "position", label: "Позиция", color: "#e11d48", axis: "rate" },
] as const;

function valueOf(
  point: SeoDailyPoint,
  key: (typeof SERIES)[number]["key"],
): number | null {
  if (key === "impressions") return point.impressions;
  if (key === "clicks") return point.clicks;
  if (key === "demand") return point.demand;
  if (key === "ctr") return point.ctr;
  return point.position;
}

function formatTick(value: number): string {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}k`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

export function SeoQueryMetricsChart({ series }: { series: SeoDailyPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const chart = useMemo(() => {
    const width = 720;
    const height = 220;
    const pad = { top: 16, right: 44, bottom: 28, left: 44 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const volumeMax = Math.max(
      1,
      ...series.flatMap((point) => [point.impressions, point.clicks, point.demand ?? 0]),
    );
    const rateMax = Math.max(
      1,
      ...series.flatMap((point) => [point.ctr ?? 0, point.position ?? 0]),
    );
    const x = (index: number) =>
      pad.left + (series.length <= 1 ? innerW / 2 : (index / (series.length - 1)) * innerW);
    const yVolume = (value: number) => pad.top + innerH - (value / volumeMax) * innerH;
    const yRate = (value: number) => pad.top + innerH - (value / rateMax) * innerH;
    const paths = SERIES.map((item) => {
      const coords = series
        .map((point, index) => {
          const value = valueOf(point, item.key);
          if (value == null) return null;
          const y = item.axis === "volume" ? yVolume(value) : yRate(value);
          return `${x(index).toFixed(1)},${y.toFixed(1)}`;
        })
        .filter((coord): coord is string => coord != null);
      return { ...item, d: coords.length ? `M ${coords.join(" L ")}` : "" };
    });
    return { width, height, pad, innerH, x, volumeMax, rateMax, paths };
  }, [series]);

  if (series.length === 0) {
    return <p className="text-sm text-zinc-500">Нет точек за выбранные дни.</p>;
  }

  const active = hover != null ? series[hover] : null;

  return (
    <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-zinc-600">
        {SERIES.map((item) => (
          <span key={item.key} className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="h-56 w-full"
        role="img"
        aria-label="Динамика показов, спроса, кликов, CTR и позиции"
      >
        {[0, 0.5, 1].map((tick) => {
          const y = chart.pad.top + chart.innerH * (1 - tick);
          return (
            <g key={tick}>
              <line
                x1={chart.pad.left}
                x2={chart.width - chart.pad.right}
                y1={y}
                y2={y}
                stroke="#e4e4e7"
              />
              <text x={8} y={y + 4} className="fill-zinc-400 text-xs">
                {formatTick(chart.volumeMax * tick)}
              </text>
              <text
                x={chart.width - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-zinc-400 text-xs"
              >
                {formatTick(chart.rateMax * tick)}
              </text>
            </g>
          );
        })}
        {chart.paths.map((item) =>
          item.d ? (
            <path
              key={item.key}
              d={item.d}
              fill="none"
              stroke={item.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null,
        )}
        {series.map((point, index) =>
          SERIES.map((item) => {
            const value = valueOf(point, item.key);
            if (value == null) return null;
            const y =
              item.axis === "volume"
                ? chart.pad.top +
                  chart.innerH -
                  (value / chart.volumeMax) * chart.innerH
                : chart.pad.top + chart.innerH - (value / chart.rateMax) * chart.innerH;
            return (
              <circle
                key={`${item.key}-${point.date}`}
                cx={chart.x(index)}
                cy={y}
                r={hover === index || series.length === 1 ? 3.5 : 2}
                fill={item.color}
              />
            );
          }),
        )}
        {series.map((point, index) => (
          <g key={point.date}>
            <text
              x={chart.x(index)}
              y={chart.height - 8}
              textAnchor="middle"
              className="fill-zinc-400 text-xs"
            >
              {point.date.slice(5)}
            </text>
            <rect
              x={chart.x(index) - 10}
              y={chart.pad.top}
              width="20"
              height={chart.innerH}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
            />
            {hover === index ? (
              <line
                x1={chart.x(index)}
                x2={chart.x(index)}
                y1={chart.pad.top}
                y2={chart.pad.top + chart.innerH}
                stroke="#a1a1aa"
                strokeDasharray="3 3"
              />
            ) : null}
          </g>
        ))}
      </svg>
      {active ? (
        <p className="mt-2 text-xs text-zinc-600">
          {active.date}: показы {Math.round(active.impressions)}, спрос{" "}
          {active.demand == null ? "—" : Math.round(active.demand)}, клики{" "}
          {Math.round(active.clicks)}, CTR{" "}
          {active.ctr == null ? "—" : `${active.ctr.toFixed(1)}%`}, позиция{" "}
          {active.position == null ? "—" : active.position.toFixed(1)}
        </p>
      ) : (
        <p className="mt-2 text-xs text-zinc-400">
          Наведите на день. Слева — объёмы, справа — CTR и позиция.
        </p>
      )}
    </div>
  );
}
