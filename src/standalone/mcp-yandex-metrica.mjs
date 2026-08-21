#!/usr/bin/env node
/**
 * Minimal stdio MCP: read-only Yandex Metrica Reporting + Management API.
 *
 * Env (from .cursor/yandex-seo.env via mcp.json envFile):
 *   YANDEX_SEO_TOKEN
 *   YANDEX_METRIKA_COUNTER_ID  optional, default 107703100
 *
 * tools:
 *   metrica_status
 *   organic_landings
 *   organic_sources
 *   report
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clampInt,
  dateRange,
  getMetrikaCounterId,
  getSeoToken,
  jsonResult,
  loadEnvFile,
  metrikaUrl,
  runMcpServer,
  yandexFetch,
} from "./mcp-yandex-seo-lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvFile(
  process.env.YANDEX_SEO_ENV_FILE || resolve(ROOT, ".cursor/yandex-seo.env"),
);

const ALLOWED_METRICS = new Set([
  "ym:s:visits",
  "ym:s:users",
  "ym:s:pageviews",
  "ym:s:bounceRate",
  "ym:s:pageDepth",
  "ym:s:avgVisitDurationSeconds",
  "ym:s:goalReachesAny",
]);

const ALLOWED_DIMENSIONS = new Set([
  "ym:s:startURL",
  "ym:s:startURLPath",
  "ym:s:lastTrafficSource",
  "ym:s:lastSearchEngine",
  "ym:s:deviceCategory",
  "ym:s:date",
  "ym:s:pagePath",
]);

const ORGANIC_FILTER = "ym:s:lastTrafficSource=='organic'";

const TOOLS = [
  {
    name: "metrica_status",
    description:
      "Check Metrica OAuth env and that the default counter is visible. Never returns the token.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "organic_landings",
    description:
      "Organic search landings: visits, users, bounce rate, depth, duration. Default period is 28 days.",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Period length in days, 1–90. Default 28.",
        },
        limit: {
          type: "number",
          description: "Rows to return, 1–100. Default 30.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "organic_sources",
    description:
      "Organic traffic split by search engine. Default period is 28 days.",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Period length in days, 1–90. Default 28.",
        },
        limit: {
          type: "number",
          description: "Rows to return, 1–50. Default 20.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "report",
    description:
      "Narrow Metrica report. Only allowlisted metrics/dimensions. Default period is 28 days.",
    inputSchema: {
      type: "object",
      properties: {
        metrics: {
          type: "array",
          items: { type: "string" },
          description: "Allowlisted ym:s:* metrics.",
        },
        dimensions: {
          type: "array",
          items: { type: "string" },
          description: "Allowlisted ym:s:* dimensions. Optional.",
        },
        filters: {
          type: "string",
          description: "Optional Metrica filter expression.",
        },
        days: {
          type: "number",
          description: "Period length in days, 1–90. Default 28.",
        },
        limit: {
          type: "number",
          description: "Rows to return, 1–100. Default 30.",
        },
      },
      required: ["metrics"],
      additionalProperties: false,
    },
  },
];

function parseDataTable(data) {
  const metricNames = (data?.query?.metrics || []).map((name) =>
    String(name),
  );
  const dimensionNames = (data?.query?.dimensions || []).map((name) =>
    String(name),
  );
  const rows = Array.isArray(data?.data) ? data.data : [];
  return rows.map((row) => {
    const dimensions = {};
    (row.dimensions || []).forEach((dim, i) => {
      const key = dimensionNames[i] || `dim_${i}`;
      dimensions[key] = dim?.name ?? dim?.id ?? null;
    });
    const metrics = {};
    (row.metrics || []).forEach((value, i) => {
      const key = metricNames[i] || `metric_${i}`;
      metrics[key] = value;
    });
    return { dimensions, metrics };
  });
}

async function fetchReport({
  metrics,
  dimensions,
  filters,
  days,
  limit,
  sort,
}) {
  const range = dateRange(days, 28);
  const ids = getMetrikaCounterId();
  const query = {
    ids,
    metrics: metrics.join(","),
    date1: range.date_from,
    date2: range.date_to,
    limit: clampInt(limit, 1, 100, 30),
    accuracy: 1,
    lang: "ru",
  };
  if (dimensions?.length) query.dimensions = dimensions.join(",");
  if (filters) query.filters = filters;
  if (sort) query.sort = sort;
  const data = await yandexFetch(metrikaUrl("/stat/v1/data", query));
  return {
    counter_id: ids,
    requested: range,
    totals: data?.totals ?? null,
    row_count: data?.data?.length ?? 0,
    rows: parseDataTable(data),
  };
}

async function handleStatus() {
  const configured = Boolean(getSeoToken());
  let counterId = null;
  try {
    counterId = getMetrikaCounterId();
  } catch (err) {
    return jsonResult(
      { configured, error: err instanceof Error ? err.message : String(err) },
      true,
    );
  }
  if (!configured) {
    return jsonResult({
      configured: false,
      counter_id: counterId,
      note: "Add YANDEX_SEO_TOKEN to .cursor/yandex-seo.env",
    });
  }
  const payload = await yandexFetch(
    metrikaUrl(`/management/v1/counter/${counterId}`),
  );
  const counter = payload?.counter || payload;
  return jsonResult({
    configured: true,
    token_set: true,
    counter_id: counterId,
    name: counter?.name ?? null,
    site: counter?.site ?? null,
    code_status: counter?.code_status ?? null,
  });
}

async function handleOrganicLandings(args) {
  const report = await fetchReport({
    metrics: [
      "ym:s:visits",
      "ym:s:users",
      "ym:s:bounceRate",
      "ym:s:pageDepth",
      "ym:s:avgVisitDurationSeconds",
    ],
    dimensions: ["ym:s:startURL"],
    filters: ORGANIC_FILTER,
    days: args?.days,
    limit: args?.limit,
    sort: "-ym:s:visits",
  });
  return jsonResult({
    ...report,
    filter: ORGANIC_FILTER,
    landings: report.rows.map((row) => ({
      url: row.dimensions["ym:s:startURL"],
      visits: row.metrics["ym:s:visits"],
      users: row.metrics["ym:s:users"],
      bounce_rate: row.metrics["ym:s:bounceRate"],
      page_depth: row.metrics["ym:s:pageDepth"],
      avg_visit_seconds: row.metrics["ym:s:avgVisitDurationSeconds"],
    })),
  });
}

async function handleOrganicSources(args) {
  const report = await fetchReport({
    metrics: ["ym:s:visits", "ym:s:users", "ym:s:bounceRate"],
    dimensions: ["ym:s:lastSearchEngine"],
    filters: ORGANIC_FILTER,
    days: args?.days,
    limit: clampInt(args?.limit, 1, 50, 20),
    sort: "-ym:s:visits",
  });
  return jsonResult({
    ...report,
    filter: ORGANIC_FILTER,
    sources: report.rows.map((row) => ({
      search_engine: row.dimensions["ym:s:lastSearchEngine"],
      visits: row.metrics["ym:s:visits"],
      users: row.metrics["ym:s:users"],
      bounce_rate: row.metrics["ym:s:bounceRate"],
    })),
  });
}

async function handleReport(args) {
  const metrics = Array.isArray(args?.metrics)
    ? args.metrics.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const dimensions = Array.isArray(args?.dimensions)
    ? args.dimensions.map((item) => String(item).trim()).filter(Boolean)
    : [];
  if (metrics.length === 0) {
    return jsonResult({ error: "`metrics` is required" }, true);
  }
  const badMetrics = metrics.filter((item) => !ALLOWED_METRICS.has(item));
  const badDimensions = dimensions.filter(
    (item) => !ALLOWED_DIMENSIONS.has(item),
  );
  if (badMetrics.length || badDimensions.length) {
    return jsonResult(
      {
        error: "Only allowlisted metrics/dimensions are accepted",
        rejected_metrics: badMetrics,
        rejected_dimensions: badDimensions,
        allowed_metrics: [...ALLOWED_METRICS],
        allowed_dimensions: [...ALLOWED_DIMENSIONS],
      },
      true,
    );
  }
  const filters =
    typeof args?.filters === "string" && args.filters.trim()
      ? args.filters.trim()
      : undefined;
  if (filters && /[\r\n]/.test(filters)) {
    return jsonResult({ error: "filters must be a single line" }, true);
  }
  const report = await fetchReport({
    metrics,
    dimensions,
    filters,
    days: args?.days,
    limit: args?.limit,
    sort: `-${metrics[0]}`,
  });
  return jsonResult(report);
}

async function handleToolCall(name, args) {
  if (name === "metrica_status") return handleStatus();
  if (name === "organic_landings") return handleOrganicLandings(args);
  if (name === "organic_sources") return handleOrganicSources(args);
  if (name === "report") return handleReport(args);
  return jsonResult({ error: `Unknown tool: ${name}` }, true);
}

runMcpServer({
  name: "yandex-metrica",
  version: "1.0.0",
  tools: TOOLS,
  handleToolCall,
});
