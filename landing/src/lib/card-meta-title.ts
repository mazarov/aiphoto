/** Card `<title>` / OG title. Long suffix + 60-char cap made Yandex see 4000 `/p/` duplicates. */

export const CARD_META_TITLE_SUFFIX = " | PromptShot";
export const CARD_META_TITLE_MAX_LEN = 80;

const VISUAL_HOOK_PREFIX = /^visual hook:\s*/i;

/** Titles that stay identical across many cards even without truncation. */
const GENERIC_TITLE_RE =
  /^(сделай такое же фото|подборка дня|мужской промпт|селфи в зеркале|фото в зеркале)(?:\s|$)|^промт$/i;

export function stripCardTitlePrefix(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "";
  const stripped = text.replace(VISUAL_HOOK_PREFIX, "").trim();
  return stripped || text;
}

/** Trailing short id from `/p/…-df7fa`. */
export function cardSlugShortId(slug: string): string | null {
  const m = slug.trim().match(/-([a-f0-9]{4,8})$/i);
  return m?.[1]?.toLowerCase() ?? null;
}

export function needsCardTitleDisambiguator(
  core: string,
  truncated: boolean,
): boolean {
  if (truncated) return true;
  const n = core.replace(/\s+/g, " ").trim();
  return GENERIC_TITLE_RE.test(n);
}

function composeCardMetaTitle(body: string, id: string | null): string {
  const idPart = id ? ` · ${id}` : "";
  return `${body}${idPart}${CARD_META_TITLE_SUFFIX}`;
}

export function buildCardMetaTitle(titleRu: string, slug: string): string {
  const core = stripCardTitlePrefix(titleRu) || "Промт";
  const id = cardSlugShortId(slug);

  if (core.length + CARD_META_TITLE_SUFFIX.length <= CARD_META_TITLE_MAX_LEN) {
    if (needsCardTitleDisambiguator(core, false) && id) {
      const withId = composeCardMetaTitle(core, id);
      if (withId.length <= CARD_META_TITLE_MAX_LEN) return withId;
    } else {
      return `${core}${CARD_META_TITLE_SUFFIX}`;
    }
  }

  const idPart = id ? ` · ${id}` : "";
  const budget = CARD_META_TITLE_MAX_LEN - CARD_META_TITLE_SUFFIX.length - idPart.length;
  const body = core.slice(0, Math.max(8, budget)).trim();
  return composeCardMetaTitle(body, id);
}
