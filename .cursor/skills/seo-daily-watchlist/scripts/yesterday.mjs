#!/usr/bin/env node
/**
 * Compact yesterday vs previous-day payload for the SEO daily skill.
 * Do not print the full snapshot — stdout is JSON only.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const snapshotPath = join(root, "landing/src/data/seo-watchlist-snapshot.json");
const pathsFile = join(root, "landing/src/data/seo-watchlist-paths.json");

if (!existsSync(snapshotPath)) {
  console.error(JSON.stringify({ error: "missing_snapshot", snapshotPath }));
  process.exit(1);
}

const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
const watchlist = existsSync(pathsFile)
  ? new Set(JSON.parse(readFileSync(pathsFile, "utf8")))
  : null;

const pages = (snapshot.pages || []).filter((page) =>
  watchlist ? watchlist.has(page.path) : true,
);

const dates = [
  ...new Set(
    pages.flatMap((page) => (page.series || []).map((point) => point.date)),
  ),
].sort();

const webmasterDay = dates[dates.length - 1] || null;
const baselineDay = dates.length >= 2 ? dates[dates.length - 2] : null;
const today = new Date().toISOString().slice(0, 10);
const lagDays =
  webmasterDay && today > webmasterDay
    ? Math.round(
        (Date.parse(`${today}T00:00:00Z`) -
          Date.parse(`${webmasterDay}T00:00:00Z`)) /
          86400000,
      )
    : 0;

function onDate(series, date) {
  return (series || []).find((point) => point.date === date) || null;
}

function delta(day, prev) {
  if (!day || !prev) return null;
  return {
    impressions: day.impressions - prev.impressions,
    clicks: day.clicks - prev.clicks,
    ctr:
      day.ctr != null && prev.ctr != null ? round(day.ctr - prev.ctr, 2) : null,
    position:
      day.position != null && prev.position != null
        ? round(day.position - prev.position, 2)
        : null,
    demand:
      day.demand != null && prev.demand != null
        ? day.demand - prev.demand
        : null,
  };
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function compactPoint(point) {
  if (!point) return null;
  return {
    impressions: point.impressions,
    clicks: point.clicks,
    ctr: point.ctr == null ? null : round(point.ctr, 2),
    position: point.position == null ? null : round(point.position, 1),
    demand: point.demand,
  };
}

function scorePage(day, change) {
  if (!day || !change) return { score: 0, reasons: ["no_baseline"] };
  const reasons = [];
  let score = Math.abs(change.clicks) * 8 + Math.abs(change.impressions) * 0.04;
  if (change.clicks <= -8) reasons.push("lost_clicks");
  if (change.clicks >= 8) reasons.push("gained_clicks");
  if (
    change.position != null &&
    change.position >= 0.5 &&
    day.impressions >= 80
  ) {
    score += day.impressions * change.position * 0.12;
    reasons.push("position_worse");
  }
  if (
    change.ctr != null &&
    change.ctr <= -2 &&
    (day.position ?? 99) <= 10 &&
    day.impressions >= 50
  ) {
    score += Math.abs(change.ctr) * day.impressions * 0.15;
    reasons.push("ctr_drop");
  }
  if (reasons.length === 0 && score > 0) reasons.push("volume_move");
  return { score: round(score, 1), reasons };
}

const pageRows = pages.map((page) => {
  const day = onDate(page.series, webmasterDay);
  const prev = onDate(page.series, baselineDay);
  const change = delta(day, prev);
  const ranked = scorePage(day, change);
  const queries = (page.queries || [])
    .map((row) => {
      const qDay = onDate(row.series, webmasterDay);
      const qPrev = onDate(row.series, baselineDay);
      const qChange = delta(qDay, qPrev);
      return {
        query: row.query,
        ...compactPoint(qDay),
        delta: qChange,
        absClicks: Math.abs(qChange?.clicks || 0),
      };
    })
    .filter((row) => row.impressions != null)
    .sort((a, b) => b.absClicks - a.absClicks)
    .slice(0, 3)
    .map(({ absClicks: _abs, ...row }) => row);
  return {
    path: page.path,
    ...compactPoint(day),
    delta: change,
    score: ranked.score,
    reasons: ranked.reasons,
    queries,
  };
});

pageRows.sort((a, b) => b.score - a.score);

const site = pageRows.reduce(
  (acc, page) => {
    acc.impressions += page.impressions || 0;
    acc.clicks += page.clicks || 0;
    acc.deltaImpressions += page.delta?.impressions || 0;
    acc.deltaClicks += page.delta?.clicks || 0;
    return acc;
  },
  { impressions: 0, clicks: 0, deltaImpressions: 0, deltaClicks: 0 },
);

site.ctr = site.impressions > 0 ? round((site.clicks / site.impressions) * 100, 2) : null;

console.log(
  JSON.stringify(
    {
      calendarToday: today,
      webmasterDay,
      baselineDay,
      lagDays,
      generatedAt: snapshot.generatedAt || null,
      grainWindow: snapshot.grainWindow || null,
      watchlistSize: pageRows.length,
      site,
      top: pageRows.slice(0, 8),
    },
    null,
    2,
  ),
);
