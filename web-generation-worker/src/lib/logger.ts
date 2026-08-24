type LogLevel = "debug" | "info" | "warn" | "error";

let workerId = "";

export function configureLogger(input: { workerId: string }): void {
  workerId = input.workerId.trim();
}

function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { error: String(error) };
  const caused = error as Error & { cause?: { code?: string | number } };
  return {
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
    causeCode: caused.cause?.code,
  };
}

export function log(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "web-generation-worker",
    event,
    ...fields,
    workerId,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function errorFields(error: unknown): Record<string, unknown> {
  return serializeError(error);
}
