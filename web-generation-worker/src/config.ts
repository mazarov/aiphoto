import "dotenv/config";
import os from "node:os";
import crypto from "node:crypto";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function integer(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

function boolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

export const config = {
  appEnv: process.env.APP_ENV || "prod",
  port: integer("PORT", 3003, 1, 65535),
  supabaseUrl:
    process.env.SUPABASE_SUPABASE_PUBLIC_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    required("SUPABASE_SUPABASE_PUBLIC_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || "",
  geminiProxyBaseUrl: (process.env.GEMINI_PROXY_BASE_URL || "").replace(/\/+$/, ""),
  workerId:
    process.env.WORKER_ID?.trim() ||
    `${os.hostname()}:${process.pid}:${crypto.randomBytes(4).toString("hex")}`,
  processingEnabled: boolean("WORKER_PROCESSING_ENABLED", true),
  concurrency: integer("WORKER_CONCURRENCY", 10, 1, 50),
  globalCap: integer("WORKER_GLOBAL_CAP", 50, 1, 50),
  perUserCap: integer("WORKER_PER_USER_CAP", 3, 1, 3),
  leaseSeconds: integer("WORKER_LEASE_SECONDS", 180, 30, 3600),
  pollMs: integer("WORKER_POLL_MS", 1000, 100, 60000),
  heartbeatMs: integer("WORKER_HEARTBEAT_MS", 30000, 5000, 120000),
  reaperMs: integer("WORKER_REAPER_MS", 30000, 5000, 300000),
  reaperLimit: integer("WORKER_REAPER_LIMIT", 100, 1, 1000),
  shutdownGraceMs: integer("WORKER_SHUTDOWN_GRACE_MS", 30000, 1000, 120000),
};

if (config.heartbeatMs >= (config.leaseSeconds * 1000) / 2) {
  throw new Error(
    "WORKER_HEARTBEAT_MS must be less than half of WORKER_LEASE_SECONDS"
  );
}
