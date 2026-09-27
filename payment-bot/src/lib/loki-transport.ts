// Same file in landing/src/lib, web-generation-worker/src/lib, and payment-bot/src/lib.

const LEVELS = new Set(["debug", "info", "warn", "error"]);
const CONSOLE_INSTALLED = Symbol.for("promptshot.loki.console");

export type LokiTransportOptions = {
  pushUrl: string;
  basicAuth?: string;
  service: string;
  envLabel: string;
  instance: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  flushIntervalMs?: number;
  maxBatch?: number;
  maxBuffer?: number;
  maxLineChars?: number;
  timeoutMs?: number;
  schedule?: boolean;
  onError?: (message: string) => void;
};

type Item = {
  timestampNs: string;
  line: string;
  level: string;
};

type Stream = {
  stream: { service: string; env: string; level: string; instance: string };
  values: [string, string][];
};

export type LokiTransport = {
  push(line: string, level?: string): void;
  flush(): Promise<void>;
  stop(): void;
  setInstance(instance: string): void;
  dropped(): number;
};

export function formatConsoleArgs(args: unknown[]): string {
  if (args.length === 1 && typeof args[0] === "string") {
    const text = args[0].trim();
    if (text.startsWith("{") && text.endsWith("}")) return clip(text);
  }
  const msg = args.map(stringifyArg).join(" ");
  return clip(JSON.stringify({ msg }));
}

function stringifyArg(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function clip(text: string, max = 8000): string {
  return text.length <= max ? text : text.slice(0, max);
}

function safeHost(pushUrl: string): string {
  try {
    return new URL(pushUrl).host;
  } catch {
    return "invalid-url";
  }
}

export function createLokiTransport(options: LokiTransportOptions): LokiTransport {
  const pushUrl = options.pushUrl.trim();
  const basicAuth = options.basicAuth?.trim() ?? "";
  const service = options.service;
  const envLabel = options.envLabel || "prod";
  let instance = options.instance || "unknown";
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const flushIntervalMs = options.flushIntervalMs ?? 1000;
  const maxBatch = options.maxBatch ?? 200;
  const maxBuffer = options.maxBuffer ?? 5000;
  const maxLineChars = options.maxLineChars ?? 8000;
  const timeoutMs = options.timeoutMs ?? 3000;
  const schedule = options.schedule ?? true;
  const onError = options.onError;

  let buffer: Item[] = [];
  let droppedCount = 0;
  let lastNs = BigInt(0);
  let flushing: Promise<void> | null = null;
  let lastReportAt = -60_000;
  let timer: ReturnType<typeof setInterval> | null = null;

  function report(message: string): void {
    const at = now();
    if (at - lastReportAt < 60_000) return;
    lastReportAt = at;
    if (onError) onError(message);
    else process.stderr.write(`[loki] ${message}\n`);
  }

  function stamp(): string {
    let ns = BigInt(now()) * BigInt(1000000);
    if (ns <= lastNs) ns = lastNs + BigInt(1);
    lastNs = ns;
    return ns.toString();
  }

  function push(line: string, level = "info"): void {
    if (!pushUrl) return;
    const normalized = LEVELS.has(level) ? level : "info";
    buffer.push({
      timestampNs: stamp(),
      line: clip(line, maxLineChars),
      level: normalized,
    });
    if (buffer.length > maxBuffer) {
      const extra = buffer.length - maxBuffer;
      buffer.splice(0, extra);
      droppedCount += extra;
    }
    if (buffer.length >= maxBatch) void flush();
  }

  async function post(streams: Stream[]): Promise<{ ok: boolean; status: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (basicAuth) {
        headers.authorization = `Basic ${Buffer.from(basicAuth).toString("base64")}`;
      }
      const response = await fetchImpl(pushUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ streams }),
        signal: controller.signal,
        redirect: "manual",
      });
      if (response.status >= 300 && response.status < 400) {
        return { ok: false, status: String(response.status) };
      }
      return { ok: response.ok, status: String(response.status) };
    } catch {
      return { ok: false, status: "network" };
    } finally {
      clearTimeout(timeout);
    }
  }

  function group(items: Item[]): Stream[] {
    const byLevel = new Map<string, Item[]>();
    for (const item of items) {
      const list = byLevel.get(item.level);
      if (list) list.push(item);
      else byLevel.set(item.level, [item]);
    }
    return [...byLevel.entries()].map(([level, list]) => ({
      stream: { service, env: envLabel, level, instance },
      values: list.map((item) => [item.timestampNs, item.line]),
    }));
  }

  async function flushOnce(): Promise<void> {
    let guard = 0;
    while (pushUrl && buffer.length > 0 && guard < 20) {
      guard += 1;
      const batch = buffer.splice(0, maxBatch);
      const first = await post(group(batch));
      if (first.ok) continue;
      const second = await post(group(batch));
      if (second.ok) continue;
      droppedCount += batch.length + buffer.length;
      buffer = [];
      report(`push failed host=${safeHost(pushUrl)} status=${second.status} dropped=${droppedCount}`);
      return;
    }
  }

  function flush(): Promise<void> {
    if (!pushUrl) return Promise.resolve();
    if (flushing) return flushing.then(() => flush());
    flushing = flushOnce().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  if (schedule && pushUrl) {
    timer = setInterval(() => {
      void flush();
    }, flushIntervalMs);
    timer.unref?.();
  }

  return {
    push,
    flush,
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    setInstance(next: string) {
      const trimmed = next.trim();
      if (trimmed) instance = trimmed;
    },
    dropped: () => droppedCount,
  };
}

export function installConsoleLokiSink(transport: LokiTransport): () => void {
  const marked = console as Console & { [CONSOLE_INSTALLED]?: boolean };
  if (marked[CONSOLE_INSTALLED]) return () => {};
  marked[CONSOLE_INSTALLED] = true;
  const methods = ["log", "info", "warn", "error", "debug"] as const;
  const previous = new Map<string, (...args: unknown[]) => void>();
  const patched = console as unknown as Record<string, (...args: unknown[]) => void>;
  for (const method of methods) {
    previous.set(method, patched[method]);
    const original = patched[method].bind(console);
    const level = method === "log" ? "info" : method;
    patched[method] = (...args: unknown[]) => {
      original(...args);
      try {
        transport.push(formatConsoleArgs(args), level);
      } catch {
        // logging must not break the process
      }
    };
  }
  return () => {
    for (const [method, fn] of previous) patched[method] = fn;
    delete marked[CONSOLE_INSTALLED];
  };
}

export function installLokiProcessHooks(transport: LokiTransport): void {
  const flush = () => {
    void transport.flush();
  };
  process.on("SIGTERM", flush);
  process.on("SIGINT", flush);
  process.on("beforeExit", flush);
}
