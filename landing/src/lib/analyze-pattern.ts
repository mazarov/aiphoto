/**
 * Pattern router for image → prompt analyze.
 *
 * Self-contained on purpose: this file is shared verbatim with the
 * imageprompt.tools repo (`landing/src/lib/analyze-pattern.ts`). Keep both copies
 * identical; do not add imports from other project modules.
 */

export const ANALYZE_PATTERNS = ["person", "object", "layout", "scene"] as const;
export const ANALYZE_MEDIA = ["photo", "illustration", "graphic", "3d"] as const;

export type AnalyzePattern = (typeof ANALYZE_PATTERNS)[number];
export type AnalyzeMedium = (typeof ANALYZE_MEDIA)[number];

const PERSON_SECTIONS = [
  "Visual Hook",
  "Scene",
  "Genre",
  "Appearance",
  "Pose",
  "Lighting",
  "Camera",
  "Mood",
  "Color",
  "Clothing",
  "Makeup",
  "Composition",
  "Text",
  "Avoid",
] as const;

const OBJECT_SECTIONS = [
  "Visual Hook",
  "Scene",
  "Genre",
  "Object",
  "Materials",
  "Markings",
  "Staging",
  "Lighting",
  "Camera",
  "Color",
  "Composition",
  "Text",
  "Avoid",
] as const;

const LAYOUT_SECTIONS = [
  "Visual Hook",
  "Rendering",
  "Canvas",
  "Regions",
  "Text",
  "Icons",
  "Color",
  "Composition",
  "Avoid",
] as const;

const SCENE_SECTIONS = [
  "Visual Hook",
  "Scene",
  "Genre",
  "Environment",
  "Lighting",
  "Camera",
  "Color",
  "Composition",
  "Text",
  "Avoid",
] as const;

const SECTION_ORDER: Record<AnalyzePattern, readonly string[]> = {
  person: PERSON_SECTIONS,
  object: OBJECT_SECTIONS,
  layout: LAYOUT_SECTIONS,
  scene: SCENE_SECTIONS,
};

/**
 * One spec per heading, shared by every pattern. Kept as detailed as the legacy
 * 12-section extract: the generator does not see the source image, so thin
 * sections lose the frame. Written once in the prompt, not once per pattern.
 */
