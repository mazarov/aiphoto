import * as esbuild from "esbuild";
import { access, copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const landingRoot = join(__dirname, "..");
const repoRoot = join(landingRoot, "..");

/** Monorepo sibling (local dev) or vendored mirror (Docker context = landing/ only). */
async function resolveSidepanelDir() {
  const fromRepo = join(repoRoot, "extension", "sidepanel");
  const vendored = join(landingRoot, "stv-web-sidepanel");
  for (const dir of [fromRepo, vendored]) {
    try {
      await access(join(dir, "boot-web.js"));
      return dir;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    "[build-stv-web] sidepanel not found: expected ../extension/sidepanel or ./stv-web-sidepanel (run: npm run sync:stv-sidepanel)"
  );
}

const sidepanel = await resolveSidepanelDir();
const outDir = join(landingRoot, "public", "stv-panel");

await mkdir(outDir, { recursive: true });

const supabaseSsr = join(landingRoot, "node_modules/@supabase/ssr/dist/module/index.js");

await esbuild.build({
  absWorkingDir: landingRoot,
  entryPoints: [join(sidepanel, "boot-web.js")],
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile: join(outDir, "boot.mjs"),
  sourcemap: true,
  logLevel: "info",
  alias: {
    "@supabase/ssr": supabaseSsr
  }
});

await copyFile(join(sidepanel, "styles.css"), join(outDir, "styles.css"));

console.log("[build-stv-web] wrote public/stv-panel/boot.mjs and styles.css");
