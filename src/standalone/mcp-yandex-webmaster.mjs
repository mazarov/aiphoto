#!/usr/bin/env node
/**
 * Minimal stdio MCP: read-only Yandex Webmaster API v4.
 *
 * Env (from .cursor/yandex-seo.env via mcp.json envFile):
 *   YANDEX_SEO_TOKEN
 *   YANDEX_WEBMASTER_HOST_URL  optional, default https://promptshot.ru
 *
 * tools:
 *   webmaster_status
 *   list_hosts
 *   search_queries
 *   search_urls
 *   indexing_summary
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clampInt,
  dateRange,
  getSeoToken,
  jsonResult,
  loadEnvFile,
  resolveWebmasterHost,
  runMcpServer,
  webmasterUrl,
  yandexFetch,
} from "./mcp-yandex-seo-lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvFile(
  process.env.YANDEX_SEO_ENV_FILE || resolve(ROOT, ".cursor/yandex-seo.env"),
);

const QUERY_INDICATORS = [
  "TOTAL_SHOWS",
  "TOTAL_CLICKS",
  "AVG_SHOW_POSITION",
  "AVG_CLICK_POSITION",
];

const TOOLS = [
  {
    name: "webmaster_status",
    description:
      "Check Webmaster OAuth env and resolve the default host. Never returns the token.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_hosts",
    description: "List sites available to the Webmaster OAuth token.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "search_queries",
    description:
      "Top Yandex Webmaster search queries: impressions, clicks, CTR, average position. Default period is 28 days.",
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
        order_by: {
          type: "string",
          enum: ["TOTAL_SHOWS", "TOTAL_CLICKS"],
          description: "Sort field. Default TOTAL_SHOWS.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_urls",
    description:
      "Search analytics grouped by URL (Webmaster query-analytics). Official data window is about the last 14 days.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Rows to return, 1–20. Default 20.",
        },
        url_contains: {
          type: "string",
          description: "Optional URL substring filter.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "indexing_summary",
    description:
      "Read-only host + sitemap snapshot. Does not request recrawl.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

function hostPath(userId, hostId) {
  return `/user/${userId}/hosts/${encodeURIComponent(hostId)}`;
}

function pickIndicator(indicators, key) {
  if (!indicators || typeof indicators !== "object") return null;
  const value = indicators[key];
  return typeof value === "number" ? value : null;
}

function normalizeQuery(row) {
  const indicators = row?.indicators || {};
  const shows = pickIndicator(indicators, "TOTAL_SHOWS") ?? 0;
  const clicks = pickIndicator(indicators, "TOTAL_CLICKS") ?? 0;
  return {
    query: row?.query_text || null,
    query_id: row?.query_id || null,
    shows,
    clicks,
    ctr: shows > 0 ? clicks / shows : null,
    avg_show_position: pickIndicator(indicators, "AVG_SHOW_POSITION"),
    avg_click_position: pickIndicator(indicators, "AVG_CLICK_POSITION"),
  };
}

function sumStats(statistics, field) {
  if (!Array.isArray(statistics)) return 0;
  return statistics
    .filter((item) => item?.field === field)
    .reduce((acc, item) => acc + (Number(item.value) || 0), 0);
}

function avgStats(statistics, field) {
  if (!Array.isArray(statistics)) return null;
  const values = statistics
    .filter((item) => item?.field === field)
    .map((item) => Number(item.value))
    .filter((n) => Number.isFinite(n));
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function handleStatus() {
  const configured = Boolean(getSeoToken());
  const wanted = (
    process.env.YANDEX_WEBMASTER_HOST_URL || "https://promptshot.ru"
  ).trim();
  if (!configured) {
    return jsonResult({
      configured: false,
      host_url: wanted,
      note: "Add YANDEX_SEO_TOKEN to .cursor/yandex-seo.env",
    });
  }
  const { userId, host } = await resolveWebmasterHost();
  return jsonResult({
    configured: true,
    token_set: true,
    user_id: userId,
    host_url: wanted,
    host_id: host.host_id,
    verified: host.verified ?? null,
    ascii_host_url: host.ascii_host_url ?? null,
  });
}

async function handleListHosts() {
  const { userId, host, hosts } = await resolveWebmasterHost();
  return jsonResult({
    user_id: userId,
    default_host_id: host.host_id,
    hosts: hosts.map((item) => ({
      host_id: item.host_id,
      verified: item.verified ?? null,
      ascii_host_url: item.ascii_host_url ?? null,
      unicode_host_url: item.unicode_host_url ?? null,
    })),
  });
}

async function handleSearchQueries(args) {
  const range = dateRange(args?.days, 28);
  const limit = clampInt(args?.limit, 1, 100, 30);
  const orderBy =
    args?.order_by === "TOTAL_CLICKS" ? "TOTAL_CLICKS" : "TOTAL_SHOWS";
  const { userId, host } = await resolveWebmasterHost();
  const data = await yandexFetch(
    webmasterUrl(`${hostPath(userId, host.host_id)}/search-queries/popular`, {
      order_by: orderBy,
      date_from: range.date_from,
      date_to: range.date_to,
      offset: 0,
      limit,
      device_type_indicator: "ALL",
      query_indicator: QUERY_INDICATORS,
    }),
  );
  const queries = Array.isArray(data?.queries)
    ? data.queries.map(normalizeQuery)
    : [];
  return jsonResult({
    host_id: host.host_id,
    requested: range,
    date_from: data?.date_from ?? range.date_from,
    date_to: data?.date_to ?? range.date_to,
    total_available: data?.count ?? queries.length,
    order_by: orderBy,
    queries,
  });
}

async function handleSearchUrls(args) {
  const limit = clampInt(args?.limit, 1, 20, 20);
  const urlContains =
    typeof args?.url_contains === "string" ? args.url_contains.trim() : "";
  const { userId, host } = await resolveWebmasterHost();
  const body = {
    offset: 0,
    limit,
    device_type_indicator: "ALL",
    text_indicator: "URL",
  };
  if (urlContains) {
    body.filters = {
      text_filters: [
        {
          text_indicator: "URL",
          operation: "TEXT_CONTAINS",
          value: urlContains,
        },
      ],
    };
  }
  const data = await yandexFetch(
    webmasterUrl(`${hostPath(userId, host.host_id)}/query-analytics/list`),
    { method: "POST", body },
  );
  const rows = Array.isArray(data?.text_indicator_values)
    ? data.text_indicator_values
    : Array.isArray(data?.queries)
      ? data.queries
      : [];
  return jsonResult({
    host_id: host.host_id,
    note: "query-analytics covers about the last 14 days",
    urls: rows.map((row) => {
      const stats = row.statistics || row.indicators || [];
      const shows = Array.isArray(stats)
        ? sumStats(stats, "IMPRESSIONS")
        : pickIndicator(stats, "TOTAL_SHOWS") ?? 0;
      const clicks = Array.isArray(stats)
        ? sumStats(stats, "CLICKS")
        : pickIndicator(stats, "TOTAL_CLICKS") ?? 0;
      return {
        url: row.text || row.url || row.query_text || null,
        shows,
        clicks,
        ctr: shows > 0 ? clicks / shows : null,
        avg_position: Array.isArray(stats)
          ? avgStats(stats, "POSITION")
          : pickIndicator(stats, "AVG_SHOW_POSITION"),
        popular_query: row.popular_complementary_indicator || null,
      };
    }),
  });
}

async function handleIndexingSummary() {
  const { userId, host } = await resolveWebmasterHost();
  const base = hostPath(userId, host.host_id);
  const result = {
    host_id: host.host_id,
    verified: host.verified ?? null,
    ascii_host_url: host.ascii_host_url ?? null,
    summary: null,
    sitemaps: null,
  };
  try {
    result.summary = await yandexFetch(webmasterUrl(`${base}/summary`));
  } catch (err) {
    result.summary = {
      error: err instanceof Error ? err.message : String(err),
      details: err?.payload ?? null,
    };
  }
  try {
    const sitemaps = await yandexFetch(webmasterUrl(`${base}/sitemaps`));
    const list = Array.isArray(sitemaps?.sitemaps) ? sitemaps.sitemaps : [];
    result.sitemaps = {
      count: list.length,
      items: list.slice(0, 20).map((item) => ({
        sitemap_id: item.sitemap_id ?? item.id ?? null,
        sitemap_url: item.sitemap_url ?? item.url ?? null,
        last_access_date: item.last_access_date ?? null,
        errors_count: item.errors_count ?? null,
        urls_count: item.urls_count ?? null,
      })),
    };
  } catch (err) {
    result.sitemaps = {
      error: err instanceof Error ? err.message : String(err),
      details: err?.payload ?? null,
    };
  }
  return jsonResult(result);
}

async function handleToolCall(name, args) {
  if (name === "webmaster_status") return handleStatus();
  if (name === "list_hosts") return handleListHosts();
  if (name === "search_queries") return handleSearchQueries(args);
  if (name === "search_urls") return handleSearchUrls(args);
  if (name === "indexing_summary") return handleIndexingSummary();
  return jsonResult({ error: `Unknown tool: ${name}` }, true);
}

runMcpServer({
  name: "yandex-webmaster",
  version: "1.0.0",
  tools: TOOLS,
  handleToolCall,
});