export const SECTION_SPECS: Record<string, string> = {
  "Visual Hook":
    "One sentence of art direction that names the distinctive silhouette, object, layout, or aesthetic that makes this image recognizable. Write it as a description of the image, not as an instruction: do not begin with “must survive”, “preserve”, “keep”, or their translations. Do not catalogue every detail.",
  Scene:
    "Where it is and what is happening, in 2–3 sentences: location type, indoor or outdoor, time of day, weather or interior condition, and the main action. For person, put looks in Appearance and garments in Clothing, not here.",
  Genre:
    "Genre label with one qualifier, such as fashion editorial, street photography, product packshot, still life, movie poster, infographic, landscape, or interior. If Medium is illustration, graphic, or 3d, also name the visual style, such as watercolor, anime, cel-shaded, flat vector, or low-poly.",
  Appearance:
    "What is required to repeat the person without the source photo: hair style, length, and color; approximate age band; build and height impression; skin tone as light, medium, or deep; visible distinguishing features such as glasses, beard, tattoos, or freckles. Do not write “preserve the face” and do not ask for a reference photo.",
  Pose:
    "One detailed paragraph. Begin with torso orientation relative to the lens and head turn with gaze direction. Then the shoulder line, torso lean, spine curvature and its magnitude, visible arms and hands with their contact points, hips and legs with weight distribution, and a final posture label. Report the true magnitude of bends without softening. Describe only visible limbs; write not visible for occluded parts. No focal length or framing here.",
  Lighting:
    "Key-light direction as a clock position and height, and its hardness; fill and rim presence; color temperature as warm, neutral, or cool with an approximate kelvin range; contrast impression; where shadows fall and how soft their edges are; specular highlights and reflections. Name the apparent source, such as a window, softbox, overcast sky, or neon. Be technically specific.",
  Camera:
    "Estimated full-frame focal-length range in mm; framing scale from extreme close-up to wide establishing; camera height relative to the subject and tilt; horizontal viewing angle; depth of field with which regions are sharp and which are blurred; lens character such as rectilinear, wide-angle stretch, macro, or tilt-shift. Preserve crop and subject scale.",
  Mood: "Emotional tone and atmosphere in 1–2 sentences, with a brief note on what creates it.",
  Color:
    "Dominant and accent colors with where each sits in the frame; color grade and any cinematic treatment such as teal-orange, faded film, or high-key; contrast; saturation; white-balance shift; how skin or key materials are rendered.",
  Clothing:
    "One detailed paragraph covering visible upper and lower garments: construction, neckline, sleeves, cut, colors and patterns, materials, fit and styling, jewelry, footwear, and worn accessories. Preserve distinctive structural details. Write not visible or none where appropriate.",
  Makeup:
    "Visible cosmetic application only: overall look, complexion finish, eyes, lips, brows, blush, highlight, and contour. Write none when no makeup is visible. Do not describe identity.",
  Composition:
    "Subject placement on the frame grid; exact crop and which regions are included or cut; horizon or eye-line height; foreground, midground, and background layers with their relative scale; leading lines, framing elements, repetition, or symmetry; negative space. Preserve the original composition.",
  Text:
    "Every readable string that must be reproduced, one per line, in the original language and spelling. Skip illegible scribbles. If there is no readable text, the body is exactly: none",
  Avoid:
    "A generator-ready list of 6–10 concrete anti-drift constraints for this Pattern and Medium, one per line, each starting with a dash. Name what would break this specific image: wrong placement or scale of the main subject, changed crop or lens, altered lighting direction, changed palette, added or removed elements. Person: add wrong pose or orientation, redesigned clothing, distorted anatomy. Object: add changed shape, material, or markings, extra props. Layout: add changed reading order, misspelled or moved text, altered icon count. Scene: add added people, moved landmarks, lost reflections or weather. If Medium is photo, forbid a cartoon, painterly, or 3D look. If Medium is illustration, graphic, or 3d, forbid turning the image into a photograph. Do not mention spine, plastic skin, or makeup unless Pattern is person and Medium is photo.",
  Object:
    "What the item is, its category, shape, proportions, approximate size, count, and orientation in the frame. A mannequin is a display form, not a body with a spine.",
  Materials:
    "Surface material, texture, and finish such as matte, satin, gloss, or brushed; transparency; wear; how the surface responds to light.",
  Markings:
    "Brand, logo, print, label, embossing, and pattern that are actually visible, with placement and color. Do not invent marks. If none are visible, write none.",
  Staging:
    "The surface the item sits on, the backdrop, neighboring props, spacing between items, how the item stands or is held, and the shadows or reflections it casts.",
  Rendering:
    "The carrier in 1–2 sentences: flat vector, watercolor, hand-drawn diagram, UI screenshot, newspaper illustration, 3D render, or collage; line weight, shading style, and texture.",
  Canvas:
    "Orientation, aspect impression, margins, background color or texture, and any grid or guide lines.",
  Regions:
    "Blocks in reading order, top to bottom and left to right. For each block: position, approximate size, what it contains such as headline, body copy, image, chart, or button, and alignment. Do not copy the strings; those belong in Text.",
  Icons:
    "Signs, arrows, logos, pictograms, and decorative symbols: count, style, color, and placement. If there are none, the body is exactly: none",
  Environment:
    "Foreground, midground, and background with what each contains and its relative scale; terrain, water, vegetation, or architecture; weather, season, and time of day; atmosphere such as haze, fog, or mist. Do not add people.",
};

/** Sections whose body is a list or a token, not prose paragraphs. */
const LIST_SECTIONS = new Set(["Text", "Avoid"]);

