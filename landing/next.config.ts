import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextConfig } from "next";

const landingDir = import.meta.dirname;
const repoRoot = path.resolve(landingDir, "..");

/** LAN IPs for mobile dev — Next.js 15 blocks cross-origin HMR without this. */
function getLanDevOrigins(): string[] {
  const origins = new Set<string>();
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        origins.add(iface.address);
      }
    }
  }
  return [...origins];
}

/**
 * Standalone tracing root (must match Docker `COPY` + `CMD node server.js`):
 * - Default: monorepo parent if `../package-lock.json` exists, else `landing/` only (Docker context `landing/`).
 * - Override: `NEXT_STANDALONE_TRACING_ROOT` at **build** time — absolute path, or relative to this directory (e.g. `..` when parent lockfile is missing but you still want repo root).
 */
function resolveOutputFileTracingRoot(): string {
  const raw = process.env.NEXT_STANDALONE_TRACING_ROOT?.trim();
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.resolve(landingDir, raw);
  }
  if (fs.existsSync(path.join(repoRoot, "package-lock.json"))) {
    return repoRoot;
  }
  return landingDir;
}

const outputFileTracingRoot = resolveOutputFileTracingRoot();

const nextConfig: NextConfig = {
  allowedDevOrigins: getLanDevOrigins(),
  outputFileTracingRoot,
  output: "standalone",
  serverExternalPackages: ["@supabase/supabase-js"],
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/favicon.svg",
        permanent: true,
      },
    ];
  },
  images: {
    qualities: [45, 60, 75],
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.dockhost.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.yandex.net" },
    ],
  },
};

export default nextConfig;
