const SESSION_KEY = "promptshot_debug_tools";
const FILTER_STATE_KEY = "promptshot_debug_filters";
/** Cookie so SSR `/p/[slug]` can open unpublished cards while debug is on. */
export const DEBUG_TOOLS_COOKIE = "promptshot_debug_tools";

export type DebugFilterState = {
  hasWarnings: "all" | "yes" | "no";
  scoreMin: number;
  scoreMax: number;
  hasRuPrompt: "all" | "yes" | "no";
  /** Publication filter — debug only. */
  published: "all" | "yes" | "no";
  selectedTag: string;
  hasBefore: "all" | "yes";
  dataset: string;
  idSearch: string;
  panelOpen: boolean;
};

export const DEBUG_CARD_DELETED_EVENT = "promptshot:debug-card-deleted";

export type DebugCardDeletedDetail = { cardId: string; slug: string };

function setDebugToolsCookie(enabled: boolean): void {
  try {
    if (typeof document === "undefined") return;
    if (enabled) {
      document.cookie = `${DEBUG_TOOLS_COOKIE}=1; path=/; max-age=86400; SameSite=Lax`;
    } else {
      document.cookie = `${DEBUG_TOOLS_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
    }
  } catch {}
}

export function enableDebugToolsSession(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {}
  setDebugToolsCookie(true);
}

export function disableDebugToolsSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(FILTER_STATE_KEY);
  } catch {}
  setDebugToolsCookie(false);
}

export function isDebugToolsSessionEnabled(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function readDebugFilterState(): DebugFilterState | null {
  try {
    const raw = sessionStorage.getItem(FILTER_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DebugFilterState;
  } catch {
    return null;
  }
}

export function writeDebugFilterState(state: DebugFilterState): void {
  try {
    sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(state));
  } catch {}
}

export function dispatchDebugCardDeleted(detail: DebugCardDeletedDetail): void {
  window.dispatchEvent(new CustomEvent(DEBUG_CARD_DELETED_EVENT, { detail }));
}
