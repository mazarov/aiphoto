/**
 * Копирует extension/sidepanel → landing/stv-web-sidepanel (зеркало для Docker, контекст только landing/).
 * Запуск из landing/: npm run sync:stv-sidepanel
 */
import { cp } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const landingRoot = join(__dirname, "..");
const src = join(landingRoot, "..", "extension", "sidepanel");
const dest = join(landingRoot, "stv-web-sidepanel");

await cp(src, dest, { recursive: true, force: true });
console.log("[sync-stv-web-sidepanel] copied extension/sidepanel → landing/stv-web-sidepanel");
