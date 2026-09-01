export const PRESERVE_OUTFIT_CONFIG_KEY = "preserve_outfit_enabled";

export type WardrobePolicy = "replace" | "keep";

const WARDROBE_HEADINGS = new Set(["clothing", "wardrobe", "outfit"]);

const KNOWN_SECTION_HEADINGS = new Set([
  "visual hook",
  "scene",
  "genre",
  "pose",
  "lighting",
  "camera",
  "mood",
  "color",
  "clothing",
  "wardrobe",
  "outfit",
  "makeup",
  "composition",
  "avoid",
]);

export const KEEP_WARDROBE_SECTION_BODY =
  "Keep garments, shoes, and worn accessories exactly as shown on the subject photo.";

export function parseWardrobePolicy(value: unknown): WardrobePolicy {
  return value === "keep" ? "keep" : "replace";
}

export function resolveJobWardrobePolicy(input: {
  stored?: unknown;
  hasInputPhotos: boolean;
  isVibe?: boolean;
  isPhotoshoot?: boolean;
  isCameraOrbit?: boolean;
  isLocalEdit?: boolean;
  isVideo?: boolean;
}): WardrobePolicy {
  if (
    !input.hasInputPhotos ||
    input.isVibe ||
    input.isPhotoshoot ||
    input.isCameraOrbit ||
    input.isLocalEdit ||
    input.isVideo
  ) {
    return "replace";
  }
  return parseWardrobePolicy(input.stored);
}

export function resolveRequestedWardrobePolicy(input: {
  preserveOutfitRequested: boolean;
  flagOn: boolean;
  hasPhotos: boolean;
  isVibe?: boolean;
  isPhotoshoot?: boolean;
  isCameraOrbit?: boolean;
  isLocalEdit?: boolean;
  isVideo?: boolean;
}): WardrobePolicy {
  if (!input.preserveOutfitRequested || !input.flagOn) return "replace";
  return resolveJobWardrobePolicy({
    stored: "keep",
    hasInputPhotos: input.hasPhotos,
    isVibe: input.isVibe,
    isPhotoshoot: input.isPhotoshoot,
    isCameraOrbit: input.isCameraOrbit,
    isLocalEdit: input.isLocalEdit,
    isVideo: input.isVideo,
  });
}

function headingKey(line: string): string {
  return line.trim().replace(/:+\s*$/, "").toLowerCase();
}

function splitHeadingLine(line: string): { heading: string; rest: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const colon = trimmed.indexOf(":");
  if (colon === -1) {
    const heading = headingKey(trimmed);
    return KNOWN_SECTION_HEADINGS.has(heading) ? { heading, rest: "" } : null;
  }
  const heading = headingKey(trimmed.slice(0, colon));
  if (!KNOWN_SECTION_HEADINGS.has(heading)) return null;
  return { heading, rest: trimmed.slice(colon + 1).trim() };
}

export function neutralizeWardrobeSections(rawPrompt: string): string {
  const text = String(rawPrompt ?? "");
  if (!text.trim()) return text;
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const parsed = splitHeadingLine(lines[i] ?? "");
    if (!parsed || !WARDROBE_HEADINGS.has(parsed.heading)) {
      out.push(lines[i] ?? "");
      i += 1;
      continue;
    }
    const label = parsed.heading.charAt(0).toUpperCase() + parsed.heading.slice(1);
    out.push(label);
    i += 1;
    if (!parsed.rest) {
      while (i < lines.length) {
        const next = splitHeadingLine(lines[i] ?? "");
        if (next && KNOWN_SECTION_HEADINGS.has(next.heading)) break;
        i += 1;
      }
    }
    out.push(KEEP_WARDROBE_SECTION_BODY);
  }
  return out.join("\n");
}

export function applyWardrobePolicyToPrompt(
  rawPrompt: string,
  policy: WardrobePolicy,
): string {
  const text = String(rawPrompt ?? "");
  if (policy !== "keep") return text;
  return neutralizeWardrobeSections(text);
}

export function shouldShowPreserveOutfitChip(input: {
  composeMode: string;
  photoCount: number;
  flagOn: boolean;
}): boolean {
  return input.flagOn && input.composeMode === "image" && input.photoCount > 0;
}
