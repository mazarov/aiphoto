import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

const requiredPaths = [
  "payment-bot/src/index.ts",
  "payment-bot/package.json",
  "payment-bot/tsconfig.json",
  "landing/src/app/api/buy-credits-link/route.ts",
  "web-generation-worker/src/index.ts",
  "web-generation-worker/src/process-generation.ts",
  "web-generation-worker/package.json",
  "web-generation-worker/tsconfig.json",
  "Dockerfile.worker",
];

const dockerfileApi = resolve(root, "Dockerfile.api");
const dockerApiContent = readFileSync(dockerfileApi, "utf8");
const dockerMustContain = [
  "COPY payment-bot/package*.json ./",
  "COPY payment-bot/src ./src",
  'CMD ["node", "dist/index.js"]',
];

const missing = requiredPaths.filter((path) => !existsSync(resolve(root, path)));
const dockerMissing = dockerMustContain.filter((line) => !dockerApiContent.includes(line));
const dockerfileWorker = resolve(root, "Dockerfile.worker");
const dockerWorkerContent = readFileSync(dockerfileWorker, "utf8");
const dockerWorkerMustContain = [
  "COPY web-generation-worker/package*.json ./",
  "COPY web-generation-worker/src ./src",
  "COPY landing/src/lib/image-generation-prompt.ts",
  'CMD ["node", "dist/web-generation-worker/src/index.js"]',
];
const dockerWorkerMissing = dockerWorkerMustContain.filter(
  (line) => !dockerWorkerContent.includes(line)
);

if (missing.length || dockerMissing.length || dockerWorkerMissing.length) {
  console.error("[check:entrypoints] failed");
  if (missing.length) {
    console.error("Missing files:");
    for (const file of missing) {
      console.error(`- ${file}`);
    }
  }
  if (dockerMissing.length) {
    console.error("Dockerfile.api is missing expected lines:");
    for (const line of dockerMissing) {
      console.error(`- ${line}`);
    }
  }
  if (dockerWorkerMissing.length) {
    console.error("Dockerfile.worker is missing expected lines:");
    for (const line of dockerWorkerMissing) {
      console.error(`- ${line}`);
    }
  }
  process.exit(1);
}

console.log("[check:entrypoints] ok");
