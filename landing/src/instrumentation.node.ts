export async function registerNode(): Promise<void> {
  const { configureSharpRuntime } = await import("@/lib/sharp-runtime");
  const { startRuntimeMemoryLog } = await import("@/lib/runtime-memory");
  configureSharpRuntime();
  startRuntimeMemoryLog();
}
