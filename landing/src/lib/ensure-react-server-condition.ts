import { spawnSync } from "node:child_process";

/**
 * `server-only` resolves to a throw unless Node was started with
 * `--conditions=react-server` (the condition Next sets for server bundles).
 * Re-exec once so `npx tsx src/fill-seo-tags.ts` keeps working.
 */
function hasReactServerCondition(): boolean {
  const args = process.execArgv;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--conditions" && args[i + 1]?.split(",").includes("react-server")) return true;
    if (arg.startsWith("--conditions=") && arg.slice("--conditions=".length).split(",").includes("react-server")) {
      return true;
    }
  }
  return false;
}

export function ensureReactServerCondition(): void {
  if (hasReactServerCondition()) return;
  const result = spawnSync(
    process.execPath,
    ["--conditions=react-server", ...process.execArgv, ...process.argv.slice(1)],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}
