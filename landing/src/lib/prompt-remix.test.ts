import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRemixEdits,
  hasStructuredRemixSections,
  joinPromptSections,
  listRemixHeadings,
  normalizeRemixPrompt,
  parseRemixModelJson,
  remixPromptsEqual,
  resolveRemixPrompt,
  splitPromptSections,
} from "./prompt-remix";

const SOURCE = [
  "Visual Hook:",
  "A candid night-time portrait.",
  "",
  "Scene:",
  "Два человека стоят рядом на мокрой мостовой ночью.",
  "",
  "Mood:",
  "Спокойное и дружелюбное настроение.",
  "",
  "Avoid:",
  "Неподходящее освещение.",
  "",
  "CRITICAL RULES",
  "- Сохранить: структуру лица, черты, тон кожи.",
  "- Фотореалистичный результат.",
].join("\n");

test("split/join keeps section headings and CRITICAL RULES without a colon", () => {
  const sections = splitPromptSections(SOURCE);
  assert.deepEqual(
    sections.map((section) => section.heading),
    ["Visual Hook", "Scene", "Mood", "Avoid", "CRITICAL RULES"]
  );
  assert.equal(sections.at(-1)?.headingLine, "CRITICAL RULES");
  assert.equal(hasStructuredRemixSections(SOURCE), true);
  assert.deepEqual(listRemixHeadings(SOURCE), [
    "Visual Hook",
    "Scene",
    "Mood",
    "Avoid",
    "CRITICAL RULES",
  ]);
  assert.equal(remixPromptsEqual(joinPromptSections(sections), SOURCE), true);
});

test("applyRemixEdits rewrites only named sections and ignores no-ops", () => {
  const applied = applyRemixEdits(SOURCE, [
    {
      heading: "scene",
      body: "Один человек стоит на мокрой мостовой днём.",
    },
    {
      heading: "Mood",
      body: "Спокойное и дружелюбное настроение.",
    },
    {
      heading: "Missing",
      body: "should be ignored",
    },
  ]);
  assert.deepEqual(applied.appliedHeadings, ["Scene"]);
  assert.deepEqual(applied.unknownHeadings, ["Missing"]);
  assert.equal(applied.prompt.includes("Один человек стоит на мокрой мостовой днём."), true);
  assert.equal(applied.prompt.includes("A candid night-time portrait."), true);
  assert.equal(applied.prompt.includes("CRITICAL RULES\n- Сохранить"), true);
  assert.equal(remixPromptsEqual(applied.prompt, SOURCE), false);
});

test("applyRemixEdits returns the source when every edit is a no-op", () => {
  const applied = applyRemixEdits(SOURCE, [
    {
      heading: "Scene",
      body: "Два человека стоят рядом на мокрой мостовой ночью.",
    },
  ]);
  assert.deepEqual(applied.appliedHeadings, []);
  assert.equal(applied.prompt, normalizeRemixPrompt(SOURCE));
});

test("parseRemixModelJson accepts fenced JSON and resolveRemixPrompt prefers section edits", () => {
  const plan = parseRemixModelJson(
    [
      "```json",
      JSON.stringify({
        changeApplied: true,
        edits: [
          {
            heading: "Scene",
            body: "Один человек стоит на солнечной улице.",
          },
        ],
        prompt: SOURCE,
      }),
      "```",
    ].join("\n")
  );
  assert.ok(plan);
  assert.equal(plan?.changeApplied, true);
  const resolved = resolveRemixPrompt(SOURCE, plan, SOURCE);
  assert.equal(resolved.mode, "section_edits");
  assert.deepEqual(resolved.appliedHeadings, ["Scene"]);
  assert.equal(resolved.prompt.includes("солнечной улице"), true);
  assert.equal(remixPromptsEqual(resolved.prompt, SOURCE), false);
});

test("resolveRemixPrompt falls back to a rewritten prompt when edits are missing", () => {
  const next = `${SOURCE}\n\nMake the scene daytime.`;
  const resolved = resolveRemixPrompt(
    SOURCE,
    { changeApplied: true, edits: [], prompt: next },
    SOURCE
  );
  assert.equal(resolved.mode, "full_rewrite");
  assert.equal(resolved.prompt, next);
});

test("unstructured prompts are not treated as sectioned", () => {
  assert.equal(hasStructuredRemixSections("девушка в красном пальто, вечерний город"), false);
});
