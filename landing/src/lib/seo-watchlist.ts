export type SeoDailyPoint = {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number | null;
  position: number | null;
  demand: number | null;
};

export type SeoMetricBlock = {
  impressions: number;
  clicks: number;
  ctr: number | null;
  position: number | null;
  demand: number | null;
};

export type SeoDeltaBlock = {
  impressions: number;
  clicks: number;
  ctr: number | null;
  position: number | null;
  demand: number | null;
};

export type SeoQueryRow = {
  query: string;
  complementaryUrl: string | null;
  current: SeoMetricBlock;
  previous: SeoMetricBlock;
  delta: SeoDeltaBlock;
  series: SeoDailyPoint[];
};

export type SeoPageRow = {
  path: string;
  current: SeoMetricBlock;
  previous: SeoMetricBlock;
  delta: SeoDeltaBlock;
  series: SeoDailyPoint[];
  queries: SeoQueryRow[];
};

export type SeoWatchlistSnapshot = {
  generatedAt: string;
  source: "webmaster_query_analytics";
  grainWindow: { from: string; to: string } | null;
  compare: {
    currentFrom: string;
    currentTo: string;
    previousFrom: string;
    previousTo: string;
  } | null;
  pages: SeoPageRow[];
};

type RawStat = { date?: string; field?: string; value?: number };

export function uniqueSortedDates(stats: RawStat[]): string[] {
  return [...new Set(stats.map((item) => String(item.date || "")).filter(Boolean))].sort();
}

export function splitCompareWindows(dates: string[]): {
  previous: string[];
  current: string[];
} | null {
  if (dates.length < 4) return null;
  const mid = Math.floor(dates.length / 2);
  return {
    previous: dates.slice(0, mid),
    current: dates.slice(mid),
  };
}

export function pointsFromStatistics(stats: RawStat[]): SeoDailyPoint[] {
  const byDate = new Map<string, SeoDailyPoint>();
  for (const item of stats) {
    const date = String(item.date || "");
    if (!date) continue;
    const point = byDate.get(date) || {
      date,
      impressions: 0,
      clicks: 0,
      ctr: null,
      position: null,
      demand: null,
    };
    const value = Number(item.value);
    if (!Number.isFinite(value)) {
      byDate.set(date, point);
      continue;
    }
    if (item.field === "IMPRESSIONS") point.impressions = value;
    if (item.field === "CLICKS") point.clicks = value;
    if (item.field === "DEMAND") point.demand = value;
    if (item.field === "CTR") point.ctr = value;
    if (item.field === "POSITION") point.position = value;
    byDate.set(date, point);
  }
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => ({
      ...point,
      ctr:
        point.impressions > 0
          ? (point.clicks / point.impressions) * 100
          : point.ctr,
    }));
}

export function aggregatePoints(
  points: SeoDailyPoint[],
  dates?: string[],
): SeoMetricBlock {
  const set = dates ? new Set(dates) : null;
  const picked = set ? points.filter((point) => set.has(point.date)) : points;
  const impressions = picked.reduce((sum, point) => sum + point.impressions, 0);
  const clicks = picked.reduce((sum, point) => sum + point.clicks, 0);
  const demandValues = picked
    .map((point) => point.demand)
    .filter((value): value is number => value != null);
  const positions = picked
    .filter((point) => point.position != null && point.impressions > 0)
    .map((point) => ({ position: point.position as number, weight: point.impressions }));
  const positionWeight = positions.reduce((sum, item) => sum + item.weight, 0);
  return {
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    position:
      positionWeight > 0
        ? positions.reduce((sum, item) => sum + item.position * item.weight, 0) /
          positionWeight
        : null,
    demand: demandValues.length > 0 ? demandValues.reduce((a, b) => a + b, 0) : null,
  };
}

export function deltaBlocks(
  current: SeoMetricBlock,
  previous: SeoMetricBlock,
): SeoDeltaBlock {
  return {
    impressions: current.impressions - previous.impressions,
    clicks: current.clicks - previous.clicks,
    ctr:
      current.ctr != null && previous.ctr != null ? current.ctr - previous.ctr : null,
    position:
      current.position != null && previous.position != null
        ? current.position - previous.position
        : null,
    demand:
      current.demand != null && previous.demand != null
        ? current.demand - previous.demand
        : null,
  };
}

export function emptySnapshot(): SeoWatchlistSnapshot {
  return {
    generatedAt: "",
    source: "webmaster_query_analytics",
    grainWindow: null,
    compare: null,
    pages: [],
  };
}

export function snapshotDates(snapshot: SeoWatchlistSnapshot): string[] {
  const dates = new Set<string>();
  if (snapshot.grainWindow) {
    dates.add(snapshot.grainWindow.from);
    dates.add(snapshot.grainWindow.to);
  }
  for (const page of snapshot.pages) {
    for (const point of page.series) dates.add(point.date);
    for (const query of page.queries) {
      for (const point of query.series) dates.add(point.date);
    }
  }
  return [...dates].sort();
}

export function datesInRange(dates: string[], from: string, to: string): string[] {
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  return dates.filter((date) => date >= start && date <= end);
}

export function previousEqualWindow(
  dates: string[],
  from: string,
  to: string,
): string[] {
  const selected = datesInRange(dates, from, to);
  if (selected.length === 0) return [];
  const startIdx = dates.indexOf(selected[0]);
  if (startIdx <= 0) return [];
  return dates.slice(Math.max(0, startIdx - selected.length), startIdx);
}

function viewFromSeries(
  series: SeoDailyPoint[],
  from: string,
  to: string,
  allDates: string[],
) {
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const currentDates = datesInRange(allDates, start, end);
  const previousDates = previousEqualWindow(allDates, start, end);
  const current = aggregatePoints(series, currentDates);
  const previous = aggregatePoints(series, previousDates);
  return {
    current,
    previous,
    delta: deltaBlocks(current, previous),
    series: series.filter((point) => point.date >= start && point.date <= end),
  };
}

export function projectPageToRange(
  page: SeoPageRow,
  from: string,
  to: string,
  allDates: string[],
): SeoPageRow {
  const pageView = viewFromSeries(page.series, from, to, allDates);
  return {
    path: page.path,
    ...pageView,
    queries: page.queries.map((query) => ({
      query: query.query,
      complementaryUrl: query.complementaryUrl,
      ...viewFromSeries(query.series, from, to, allDates),
    })),
  };
}