const QUALITY_HEADER = `You are an expert AI image analyst and art director.
Analyze the image and produce a structured description for an AI image generator that will NOT see the source image. Everything the generator needs must be in the sections.

Describe this specific image faithfully, not an idealized version. Preserve the actual crop, subject scale, camera angle, lighting, background, palette, and composition. State concrete geometry, positions, and counts before mood or style language. Be technically specific: name directions, angles, focal-length classes, materials, and quantities. Do not invent hidden parts, props, marks, or scene details; if something is occluded, write not visible.

Every prose section is a complete paragraph of 2–5 full sentences unless its spec says otherwise. Finish every sentence. No markdown, no bullet lists except in Text and Avoid, no commentary outside the sections.`;

const NA_BODY =
  /не применим|not applicable|\bn\/?a\b|não aplic|nao aplic/i;

export function isAnalyzePatternRouterFlagValue(value: unknown): boolean {
  return String(value ?? "").trim().toLowerCase() === "true";
}

export function isAnalyzePattern(value: string): value is AnalyzePattern {
  return (ANALYZE_PATTERNS as readonly string[]).includes(value);
}

export function isAnalyzeMedium(value: string): value is AnalyzeMedium {
  return (ANALYZE_MEDIA as readonly string[]).includes(value);
}

export function sectionOrderFor(pattern: AnalyzePattern): readonly string[] {
  return SECTION_ORDER[pattern];
}

export function forbiddenHeadingsFor(pattern: AnalyzePattern): readonly string[] {
  const allowed = new Set(sectionOrderFor(pattern));
  return ALL_ANALYZE_HEADINGS.filter((heading) => !allowed.has(heading));
}

export const ALL_ANALYZE_HEADINGS: readonly string[] = uniqueHeadings([
  ...PERSON_SECTIONS,
  ...OBJECT_SECTIONS,
  ...LAYOUT_SECTIONS,
  ...SCENE_SECTIONS,
]);

function uniqueHeadings(headings: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const heading of headings) {
    if (seen.has(heading)) continue;
    seen.add(heading);
    out.push(heading);
  }
  return out;
}

/** BCP-47 → English language name for the extract contract (`ru` → Russian). */
export function analyzeBodyLanguageName(locale: string): string {
  const lang = (locale.split("-")[0] || "en").trim().toLowerCase() || "en";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(lang) || "English";
  } catch {
    return "English";
  }
}

function languageBlock(locale: string, controlTokens: boolean): string {
  const bodyLanguage = analyzeBodyLanguageName(locale);
  return [
    "LANGUAGE (mandatory):",
    "- Keep every section heading in English.",
    `- Write every section body in ${bodyLanguage}. A section body is the text after each heading.`,
    "- The tokens none and not visible stay exactly as written. Latin camera units (mm, K) stay as written.",
    ...(controlTokens
      ? ["- Pattern and Medium values stay the English tokens listed below."]
      : []),
  ].join("\n");
}

function languageCheck(locale: string): string {
  const bodyLanguage = analyzeBodyLanguageName(locale);
  return `LANGUAGE CHECK: every section body must be ${bodyLanguage}. Headings stay English.`;
}

function headingList(pattern: AnalyzePattern): string {
  return sectionOrderFor(pattern)
    .map((heading) => `${heading}:`)
    .join(" → ");
}

/** Spec dictionary for the given headings, written once. */
function specBlock(headings: readonly string[], locale: string): string {
  const bodyLanguage = analyzeBodyLanguageName(locale);
  const lines = headings.map((heading) => {
    const shape = LIST_SECTIONS.has(heading) ? "" : ` Body in ${bodyLanguage}, full sentences.`;
    return `${heading}:\n${SECTION_SPECS[heading]}${shape}`;
  });
  return ["SECTION SPECS (follow for every section you output):", ...lines].join("\n\n");
}

