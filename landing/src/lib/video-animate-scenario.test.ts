import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnimateScenarioUserText,
  isGenericVideoPrompt,
  sanitizeAnimateScenario,
} from "./video-animate-scenario";

test("generic video prompt is the default animate phrase", () => {
  assert.equal(isGenericVideoPrompt(""), true);
  assert.equal(isGenericVideoPrompt("Оживи изображение"), true);
  assert.equal(isGenericVideoPrompt("оживи изображение."), true);
  assert.equal(isGenericVideoPrompt("Ветер шевелит волосы"), false);
});

test("sanitizeAnimateScenario strips quotes and caps length", () => {
  assert.equal(sanitizeAnimateScenario('  «Ветер шевелит волосы»  '), "Ветер шевелит волосы");
  const long = "а".repeat(500);
  assert.ok(sanitizeAnimateScenario(long).length <= 400);
});

test("user text includes original prompt only when it is specific", () => {
  assert.doesNotMatch(
    buildAnimateScenarioUserText("Оживи изображение"),
    /ORIGINAL_IMAGE_PROMPT/
  );
  assert.match(
    buildAnimateScenarioUserText("Девушка в красном пальто на набережной"),
    /красном пальто/
  );
});