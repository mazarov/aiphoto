import assert from "node:assert/strict";
import test from "node:test";
import {
  ANIMATE_SCENARIO_SYSTEM_PROMPT,
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

test("user text asks for motion only and ignores the still prompt", () => {
  assert.doesNotMatch(
    buildAnimateScenarioUserText("Девушка в красном пальто на набережной"),
    /ORIGINAL_IMAGE_PROMPT|красном пальто/
  );
  assert.match(buildAnimateScenarioUserText(), /Do not describe the person's looks/);
  assert.match(buildAnimateScenarioUserText(), /Сюжет начинается с этого кадра/);
});

test("scenario prompt starts from this still and forbids reframing", () => {
  assert.match(ANIMATE_SCENARIO_SYSTEM_PROMPT, /frame 0|story starts here/);
  assert.match(ANIMATE_SCENARIO_SYSTEM_PROMPT, /Do not invent a lead-in/);
  assert.match(ANIMATE_SCENARIO_SYSTEM_PROMPT, /Do not restate appearance/);
  assert.match(ANIMATE_SCENARIO_SYSTEM_PROMPT, /new camera angle/);
  assert.doesNotMatch(ANIMATE_SCENARIO_SYSTEM_PROMPT, /shareable|hook and payoff/i);
});