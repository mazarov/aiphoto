export const PRESERVE_OUTFIT_CONFIG_KEY = "preserve_outfit_enabled";

export type WardrobePolicy = "replace" | "keep";

const WARDROBE_HEADINGS = new Set(["clothing", "wardrobe", "outfit"]);

const KNOWN_SECTION_HEADINGS = new Set([
  "visual hook",
  "scene",
  "genre",
  "rendering",
  "appearance",
  "object",
  "materials",
  "markings",
  "staging",
  "canvas",
  "regions",
  "icons",
  "environment",
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
  "text",
  "avoid",
  "critical rules",
]);

export const KEEP_WARDROBE_SECTION_BODY =
  "Keep garments, shoes, and worn accessories exactly as shown on the subject photo.";

export const IDENTITY_PHOTO_APPEARANCE_BODY =
  "Use the subject from the attached reference photo: preserve their face structure, features, eye color, skin tone, body proportions, and natural hair color.";

export const STYLIZED_IDENTITY_PHOTO_APPEARANCE_BODY =
  "Use the subject from the attached reference photo (preserve their recognizable facial structure, features, eye color, skin tone, and natural hair pigment), translated completely into the artistic medium, brushwork, and stylization specified in Genre and Rendering.";

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

const EXPLICIT_NON_PHOTO_RULES_RE =
  /не переводи(?:ть)? (?:иллюстрацию|изображение|и схему)[^.\n]*в фотографию|do not turn (?:an illustration|the image)[^.\n]*into a photograph|превращение изображения в фотографию|turning the image into a photograph|сглаживание видимых мазков|smoothing visible brushwork/i;

const STYLIZED_MEDIUM_KEYWORDS_RE =
  /цифров[а-яё]*\s+живопис|маслян[а-яё]*\s+живопис|акрил[а-яё]*\s+живопис|акварел|гуаш|портретн[а-яё]*\s+иллюстрац|иллюстрац[а-яё]*\s+в\s+стиле|в\s+технике\s+цифров[а-яё]*\s+живопис|шарж|карикатур|аниме|мультфильм|векторн[а-яё]*\s+(?:иллюстрац|график)|комикс|карандашн[а-яё]*\s+рисун|3d[-\s]?(?:рендер|иллюстрац|модел|персонаж|стил|шейдер)|\b(?:digital painting|oil painting|acrylic painting|watercolor|gouache|illustration|caricature|anime|cel[- ]shad(?:ed|ing)|flat vector|3d render|3d shader|comic book|pencil drawing|impasto)\b/i;

const NON_PHOTO_CHECK_HEADINGS = new Set([
  "visual hook",
  "genre",
  "rendering",
]);

/**
 * Detects whether a card/analyze prompt targets a non-photo artistic medium
 * (illustration, digital/oil painting, watercolor, anime, flat vector, 3D)
 * so image-to-image wrappers do not force photorealistic photograph output.
 */
export function isStylizedNonPhotoPrompt(rawPrompt: string): boolean {
  const text = String(rawPrompt ?? "").trim();
  if (!text) return false;
  if (EXPLICIT_NON_PHOTO_RULES_RE.test(text)) return true;

  const lines = text.split(/\r?\n/);
  let currentHeading: string | null = null;
  let sawKnownHeading = false;
  const targetLines: string[] = [];

  for (const line of lines) {
    const parsed = splitHeadingLine(line);
    if (parsed) {
      sawKnownHeading = true;
      currentHeading = parsed.heading;
      if (parsed.rest && NON_PHOTO_CHECK_HEADINGS.has(currentHeading)) {
        targetLines.push(parsed.rest);
      }
      continue;
    }
    if (!sawKnownHeading || (currentHeading && NON_PHOTO_CHECK_HEADINGS.has(currentHeading))) {
      targetLines.push(line);
    }
  }

  return STYLIZED_MEDIUM_KEYWORDS_RE.test(targetLines.join("\n"));
}

/**
 * Strips an embedded `CRITICAL RULES` section (e.g. from `/api/extension/analyze`)
 * before appending generation-time rules so the model never receives two
 * conflicting `CRITICAL RULES` blocks.
 */
export function stripEmbeddedCriticalRules(rawPrompt: string): string {
  const text = String(rawPrompt ?? "");
  if (!text.trim()) return text;
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const parsed = splitHeadingLine(lines[i] ?? "");
    if (parsed && parsed.heading === "critical rules") {
      i += 1;
      while (i < lines.length) {
        const next = splitHeadingLine(lines[i] ?? "");
        if (next && next.heading !== "critical rules" && KNOWN_SECTION_HEADINGS.has(next.heading)) {
          break;
        }
        i += 1;
      }
      continue;
    }
    out.push(lines[i] ?? "");
    i += 1;
  }
  return out.join("\n").trimEnd();
}

/**
 * Replaces the text-only `Appearance` section when user identity photo(s) are
 * attached, preventing biometric conflicts between the analyzed reference
 * person and the uploaded user photo.
 */
export function neutralizeAppearanceForIdentityPhoto(
  rawPrompt: string,
  stylized = false,
): string {
  const text = String(rawPrompt ?? "");
  if (!text.trim()) return text;
  const replacement = stylized
    ? STYLIZED_IDENTITY_PHOTO_APPEARANCE_BODY
    : IDENTITY_PHOTO_APPEARANCE_BODY;
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const parsed = splitHeadingLine(lines[i] ?? "");
    if (!parsed || parsed.heading !== "appearance") {
      out.push(lines[i] ?? "");
      i += 1;
      continue;
    }
    out.push("Appearance:");
    i += 1;
    if (!parsed.rest) {
      while (i < lines.length) {
        const next = splitHeadingLine(lines[i] ?? "");
        if (next && KNOWN_SECTION_HEADINGS.has(next.heading)) break;
        i += 1;
      }
    }
    out.push(replacement);
  }
  return out.join("\n");
}

export function preparePromptForIdentityPhotoGeneration(
  rawPrompt: string,
  policy: WardrobePolicy,
): { body: string; stylized: boolean } {
  const raw = String(rawPrompt ?? "").trimEnd();
  const stylized = isStylizedNonPhotoPrompt(raw);
  const withoutCritical = stripEmbeddedCriticalRules(raw);
  const withAppearance = neutralizeAppearanceForIdentityPhoto(withoutCritical, stylized);
  const body = applyWardrobePolicyToPrompt(withAppearance, policy).trimEnd();
  return { body, stylized };
}

export function shouldShowPreserveOutfitChip(input: {
  composeMode: string;
  photoCount: number;
  flagOn: boolean;
}): boolean {
  return input.flagOn && input.composeMode === "image" && input.photoCount > 0;
}
