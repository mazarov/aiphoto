/** Gender/composition slugs. A card keeps exactly one of these after vision merge. */
export const EXCLUSIVE_AUDIENCE_SLUGS = [
  "devushka",
  "muzhchina",
  "para",
  "semya",
  "malchik",
  "devochka",
  "malysh",
] as const;

export type ExclusiveAudienceSlug = (typeof EXCLUSIVE_AUDIENCE_SLUGS)[number];

/**
 * Shared text-classifier rule. Vision remains the source of truth for these slugs;
 * this only stops the text path from stacking genders onto a couple or a family.
 */
export const EXCLUSIVE_AUDIENCE_PROMPT_RULES = `- devushka / muzhchina only when the text explicitly names the gender of one person. Neutral wording (человек, субъект, the subject, a person, модель) without a stated gender → do not add devushka or muzhchina. Do not infer gender from clothing (костюм, платье, пиджак, юбка).
- Two adults → only para (plus vlyublennykh when romantic). Do not also add devushka or muzhchina. An adult together with a child → semya (plus the relationship tag), without devushka or muzhchina.`;

/**
 * Collapse stacked exclusive tags from regex/LLM output.
 * Does not invent `para` when both genders matched without it — vision decides that.
 */
export function normalizeExclusiveAudience(tags: string[]): string[] {
  const present = new Set(tags);
  const drop = new Set<string>();
  if (present.has("semya")) {
    drop.add("devushka");
    drop.add("muzhchina");
  }
  if (present.has("devushka") && present.has("muzhchina") && present.has("para")) {
    drop.add("devushka");
    drop.add("muzhchina");
  }
  if (drop.size === 0) return tags;
  return tags.filter((tag) => !drop.has(tag));
}
