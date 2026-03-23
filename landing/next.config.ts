import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const landingDir = import.meta.dirname;
const repoRoot = path.resolve(landingDir, "..");
/**
 * Docker (context = `landing/` only): `WORKDIR /app` → parent is `/`, not the monorepo — tracing from `/` breaks standalone layout and `server.js` never lands where the Dockerfile expects.
 * Local / CI from repo: `aiphoto/package-lock.json` exists → trace from monorepo root for deterministic standalone.
 */
const outputFileTracingRoot = fs.existsSync(path.join(repoRoot, "package-lock.json"))
  ? repoRoot
  : landingDir;

const nextConfig: NextConfig = {
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
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.dockhost.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.yandex.net" },
    ],
  },
};

export default nextConfig;
