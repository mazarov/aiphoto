const COPY_COUNT_KEY = "promptshot_devushki_copy_count";
const GEN_CLICKED_KEY = "promptshot_devushki_gen_clicked";

export function isDevushkiCopyNudgeEligibleCard(input: {
  seoTags: Record<string, unknown> | null | undefined;
  lastListingPath: string | null | undefined;
}): boolean {
  const path = input.lastListingPath ?? "";
  if (path.startsWith("/promty-dlya-foto-devushki")) return true;
  const audience = input.seoTags?.audience_tag;
  return Array.isArray(audience) && audience.includes("devushka");
}

function sessionStore(): Storage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

/** Increments the session copy count. True from the 2nd copy, until generate is clicked. */
export function recordDevushkiPromptCopyAndShouldNudge(eligible: boolean): boolean {
  if (!eligible) return false;
  const store = sessionStore();
  if (!store) return false;
  try {
    if (store.getItem(GEN_CLICKED_KEY) === "1") return false;
    const next = (Number(store.getItem(COPY_COUNT_KEY)) || 0) + 1;
    store.setItem(COPY_COUNT_KEY, String(next));
    return next >= 2;
  } catch {
    return false;
  }
}

export function markDevushkiGenerateClicked(): void {
  try {
    sessionStore()?.setItem(GEN_CLICKED_KEY, "1");
  } catch {
    /* private mode */
  }
}