const OUTPUT_FORMAT = `Output ONLY the sections for that Pattern, in the listed order. Each heading is on its own line, exactly as written with the colon, and the body starts on the NEXT line, never on the heading line. Example:
Lighting:
Soft overcast key from above…
Each section exactly once. Do not output sections from other patterns. Do not write “not applicable”, “не применимо”, “n/a”, or “não aplicável”. If a detail is absent, write none. Do not output CRITICAL RULES.`;

const DECISION = `PATTERN (first line of the answer, exactly one token):
Pattern: person
Pattern: object
Pattern: layout
Pattern: scene

MEDIUM (second line, exactly one token):
Medium: photo
Medium: illustration
Medium: graphic
Medium: 3d

Decision order:
1. If the image is an identity document, passport, payment card, or a form whose purpose is personal data, still pick the visual pattern below, but Text must be exactly none. Do not transcribe document numbers, card numbers, addresses, or full names.
2. If readable words, a poster, card, diagram, UI, scoreboard, or infographic are the point of the image, use layout. A drawn character does not override this.
3. Otherwise, if the subject is a product, garment on a mannequin, still life, food, tool, or device, and no person is the subject, use object. A mannequin is not a person.
4. Otherwise, if a real or illustrated person, or an anthropomorphic character without a text layout, is the subject, use person.
5. Otherwise use scene.

Medium: a camera photograph is photo; a drawing, watercolor, anime, or illustrated character is illustration; a flat vector, poster, UI, or diagram is graphic; a rendered still is 3d.

Do not output Pattern or Medium again after the second line.`;

export function buildRouterExtractPrompt(locale: string): string {
  const patternLists = [
    "SECTIONS PER PATTERN:",
    ...ANALYZE_PATTERNS.map((pattern) => `${pattern}: ${headingList(pattern)}`),
  ].join("\n");
  return [
    languageBlock(locale, true),
    QUALITY_HEADER,
    DECISION,
    OUTPUT_FORMAT,
    patternLists,
    specBlock(ALL_ANALYZE_HEADINGS, locale),
    languageCheck(locale),
  ].join("\n\n");
}

export function buildLockedExtractPrompt(
  pattern: AnalyzePattern,
  medium: AnalyzeMedium,
  locale: string,
): string {
  return [
    languageBlock(locale, false),
    QUALITY_HEADER,
    `Pattern is ${pattern}. Medium is ${medium}. Do not output Pattern or Medium lines.`,
    OUTPUT_FORMAT,
    `SECTIONS: ${headingList(pattern)}`,
    specBlock(sectionOrderFor(pattern), locale),
    languageCheck(locale),
  ].join("\n\n");
}

export type ParsedAnalyzeDraft = {
  pattern: AnalyzePattern | null;
  medium: AnalyzeMedium | null;
  body: string;
  patternLineInvalid: boolean;
  mediumLineInvalid: boolean;
};

