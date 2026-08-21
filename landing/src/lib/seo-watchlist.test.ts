import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregatePoints,
  datesInRange,
  deltaBlocks,
  mappedQueryCoverage,
  pointsFromStatistics,
  previousEqualWindow,
  projectPageToRange,
  queryBelongsToPath,
  sortQueryRows,
  splitCompareWindows,
} from "./seo-watchlist";

test("pointsFromStatistics folds daily fields and recalculates CTR", () => {
  const points = pointsFromStatistics([
    { date: "2026-08-10", field: "IMPRESSIONS", value: 100 },
    { date: "2026-08-10", field: "CLICKS", value: 10 },
    { date: "2026-08-10", field: "CTR", value: 99 },
    { date: "2026-08-10", field: "POSITION", value: 4.2 },
    { date: "2026-08-10", field: "DEMAND", value: 120 },
    { date: "2026-08-11", field: "IMPRESSIONS", value: 50 },
    { date: "2026-08-11", field: "CLICKS", value: 0 },
  ]);
  assert.equal(points.length, 2);
  assert.equal(points[0]?.ctr, 10);
  assert.equal(points[1]?.ctr, 0);
  assert.equal(points[0]?.demand, 120);
});

test("splitCompareWindows halves dates for cabinet-style deltas", () => {
  const split = splitCompareWindows([
    "2026-08-06",
    "2026-08-07",
    "2026-08-08",
    "2026-08-09",
    "2026-08-10",
    "2026-08-11",
  ]);
  assert.deepEqual(split?.previous, ["2026-08-06", "2026-08-07", "2026-08-08"]);
  assert.deepEqual(split?.current, ["2026-08-09", "2026-08-10", "2026-08-11"]);
  assert.equal(splitCompareWindows(["2026-08-06", "2026-08-07"]), null);
});

test("aggregatePoints and deltaBlocks compare two halves", () => {
  const points = pointsFromStatistics([
    { date: "2026-08-06", field: "IMPRESSIONS", value: 100 },
    { date: "2026-08-06", field: "CLICKS", value: 4 },
    { date: "2026-08-07", field: "IMPRESSIONS", value: 100 },
    { date: "2026-08-07", field: "CLICKS", value: 6 },
    { date: "2026-08-08", field: "IMPRESSIONS", value: 200 },
    { date: "2026-08-08", field: "CLICKS", value: 40 },
    { date: "2026-08-09", field: "IMPRESSIONS", value: 200 },
    { date: "2026-08-09", field: "CLICKS", value: 20 },
  ]);
  const previous = aggregatePoints(points, ["2026-08-06", "2026-08-07"]);
  const current = aggregatePoints(points, ["2026-08-08", "2026-08-09"]);
  const delta = deltaBlocks(current, previous);
  assert.equal(previous.impressions, 200);
  assert.equal(current.impressions, 400);
  assert.equal(delta.impressions, 200);
  assert.equal(delta.clicks, 50);
  assert.ok(delta.ctr != null && delta.ctr > 0);
});

test("datesInRange and previousEqualWindow support day filter", () => {
  const dates = [
    "2026-08-06",
    "2026-08-07",
    "2026-08-08",
    "2026-08-09",
    "2026-08-10",
  ];
  assert.deepEqual(datesInRange(dates, "2026-08-09", "2026-08-10"), [
    "2026-08-09",
    "2026-08-10",
  ]);
  assert.deepEqual(previousEqualWindow(dates, "2026-08-09", "2026-08-10"), [
    "2026-08-07",
    "2026-08-08",
  ]);
  assert.deepEqual(previousEqualWindow(dates, "2026-08-06", "2026-08-06"), []);
});

test("projectPageToRange recomputes page and query totals for selected days", () => {
  const page = projectPageToRange(
    {
      path: "/",
      current: {
        impressions: 0,
        clicks: 0,
        ctr: null,
        position: null,
        demand: null,
      },
      previous: {
        impressions: 0,
        clicks: 0,
        ctr: null,
        position: null,
        demand: null,
      },
      delta: {
        impressions: 0,
        clicks: 0,
        ctr: null,
        position: null,
        demand: null,
      },
      series: [
        {
          date: "2026-08-06",
          impressions: 100,
          clicks: 10,
          ctr: 10,
          position: 4,
          demand: null,
        },
        {
          date: "2026-08-07",
          impressions: 200,
          clicks: 40,
          ctr: 20,
          position: 3,
          demand: null,
        },
      ],
      queries: [
        {
          query: "промты для фото",
          complementaryUrl: "/",
          current: {
            impressions: 0,
            clicks: 0,
            ctr: null,
            position: null,
            demand: null,
          },
          previous: {
            impressions: 0,
            clicks: 0,
            ctr: null,
            position: null,
            demand: null,
          },
          delta: {
            impressions: 0,
            clicks: 0,
            ctr: null,
            position: null,
            demand: null,
          },
          series: [
            {
              date: "2026-08-06",
              impressions: 50,
              clicks: 5,
              ctr: 10,
              position: 3,
              demand: 60,
            },
            {
              date: "2026-08-07",
              impressions: 80,
              clicks: 16,
              ctr: 20,
              position: 2,
              demand: 90,
            },
          ],
        },
      ],
    },
    "2026-08-07",
    "2026-08-07",
    ["2026-08-06", "2026-08-07"],
  );
  assert.equal(page.current.impressions, 200);
  assert.equal(page.delta.impressions, 100);
  assert.equal(page.queries[0]?.current.demand, 90);
  assert.equal(page.queries[0]?.series.length, 1);
});

test("queryBelongsToPath keeps owner URL and empty complementary", () => {
  assert.equal(queryBelongsToPath("/", "/"), true);
  assert.equal(queryBelongsToPath("https://promptshot.ru/", "/"), true);
  assert.equal(queryBelongsToPath("/promty-dlya-foto-par/", "/promty-dlya-foto-par"), true);
  assert.equal(queryBelongsToPath("/foto-v-promt", "/"), false);
  assert.equal(queryBelongsToPath(null, "/"), true);
});

test("sortQueryRows orders by impressions or clicks", () => {
  const empty = {
    impressions: 0,
    clicks: 0,
    ctr: null,
    position: null,
    demand: null,
  };
  const rows = [
    {
      query: "промты",
      complementaryUrl: "/",
      current: { ...empty, impressions: 100, clicks: 40 },
      previous: empty,
      delta: empty,
      series: [],
    },
    {
      query: "промты для фото",
      complementaryUrl: "/",
      current: { ...empty, impressions: 300, clicks: 10 },
      previous: empty,
      delta: empty,
      series: [],
    },
  ];
  assert.deepEqual(
    sortQueryRows(rows, "impressions").map((row) => row.query),
    ["промты для фото", "промты"],
  );
  assert.deepEqual(
    sortQueryRows(rows, "clicks").map((row) => row.query),
    ["промты", "промты для фото"],
  );
});

test("mappedQueryCoverage compares query sum to page total", () => {
  const empty = {
    impressions: 0,
    clicks: 0,
    ctr: null,
    position: null,
    demand: null,
  };
  const coverage = mappedQueryCoverage({
    path: "/",
    current: { ...empty, impressions: 1000, clicks: 100 },
    previous: empty,
    delta: empty,
    series: [],
    queries: [
      {
        query: "а",
        complementaryUrl: "/",
        current: { ...empty, impressions: 200, clicks: 20 },
        previous: empty,
        delta: empty,
        series: [],
      },
    ],
  });
  assert.equal(coverage.queries, 1);
  assert.equal(coverage.clickShare, 0.2);
  assert.equal(coverage.impressionShare, 0.2);
});
