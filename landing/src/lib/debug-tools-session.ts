const FILTER_STATE_KEY = "promptshot_debug_filters";
const TECH_INFO_KEY = "promptshot_admin_tech_info";

export type DebugFilterState = {
  hasWarnings: "all" | "yes" | "no";
  scoreMin: number;
  scoreMax: number;
  hasRuPrompt: "all" | "yes" | "no";
  /** Publication filter — catalog admin only. */
  published: "all" | "yes" | "no";
  selectedTag: string;
  hasBefore: "all" | "yes";
  dataset: string;
  idSearch: string;
  panelOpen: boolean;
};

export const DEBUG_CARD_DELETED_EVENT = "promptshot:debug-card-deleted";
export const ADMIN_TECH_INFO_CHANGED_EVENT = "promptshot:admin-tech-info-changed";

export type DebugCardDeletedDetail = { cardId: string; slug: string };

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

/** Tech overlays / yellow DEBUG panel. Default off. */
export function readAdminTechInfoEnabled(): boolean {
  try {
    return sessionStorage.getItem(TECH_INFO_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeAdminTechInfoEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      sessionStorage.setItem(TECH_INFO_KEY, "1");
    } else {
      sessionStorage.removeItem(TECH_INFO_KEY);
    }
  } catch {}
  try {
    window.dispatchEvent(
      new CustomEvent(ADMIN_TECH_INFO_CHANGED_EVENT, { detail: { enabled } })
    );
  } catch {}
}

export function dispatchDebugCardDeleted(detail: DebugCardDeletedDetail): void {
  window.dispatchEvent(new CustomEvent(DEBUG_CARD_DELETED_EVENT, { detail }));
}