function stripFences(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .trim()
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseAnalyzeDraft(raw: string): ParsedAnalyzeDraft {
  const lines = stripFences(raw).split("\n");
  let index = 0;
  while (index < lines.length && !lines[index].trim()) index += 1;

  let pattern: AnalyzePattern | null = null;
  let medium: AnalyzeMedium | null = null;
  let patternLineInvalid = false;
  let mediumLineInvalid = false;

  const patternMatch = lines[index]?.match(/^Pattern:\s*(.*?)\s*$/i);
  if (patternMatch) {
    const token = patternMatch[1].trim().toLowerCase();
    if (isAnalyzePattern(token)) pattern = token;
    else patternLineInvalid = true;
    index += 1;
    while (index < lines.length && !lines[index].trim()) index += 1;
  }

  const mediumMatch = lines[index]?.match(/^Medium:\s*(.*?)\s*$/i);
  if (mediumMatch) {
    const token = mediumMatch[1].trim().toLowerCase();
    if (isAnalyzeMedium(token)) medium = token;
    else mediumLineInvalid = true;
    index += 1;
    while (index < lines.length && !lines[index].trim()) index += 1;
  }

  return {
    pattern,
    medium,
    body: lines.slice(index).join("\n").trim(),
    patternLineInvalid,
    mediumLineInvalid,
  };
}

function escapeHeading(heading: string): string {
  return heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const KNOWN_LAYOUT_HEADINGS: readonly string[] = [...ALL_ANALYZE_HEADINGS, "CRITICAL RULES"];

/**
 * Put every known heading on its own line. Models sometimes write
 * `Lighting: Soft key…` or glue two headings; the validator, remix splitter and
 * stored prompt all expect `Lighting:\nSoft key…`.
 */
export function normalizeAnalyzeLayout(text: string): string {
  let out = text.replace(/\r\n/g, "\n");
  const alternation = KNOWN_LAYOUT_HEADINGS.map(escapeHeading).join("|");
  // Markdown emphasis around headings: **Lighting:** → Lighting:
  out = out.replace(new RegExp(`^\\*\\*(${alternation}):?\\*\\*:?`, "gm"), "$1:");
  // Body on the heading line: "Lighting: Soft key" → "Lighting:\nSoft key".
  // Anchored to line start, so "Text:" quoted inside a body line is left alone.
  out = out.replace(new RegExp(`^(${alternation}):[ \\t]+(\\S)`, "gm"), "$1:\n$2");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function splitAnalyzeSections(
  input: string,
): Array<{ heading: string | null; body: string }> {
  const text = normalizeAnalyzeLayout(input);
  const re = new RegExp(`^(${KNOWN_LAYOUT_HEADINGS.map(escapeHeading).join("|")}):\\s*$`, "gim");
  const matches = [...text.matchAll(re)];
  if (!matches.length) {
    const body = text.trim();
    return body ? [{ heading: null, body }] : [];
  }
  const sections: Array<{ heading: string | null; body: string }> = [];
  const preamble = text.slice(0, matches[0].index).trim();
  if (preamble) sections.push({ heading: null, body: preamble });
  for (let i = 0; i < matches.length; i += 1) {
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    sections.push({
      heading: matches[i][1],
      body: text.slice(start, end).trim(),
    });
  }
  return sections;
}

export function validateAnalyzeDraft(input: {
  pattern: AnalyzePattern;
  medium: AnalyzeMedium;
  body: string;
}): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  const order = sectionOrderFor(input.pattern);
  const allowed = new Set(order);
  const sections = splitAnalyzeSections(input.body);
  if (sections.some((section) => section.heading === null && section.body.trim())) {
    reasons.push("preamble");
  }
  const headed = sections.filter(
    (section): section is { heading: string; body: string } => section.heading !== null,
  );
  const counts = new Map<string, number>();
  for (const section of headed) {
    counts.set(section.heading, (counts.get(section.heading) ?? 0) + 1);
    if (!allowed.has(section.heading)) {
      reasons.push(
        ALL_ANALYZE_HEADINGS.includes(section.heading) || section.heading === "CRITICAL RULES"
          ? `forbidden ${section.heading}`
          : `unknown ${section.heading}`,
      );
    }
    if (!section.body.trim()) reasons.push(`empty ${section.heading}`);
    else if (NA_BODY.test(section.body)) reasons.push(`${section.heading} is not applicable`);
  }
  for (const heading of order) {
    const count = counts.get(heading) ?? 0;
    if (count === 0) reasons.push(`missing ${heading}`);
    else if (count > 1) reasons.push(`duplicate ${heading}`);
  }
  const present = headed.map((section) => section.heading);
  if (present.join("|") !== order.join("|") && !reasons.some((reason) => reason.startsWith("missing") || reason.startsWith("forbidden") || reason.startsWith("duplicate"))) {
    reasons.push("section order");
  }
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

export function patternCriticalRules(
  pattern: AnalyzePattern,
  medium: AnalyzeMedium,
  locale: string,
): string {
  const ru = locale.split("-")[0] === "ru";
  const photo = medium === "photo";
  if (pattern === "person") {
    return ru
      ? [
          "CRITICAL RULES",
          "- Повтори кадр по секциям выше. Исходное фото в генерацию не прикладывается: внешность брать из Appearance, не из фразы «сохрани лицо».",
          "- Строки из Text, кроме none, выведи дословно.",
          photo
            ? "- Фотореалистичный результат, высокая детализация текстур."
            : "- Сохрани носитель из Genre и Avoid. Не переводи иллюстрацию или 3D в фотографию.",
        ].join("\n")
      : [
          "CRITICAL RULES",
          "- Repeat the frame from the sections above. The source photo is not attached to generation: take appearance from Appearance, not from a phrase about preserving a face.",
          "- Render every Text line except none verbatim.",
          photo
            ? "- Photorealistic result with high textural detail."
            : "- Keep the medium named in Genre and Avoid. Do not turn an illustration or 3D image into a photograph.",
        ].join("\n");
  }
  if (pattern === "object") {
    return ru
      ? [
          "CRITICAL RULES",
          "- В кадре нет человека, которого нужно сохранять. Не добавляй лицо, тело, позу и макияж.",
          "- Повтори предмет: форму, материал, маркировку и постановку из секций выше.",
          "- Строки из Text, кроме none, выведи дословно.",
          photo
            ? "- Фотореалистичная предметная съёмка."
            : "- Сохрани носитель. Не переводи иллюстрацию в фотографию.",
        ].join("\n")
      : [
          "CRITICAL RULES",
          "- There is no person to preserve. Do not add a face, body, pose, or makeup.",
          "- Repeat the object: shape, material, markings, and staging from the sections above.",
          "- Render every Text line except none verbatim.",
          photo
            ? "- Photorealistic product photograph."
            : "- Keep the medium. Do not turn an illustration into a photograph.",
        ].join("\n");
  }
  if (pattern === "layout") {
    return ru
      ? [
          "CRITICAL RULES",
          "- Это макет, не фотосессия. Не добавляй объектив, лицо и анатомию.",
          "- Носитель взять из Rendering. Иллюстрацию и схему не переводить в фотографию.",
          "- Каждую строку из Text вывести дословно, в том же порядке и на том же языке.",
        ].join("\n")
      : [
          "CRITICAL RULES",
          "- This is a layout, not a portrait shoot. Do not add a lens, a face, or anatomy.",
          "- Take the medium from Rendering. Do not turn an illustration or diagram into a photograph.",
          "- Render every Text line verbatim, in the same order and language.",
        ].join("\n");
  }
  return ru
    ? [
        "CRITICAL RULES",
        "- Не добавляй людей, если в секциях их нет.",
        "- Повтори место, свет, объектив и планы из секций выше.",
        photo
          ? "- Фотореалистичный пейзаж или интерьер."
          : "- Сохрани носитель. Не переводи изображение в фотографию.",
        "- Строки из Text, кроме none, выведи дословно.",
      ].join("\n")
    : [
        "CRITICAL RULES",
        "- Do not add people when the sections do not include them.",
        "- Repeat the place, light, lens, and depth planes from the sections above.",
        photo
          ? "- Photorealistic landscape or interior."
          : "- Keep the medium. Do not turn the image into a photograph.",
        "- Render every Text line except none verbatim.",
      ].join("\n");
}

export function rejectionSuffix(reasons: string[], locked: boolean): string {
  const why = reasons.join("; ");
  if (locked) {
    return `REJECTED: ${why}. Answer again. Do not output Pattern or Medium lines. Output only the required headings, in order. Do not write not applicable.`;
  }
  return `REJECTED: ${why}. Answer again from scratch. The first line is Pattern and the second line is Medium, using only the allowed tokens. Then output only the headings for that Pattern. Do not write not applicable.`;
}
