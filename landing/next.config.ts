import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextConfig } from "next";
import { DEN_ROZHDENIYA_PERMANENT_REDIRECTS } from "./src/lib/den-rozhdeniya-cluster";
import { PROMTY_DLYA_II_FOTOSESSII_PERMANENT_REDIRECTS } from "./src/lib/promty-dlya-ii-fotosessii-cluster";
import { NEXT_CACHE_MAX_MEMORY_BYTES } from "./src/lib/next-cache-memory";

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
  devIndicators: false,
  outputFileTracingRoot,
  output: "standalone",
  // Unique SEO / `_next/image` keys must evict; unset LRU can fill the 2 GiB cgroup.
  cacheMaxMemorySize: NEXT_CACHE_MAX_MEMORY_BYTES,
  // Keep native sharp out of the Next bundle so Alpine libvips resolves at
  // build (collect page data) and in the standalone runner.
  serverExternalPackages: ["@supabase/supabase-js", "sharp"],
  async redirects() {
    return [
      {
        source: "/new",
        destination: "/trends",
        permanent: true,
      },
      // Birthday cluster: audience-first L2 + retired L3 → audience/object L2.
      ...DEN_ROZHDENIYA_PERMANENT_REDIRECTS.map((item) => ({
        source: item.source,
        destination: item.destination,
        permanent: true,
      })),
      ...PROMTY_DLYA_II_FOTOSESSII_PERMANENT_REDIRECTS.map((item) => ({
        source: item.source,
        destination: item.destination,
        permanent: true,
      })),
    ];
  },
  async rewrites() {
    const supa = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!supa) return [];
    return [
      {
        source: "/img/:bucket/:path*",
        destination: `${supa}/storage/v1/object/public/:bucket/:path*`,
      },
    ];
  },
  images: {
    qualities: [45, 60, 75],
    // Default 60s made optimized images look "uncached" to PSI on repeat views.
    minimumCacheTTL: 60 * 60 * 24 * 31,
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.dockhost.net" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.yandex.net" },
    ],
  },
  async headers() {
    const immutable = [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ];
    return [
      { source: "/favicon.ico", headers: immutable },
      { source: "/favicon.svg", headers: immutable },
      { source: "/favicon-:size.png", headers: immutable },
      { source: "/icon-:size.png", headers: immutable },
      { source: "/apple-touch-icon.png", headers: immutable },
    ];
  },
};

export default nextConfig;
