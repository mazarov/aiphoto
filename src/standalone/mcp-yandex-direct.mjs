#!/usr/bin/env node
/**
 * Read-only stdio MCP: Yandex Direct Reports + campaign list.
 *
 * Env (from .cursor/yandex-seo.env via mcp.json envFile):
 *   YANDEX_DIRECT_TOKEN
 *   YANDEX_DIRECT_CLIENT_LOGIN   optional, agency only
 *   YANDEX_DIRECT_CAMPAIGN_IDS   optional, comma-separated
 *
 * tools:
 *   direct_status
 *   campaign_spend
 *   search_queries
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clampInt,
  jsonResult,
  runMcpServer,
  toolError,
} from "./mcp-yandex-seo-lib.mjs";
import {
  defaultCampaignIds,
  fetchCampaignSpend,
  fetchDirectCampaigns,
  fetchSearchQuerySpend,
  getDirectClientLogin,
  getDirectToken,
  loadDirectEnvFile,
} from "./yandex-direct-api.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadDirectEnvFile(
  process.env.YANDEX_SEO_ENV_FILE || resolve(ROOT, ".cursor/yandex-seo.env"),
);

const TOOLS = [
  {
    name: "direct_status",
    description:
      "Check Direct OAuth env and that the tracked campaigns are visible. Never returns the token.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "campaign_spend",
    description:
      "Campaign spend without VAT (cabinet «Расход»). Default period is since 2026-08-23.",
    inputSchema: {
      type: "object",
      properties: {
        date_from: {
          type: "string",
          description: "YYYY-MM-DD. Default 2026-08-23.",
        },
        date_to: {
          type: "string",
          description: "YYYY-MM-DD. Default today.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_queries",
    description:
      "Paid search queries with spend without VAT. For minus-phrase cleanup, not revenue.",
    inputSchema: {
      type: "object",
      properties: {
        date_from: {
          type: "string",
          description: "YYYY-MM-DD. Default 2026-08-23.",
        },
        date_to: {
          type: "string",
          description: "YYYY-MM-DD. Default today.",
        },
        limit: {
          type: "number",
          description: "Rows to return, 1–100. Default 50.",
        },
      },
      additionalProperties: false,
    },
  },
];

function todayYmd() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function resolveRange(args) {
  const dateFrom =
    typeof args?.date_from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.date_from)
      ? args.date_from
      : "2026-08-23";
  const dateTo =
    typeof args?.date_to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.date_to)
      ? args.date_to
      : todayYmd();
  return { dateFrom, dateTo };
}

async function handleStatus() {
  const configured = Boolean(getDirectToken());
  if (!configured) {
    return jsonResult({
      configured: false,
      token_set: false,
      client_login_set: Boolean(getDirectClientLogin()),
      campaign_ids: defaultCampaignIds(),
      note: "Add YANDEX_DIRECT_TOKEN to .cursor/yandex-seo.env",
    });
  }
  const campaigns = await fetchDirectCampaigns();
  return jsonResult({
    configured: true,
    token_set: true,
    client_login_set: Boolean(getDirectClientLogin()),
    campaign_ids: defaultCampaignIds(),
    campaigns,
  });
}

async function handleSpend(args) {
  const { dateFrom, dateTo } = resolveRange(args);
  const spend = await fetchCampaignSpend({ dateFrom, dateTo });
  return jsonResult(spend);
}

async function handleQueries(args) {
  const { dateFrom, dateTo } = resolveRange(args);
  const queries = await fetchSearchQuerySpend({
    dateFrom,
    dateTo,
    limit: clampInt(args?.limit, 1, 100, 50),
  });
  return jsonResult({
    dateFrom,
    dateTo,
    row_count: queries.length,
    queries,
  });
}

async function handleToolCall(name, args) {
  if (name === "direct_status") return handleStatus();
  if (name === "campaign_spend") return handleSpend(args);
  if (name === "search_queries") return handleQueries(args);
  return jsonResult({ error: `Unknown tool: ${name}` }, true);
}

runMcpServer({
  name: "yandex-direct",
  version: "1.0.0",
  tools: TOOLS,
  handleToolCall: async (name, args) => {
    try {
      return await handleToolCall(name, args);
    } catch (err) {
      return toolError(err);
    }
  },
});
