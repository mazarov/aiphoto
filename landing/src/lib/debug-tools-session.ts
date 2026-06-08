const SESSION_KEY = "promptshot_debug_tools";

export function enableDebugToolsSession(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {}
}

export function disableDebugToolsSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function isDebugToolsSessionEnabled(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
