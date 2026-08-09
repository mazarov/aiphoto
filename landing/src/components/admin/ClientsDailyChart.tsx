"use client";

import type { ClientsDailyRow } from "@/lib/analytics-data";
import { CLIENT_SOURCES_ORDER, clientSourceColor, clientSourceLabel } from "./analytics-constants";

export function ClientsDailyChart({ rows, kind, source }: {
  rows: ClientsDailyRow[]; kind: string; source: string;
}) {
  const days = new Map<string, Record<string, number>>();
  for (const row of rows) {
    if (kind !== "all" && row.kind !== kind) continue;
    if (source !== "all" && row.client_source !== source) continue;
    const day = row.day.slice(0, 10);
    const values = days.get(day) || {};
    values[row.client_source] = (values[row.client_source] || 0) + row.requests;
    days.set(day, values);
  }
  const series = [...days].sort(([a], [b]) => a.localeCompare(b));
  const sources = CLIENT_SOURCES_ORDER.filter((item) => series.some(([, values]) => values[item]));
  const max = Math.max(1, ...series.map(([, values]) => Object.values(values).reduce((a, b) => a + b, 0)));
  if (!series.length) return <div className="rounded-2xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">Нет данных</div>;
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-zinc-600">
        {sources.map((item) => <span key={item} className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm" style={{ background: clientSourceColor(item) }} />
          {clientSourceLabel(item)}
        </span>)}
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex h-52 min-w-[520px] items-end gap-2">
          {series.map(([day, values]) => {
            const total = Object.values(values).reduce((a, b) => a + b, 0);
            return <div key={day} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[10px] font-medium text-zinc-500">{total}</span>
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-lg bg-zinc-100"
                style={{ height: Math.max(3, (total / max) * 160) }}>
                {sources.map((item) => values[item] ? <i key={item} style={{
                  height: `${(values[item] / total) * 100}%`, background: clientSourceColor(item),
                }} title={`${clientSourceLabel(item)}: ${values[item]}`} /> : null)}
              </div>
              <span className="text-[10px] text-zinc-400">{day.slice(5)}</span>
            </div>;
          })}
        </div>
      </div>
    </div>
  );
}
