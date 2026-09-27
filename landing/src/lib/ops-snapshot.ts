export function snapshotLogLine(data: Record<string, unknown>): string {
  return JSON.stringify({
    level: "info",
    service: "landing",
    ...data,
    event: "product_snapshot",
  });
}

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

function asRecord(data: unknown): Record<string, unknown> {
  if (typeof data === "string") {
    const parsed = JSON.parse(data) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  throw new Error("ops_product_snapshot_empty");
}

export async function logProductSnapshot(supabase: RpcClient): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("ops_product_snapshot");
  if (error) throw new Error(error.message);
  const payload = asRecord(data);
  console.info(snapshotLogLine(payload));
  return payload;
}
