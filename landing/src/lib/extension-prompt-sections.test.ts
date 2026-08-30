import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeBodyLanguageName,
  buildExtractLanguageContract,
  buildExtractPrompt,
} from "./extension-prompt-sections";

test("analyzeBodyLanguageName maps BCP-47 to an English language name", () => {
  assert.equal(analyzeBodyLanguageName("ru"), "Russian");
  assert.equal(analyzeBodyLanguageName("ru-RU"), "Russian");
  assert.equal(analyzeBodyLanguageName("en"), "English");
});

test("extract language contract is first and names the body language", () => {
  const ru = buildExtractPrompt("photoreal", "ru");
  const en = buildExtractPrompt("photoreal", "en");
  assert.ok(ru.startsWith("LANGUAGE (mandatory):"));
  assert.match(ru, /Write every section body in Russian/);
  assert.match(ru, /Write the body in Russian/);
  assert.match(ru, /LANGUAGE CHECK: every section body must be Russian/);
  assert.match(ru, /Keep every section heading exactly in English/);
  assert.doesNotMatch(ru, /Write descriptive section bodies in ru\b/);
  assert.match(en, /Write every section body in English/);
  assert.equal(buildExtractLanguageContract("ru").includes("Russian"), true);
});
