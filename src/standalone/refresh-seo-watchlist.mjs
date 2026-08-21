#!/usr/bin/env node
/**
 * Refresh landing/src/data/seo-watchlist-snapshot.json from Webmaster
 * query-analytics (last ~14 days). Read-only. Sequential to stay under 429.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadEnvFile,
  resolveWebmasterHost,
  webmasterUrl,
  yandexFetch,
} from "./mcp-yandex-seo-lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LANDING = resolve(ROOT, "landing");
loadEnvFile(resolve(ROOT, ".cursor/yandex-seo.env"));

const PATHS = JSON.parse(
  readFileSync(resolve(LANDING, "src/data/seo-watchlist-paths.json"), "utf8"),
);

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function uniqueSortedDates(stats) {
  return [...new Set(stats.map((item) => String(item.date || "")).filter(Boolean))].sort();
}

function splitCompareWindows(dates) {
  if (dates.length < 4) return null;
  const mid = Math.floor(dates.length / 2);
  return { previous: dates.slice(0, mid), current: dates.slice(mid) };
}

function pointsFromStatistics(stats) {
  const byDate = new Map();
  for (const item of stats || []) {
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
    if (Number.isFinite(value)) {
      if (item.field === "IMPRESSIONS") point.impressions = value;
      if (item.field === "CLICKS") point.clicks = value;
      if (item.field === "DEMAND") point.demand = value;
      if (item.field === "CTR") point.ctr = value;
      if (item.field === "POSITION") point.position = value;
    }
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

function aggregatePoints(points, dates) {
  const set = dates ? new Set(dates) : null;
  const picked = set ? points.filter((point) => set.has(point.date)) : points;
  const impressions = picked.reduce((sum, point) => sum + point.impressions, 0);
  const clicks = picked.reduce((sum, point) => sum + point.clicks, 0);
  const demandValues = picked
    .map((point) => point.demand)
    .filter((value) => value != null);
  const positions = picked
    .filter((point) => point.position != null && point.impressions > 0)
    .map((point) => ({ position: point.position, weight: point.impressions }));
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

function deltaBlocks(current, previous) {
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

function summarize(points, windows) {
  const current = aggregatePoints(points, windows?.current);
  const previous = aggregatePoints(points, windows?.previous);
  return { current, previous, delta: deltaBlocks(current, previous), series: points };
}

async function queryAnalytics(userId, hostId, body) {
  return yandexFetch(
    webmasterUrl(
      `/user/${userId}/hosts/${encodeURIComponent(hostId)}/query-analytics/list`,
    ),
    { method: "POST", body },
  );
}

function rowsOf(data) {
  return Array.isArray(data?.text_indicator_to_statistics)
    ? data.text_indicator_to_statistics
    : [];
}

const { userId, host } = await resolveWebmasterHost();
process.stderr.write(`[seo-watchlist] host=${host.host_id} pages=${PATHS.length}\n`);

const urlDump = await queryAnalytics(userId, host.host_id, {
  offset: 0,
  limit: 80,
  device_type_indicator: "ALL",
  text_indicator: "URL",
});
const urlByPath = new Map(
  rowsOf(urlDump).map((row) => [row.text_indicator?.value, row]),
);

const pages = [];
for (const path of PATHS) {
  let urlRow = urlByPath.get(path);
  if (!urlRow) {
    const extra = await queryAnalytics(userId, host.host_id, {
      offset: 0,
      limit: 1,
      device_type_indicator: "ALL",
      text_indicator: "URL",
      filters: {
        text_filters: [
          { text_indicator: "URL", operation: "TEXT_MATCH", value: path },
        ],
      },
    });
    urlRow = rowsOf(extra)[0] || null;
    await sleep(150);
  }

  const queryData = await queryAnalytics(userId, host.host_id, {
    offset: 0,
    limit: 20,
    device_type_indicator: "ALL",
    text_indicator: "QUERY",
    filters: {
      text_filters: [
        { text_indicator: "URL", operation: "TEXT_MATCH", value: path },
      ],
    },
  });
  await sleep(150);

  const pagePoints = pointsFromStatistics(urlRow?.statistics || []);
  const queryRows = rowsOf(queryData).map((row) =>
    pointsFromStatistics(row.statistics || []),
  );
  const allDates = uniqueSortedDates(
    [...pagePoints, ...queryRows.flat()].map((point) => ({ date: point.date })),
  );
  const split = splitCompareWindows(allDates);
  const page = summarize(pagePoints, split);
  pages.push({
    path,
    ...page,
    queries: rowsOf(queryData).map((row, index) => ({
      query: row.text_indicator?.value || "",
      complementaryUrl: row.popular_complementary_indicator?.value || null,
      ...summarize(queryRows[index] || [], split),
    })),
  });
  process.stderr.write(`[seo-watchlist] ${path} queries=${rowsOf(queryData).length}\n`);
}

const allDates = uniqueSortedDates(
  pages.flatMap((page) => page.series.map((point) => ({ date: point.date }))),
);
const split = splitCompareWindows(allDates);
const snapshot = {
  generatedAt: new Date().toISOString(),
  source: "webmaster_query_analytics",
  grainWindow:
    allDates.length > 0
      ? { from: allDates[0], to: allDates[allDates.length - 1] }
      : null,
  compare: split
    ? {
        currentFrom: split.current[0],
        currentTo: split.current[split.current.length - 1],
        previousFrom: split.previous[0],
        previousTo: split.previous[split.previous.length - 1],
      }
    : null,
  pages,
};

const out = resolve(LANDING, "src/data/seo-watchlist-snapshot.json");
writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);
process.stderr.write(`[seo-watchlist] wrote ${out}\n`);
