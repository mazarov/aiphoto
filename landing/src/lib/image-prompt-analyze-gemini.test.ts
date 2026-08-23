import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzePromptDiagnostics,
  appendAnalyzeCriticalRules,
  normalizeAnalyzeLocale,
} from "./image-prompt-analyze-gemini";

test("normalizeAnalyzeLocale falls back to en", () => {
  assert.equal(normalizeAnalyzeLocale(undefined), "en");
  assert.equal(normalizeAnalyzeLocale(""), "en");
  assert.equal(normalizeAnalyzeLocale("ru"), "ru");
});

test("appendAnalyzeCriticalRules keeps RU rules for ru locale", () => {
  const ru = appendAnalyzeCriticalRules("Subject: test", "ru");
  assert.match(ru, /Сохранить: структуру лица/);
  const en = appendAnalyzeCriticalRules("Subject: test", "en");
  assert.match(en, /Preserve: face structure/);
});

test("analyzePromptDiagnostics flags missing sections", () => {
  const empty = analyzePromptDiagnostics("hello", null);
  assert.ok(empty.missing.length > 0);
  assert.equal(empty.truncated, true);
});
