export const GENERACIYA_SEO_IMAGE_FLAG_KEYS = [
  "generaciya_seo_image_logs_enabled",
  "generaciya_seo_src_1080_enabled",
  "generaciya_seo_single_pass_enabled",
  "generaciya_seo_descriptive_alt_enabled",
  "generaciya_seo_first_screen_rank_enabled",
] as const;

export type GeneraciyaSeoImageFlags = {
  logs: boolean;
  src1080: boolean;
  singlePass: boolean;
  descriptiveAlt: boolean;
  firstScreenRank: boolean;
};

export const GENERACIYA_SEO_IMAGE_FLAGS_OFF: GeneraciyaSeoImageFlags = {
  logs: false,
  src1080: false,
  singlePass: false,
  descriptiveAlt: false,
  firstScreenRank: false,
};

export function parseGeneraciyaSeoImageFlag(value: unknown): boolean {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return false;
  return text === "true" || text === "1" || text === "yes" || text === "on";
}

export function parseGeneraciyaSeoImageFlags(
  rows: readonly { key?: unknown; value?: unknown }[] | null | undefined,
): GeneraciyaSeoImageFlags {
  const map = new Map<string, string>();
  for (const row of rows ?? []) {
    const key = String(row?.key ?? "");
    if (!key) continue;
    map.set(key, String(row?.value ?? ""));
  }
  const on = (key: (typeof GENERACIYA_SEO_IMAGE_FLAG_KEYS)[number]) =>
    parseGeneraciyaSeoImageFlag(map.get(key));
  return {
    logs: on("generaciya_seo_image_logs_enabled"),
    src1080: on("generaciya_seo_src_1080_enabled"),
    singlePass: on("generaciya_seo_single_pass_enabled"),
    descriptiveAlt: on("generaciya_seo_descriptive_alt_enabled"),
    firstScreenRank: on("generaciya_seo_first_screen_rank_enabled"),
  };
}

/** ISR output depends on this token. Rollback still needs revalidate (3600). */
export function generaciyaSeoImageCacheToken(flags: GeneraciyaSeoImageFlags): string {
  return [
    flags.logs ? "1" : "0",
    flags.src1080 ? "1" : "0",
    flags.singlePass ? "1" : "0",
    flags.descriptiveAlt ? "1" : "0",
    flags.firstScreenRank ? "1" : "0",
  ].join("");
}

export function generaciyaSeoImageMode(
  flags: GeneraciyaSeoImageFlags,
): "current" | "src1080" | "single512" | "both" {
  if (flags.src1080 && flags.singlePass) return "both";
  if (flags.src1080) return "src1080";
  if (flags.singlePass) return "single512";
  return "current";
}
