import { analyzeBodyLanguageName } from "@/lib/extension-prompt-sections";

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

const SECTION_SPECS: Record<string, string> = {
  "Visual Hook":
    "One sentence naming what must survive: the distinctive silhouette, object, or layout. Do not catalogue every detail.",
  Scene:
    "Where it is and what is happening, in 1–2 sentences. Put appearance in Appearance, not here.",
  Genre:
    "Short genre label, such as fashion portrait, product photo, poster, or landscape.",
  Appearance:
    "What is required to repeat the person without the source photo: hair length and color, approximate age band, build, and visible distinguishing features. Do not write “preserve the face” and do not ask for a reference photo.",
  Pose:
    "Torso orientation, head turn, gaze, shoulders, spine, visible limbs and contacts. Occluded parts: none. No focal length.",
  Lighting:
    "Key direction and hardness, fill or rim, color temperature, shadows and highlights.",
  Camera:
    "Full-frame focal-length range, framing, camera height, viewing angle, depth of field. Preserve crop and subject scale.",
  Mood: "Emotional tone in one or two sentences.",
  Color: "Dominant and accent colors, contrast, saturation, grade.",
  Clothing:
    "Visible garments, cut, color, material, fit, accessories. Use none where nothing is visible.",
  Makeup:
    "Visible cosmetics only. Use none when no makeup is visible. Do not describe identity.",
  Composition:
    "Placement, crop, foreground, midground, background, and negative space.",
  Text:
    "Every readable string that must be reproduced, one per line, original language and spelling. Skip illegible scribbles. If there is no readable text, the body is exactly: none",
  Avoid:
    "Short anti-drift list for this pattern only. If Medium is photo, forbid a cartoon or 3D look. If Medium is illustration or 3d, forbid turning the image into a photograph. Do not mention spine, plastic skin, or makeup unless this pattern is person and Medium is photo.",
  Object:
    "What the item is, its shape and proportions. A mannequin is a display form, not a body with a spine.",
  Materials: "Surface material, texture, and finish.",
  Markings:
    "Brand, logo, print, and embossing that are actually readable. Do not invent marks.",
  Staging:
    "Surface, background, neighboring objects, and how the item sits or stands.",
  Rendering:
    "The carrier in one or two sentences: watercolor, vector, diagram, 3D, newspaper illustration, or similar.",
  Canvas: "Orientation, margins, and background.",
  Regions:
    "Blocks in reading order, top to bottom and left to right. Describe what each block contains. Do not copy the strings; those belong in Text.",
  Icons:
    "Signs, arrows, logos, and decorative symbols. If there are none, the body is exactly: none",
  Environment:
    "Foreground, midground, and background, plus weather or architecture. Do not add people.",
};

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

function languageBlock(locale: string, controlTokens: boolean): string {
  const bodyLanguage = analyzeBodyLanguageName(locale);
  return [
    "LANGUAGE (mandatory):",
    "- Keep every section heading in English.",
    `- Write every section body in ${bodyLanguage}.`,
    "- The token none stays exactly none.",
    ...(controlTokens
      ? ["- Pattern and Medium values stay the English tokens listed below."]
      : []),
    `- LANGUAGE CHECK: every section body must be ${bodyLanguage}.`,
  ].join("\n");
}

function sectionBlock(headings: readonly string[], locale: string): string {
  const bodyLanguage = analyzeBodyLanguageName(locale);
  return headings
    .map(
      (heading) =>
        `${heading}:\nWrite the body in ${bodyLanguage}. ${SECTION_SPECS[heading]}`,
    )
    .join("\n\n");
}

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

Then output ONLY the sections for that Pattern, in the listed order. Each heading is on its own line and the body starts on the next line. Each section exactly once. Do not output sections from other patterns. Do not write “not applicable”, “не применимо”, “n/a”, or “não aplicável”. If a detail is absent, write none. Do not output Pattern or Medium again after the second line. Do not output CRITICAL RULES.`;

export function buildRouterExtractPrompt(locale: string): string {
  const blocks = ANALYZE_PATTERNS.map((pattern) =>
    [
      `If Pattern is ${pattern}, output only these sections in this order:`,
      sectionBlock(sectionOrderFor(pattern), locale),
    ].join("\n\n"),
  );
  return [languageBlock(locale, true), DECISION, ...blocks].join("\n\n");
}

export function buildLockedExtractPrompt(
  pattern: AnalyzePattern,
  medium: AnalyzeMedium,
  locale: string,
): string {
  return [
    languageBlock(locale, false),
    `Pattern is ${pattern}. Medium is ${medium}. Do not output Pattern or Medium lines.`,
    "Output only the sections below, in this order. Each heading is on its own line. Each section exactly once.",
    "Do not write “not applicable”, “не применимо”, “n/a”, or “não aplicável”. If a detail is absent, write none.",
    "Do not output CRITICAL RULES.",
    sectionBlock(sectionOrderFor(pattern), locale),
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

export function splitAnalyzeSections(
  text: string,
): Array<{ heading: string | null; body: string }> {
  const known = [...ALL_ANALYZE_HEADINGS, "CRITICAL RULES"];
  const re = new RegExp(`^(${known.map(escapeHeading).join("|")}):\\s*$`, "gim");
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
