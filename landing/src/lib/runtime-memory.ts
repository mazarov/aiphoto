import fs from "node:fs";

import { sharpPipelineActive, sharpPipelineWaiting } from "@/lib/sharp-runtime";

export type CgroupMemory = {
  current: number | null;
  anon: number | null;
  file: number | null;
};

export type RuntimeMemorySnapshot = {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  uptimeSec: number;
  cgroup: CgroupMemory | null;
  routes: Record<string, number>;
  sharpActive: number;
  sharpWaiting: number;
};

const routeCounts = new Map<string, number>();

export function noteMemoryRoute(route: string): void {
  routeCounts.set(route, (routeCounts.get(route) ?? 0) + 1);
}

export function resetMemoryRoutesForTests(): void {
  routeCounts.clear();
}

export function parseCgroupStat(text: string): { anon: number | null; file: number | null } {
  let anon: number | null = null;
  let file: number | null = null;
  for (const line of text.split("\n")) {
    const [key, raw] = line.trim().split(/\s+/);
    const value = Number(raw);
    if (!key || !Number.isFinite(value)) continue;
    if (key === "anon") anon = value;
    if (key === "file") file = value;
  }
  return { anon, file };
}

function readText(path: string, readFile: (path: string) => string): string | null {
  try {
    return readFile(path);
  } catch {
    return null;
  }
}

export function readCgroupMemory(
  readFile: (path: string) => string = (path) => fs.readFileSync(path, "utf8"),
): CgroupMemory | null {
  const currentText =
    readText("/sys/fs/cgroup/memory.current", readFile)
    ?? readText("/sys/fs/cgroup/memory/memory.usage_in_bytes", readFile);
  const statText = readText("/sys/fs/cgroup/memory.stat", readFile);
  if (currentText == null && statText == null) return null;
  const current = currentText == null ? null : Number(currentText.trim());
  const stat = statText == null ? { anon: null, file: null } : parseCgroupStat(statText);
  return {
    current: Number.isFinite(current) ? current : null,
    anon: stat.anon,
    file: stat.file,
  };
}

export function readRuntimeMemorySnapshot(): RuntimeMemorySnapshot {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
    uptimeSec: Math.round(process.uptime()),
    cgroup: readCgroupMemory(),
    routes: Object.fromEntries(routeCounts),
    sharpActive: sharpPipelineActive(),
    sharpWaiting: sharpPipelineWaiting(),
  };
}

export function startRuntimeMemoryLog(intervalMs = 60_000): () => void {
  const write = () => {
    console.info("[runtime.memory]", readRuntimeMemorySnapshot());
  };
  const timer = setInterval(write, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
