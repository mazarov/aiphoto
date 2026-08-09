/** Structured server logs. Never include image bytes or credentials. */
export function extensionLog(step: string, fields: Record<string, unknown>): void {
  console.warn("[extension.pipeline]", { step, ...fields });
}
