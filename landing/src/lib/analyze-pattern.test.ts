import assert from "node:assert/strict";
import test from "node:test";
import {
  ANALYZE_PATTERNS,
  buildLockedExtractPrompt,
  buildRouterExtractPrompt,
  forbiddenHeadingsFor,
  isAnalyzePatternRouterFlagValue,
  parseAnalyzeDraft,
  patternCriticalRules,
  sectionOrderFor,
  validateAnalyzeDraft,
} from "./analyze-pattern";
import { appendAnalyzeCriticalRules } from "./image-prompt-analyze-gemini";

function sectionBody(headings: readonly string[], overrides: Record<string, string> = {}): string {
  return headings
    .map((heading) => `${heading}:\n${overrides[heading] ?? `${heading} body`}`)
    .join("\n\n");
}

test("each pattern forbids only headings outside its own order", () => {
  for (const pattern of ANALYZE_PATTERNS) {
    const allowed = new Set(sectionOrderFor(pattern));
    assert.ok(allowed.size > 3);
    for (const heading of forbiddenHeadingsFor(pattern)) {
      assert.equal(allowed.has(heading), false, `${pattern} forbids ${heading}`);
    }
  }
  assert.ok(forbiddenHeadingsFor("object").includes("Pose"));
  assert.ok(forbiddenHeadingsFor("layout").includes("Camera"));
  assert.ok(forbiddenHeadingsFor("scene").includes("Makeup"));
});

test("router prompt names every pattern and does not ban appearance", () => {
  const ru = buildRouterExtractPrompt("ru");
  assert.match(ru, /Write every section body in Russian/);
  for (const pattern of ANALYZE_PATTERNS) {
    assert.match(ru, new RegExp(`Pattern: ${pattern}`));
  }
  assert.doesNotMatch(ru, /do not describe identity, facial features/i);
  assert.match(ru, /Appearance/);
});

test("locked person prompt does not ask for a Pattern line", () => {
  const prompt = buildLockedExtractPrompt("person", "photo", "ru");
  assert.doesNotMatch(prompt, /^Pattern:/m);
  assert.match(prompt, /Pattern is person/);
  assert.match(prompt, /Appearance:/);
});

test("parser strips Pattern and Medium and rejects unknown tokens", () => {
  const parsed = parseAnalyzeDraft(
    ["Pattern: layout", "Medium: graphic", "", "Visual Hook:", "A poster."].join("\n"),
  );
  assert.equal(parsed.pattern, "layout");
  assert.equal(parsed.medium, "graphic");
  assert.equal(parsed.body.startsWith("Visual Hook:"), true);
  assert.doesNotMatch(parsed.body, /^Pattern:/m);

  const invalid = parseAnalyzeDraft("Pattern: portrait\nMedium: photo\n\nScene:\nX");
  assert.equal(invalid.pattern, null);
  assert.equal(invalid.patternLineInvalid, true);
  assert.equal(invalid.medium, "photo");
});

test("object draft with Pose or a not-applicable body fails", () => {
  const order = sectionOrderFor("object");
  const withPose = `${sectionBody(order)}\n\nPose:\nСтоит прямо.`;
  const poseResult = validateAnalyzeDraft({
    pattern: "object",
    medium: "photo",
    body: withPose,
  });
  assert.equal(poseResult.ok, false);
  if (!poseResult.ok) assert.ok(poseResult.reasons.some((reason) => reason.includes("Pose")));

  const na = validateAnalyzeDraft({
    pattern: "object",
    medium: "photo",
    body: sectionBody(order, { Object: "не применимо" }),
  });
  assert.equal(na.ok, false);
  if (!na.ok) assert.ok(na.reasons.some((reason) => reason.includes("not applicable")));
});

test("layout without Text fails and a complete layout passes", () => {
  const order = sectionOrderFor("layout").filter((heading) => heading !== "Text");
  const missing = validateAnalyzeDraft({
    pattern: "layout",
    medium: "graphic",
    body: sectionBody(order),
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.ok(missing.reasons.includes("missing Text"));

  const ok = validateAnalyzeDraft({
    pattern: "layout",
    medium: "graphic",
    body: sectionBody(sectionOrderFor("layout"), { Text: "Регистрация" }),
  });
  assert.equal(ok.ok, true);
});

test("pattern critical rules drop the face-lock line", () => {
  const objectRules = patternCriticalRules("object", "photo", "ru");
  assert.doesNotMatch(objectRules, /структуру лица/);
  const personRules = patternCriticalRules("person", "photo", "ru");
  assert.doesNotMatch(personRules, /Сохранить: структуру лица/);
  assert.match(personRules, /Appearance/);
});

test("legacy critical rules still lock the face", () => {
  assert.match(appendAnalyzeCriticalRules("Subject: test", "ru"), /структуру лица/);
});

test("router flag is true only for the exact token", () => {
  assert.equal(isAnalyzePatternRouterFlagValue("true"), true);
  assert.equal(isAnalyzePatternRouterFlagValue(" TRUE "), true);
  assert.equal(isAnalyzePatternRouterFlagValue("false"), false);
  assert.equal(isAnalyzePatternRouterFlagValue(""), false);
  assert.equal(isAnalyzePatternRouterFlagValue(null), false);
  assert.equal(isAnalyzePatternRouterFlagValue("1"), false);
});
