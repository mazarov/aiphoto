const SESSION_KEY = "promptshot_debug_tools";
const FILTER_STATE_KEY = "promptshot_debug_filters";

export type DebugFilterState = {
  hasWarnings: "all" | "yes" | "no";
  scoreMin: number;
  scoreMax: number;
  hasRuPrompt: "all" | "yes" | "no";
  selectedTag: string;
  hasBefore: "all" | "yes";
  dataset: string;
  idSearch: string;
  panelOpen: boolean;
};

export const DEBUG_CARD_DELETED_EVENT = "promptshot:debug-card-deleted";

export type DebugCardDeletedDetail = { cardId: string; slug: string };

export function enableDebugToolsSession(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {}
}

export function disableDebugToolsSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(FILTER_STATE_KEY);
  } catch {}
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
