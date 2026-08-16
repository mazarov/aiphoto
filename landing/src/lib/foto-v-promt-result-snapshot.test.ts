import assert from "node:assert/strict";
import test from "node:test";
import { parseFotoVPromtResultSnapshot } from "./foto-v-promt-result-snapshot";

test("parseFotoVPromtResultSnapshot keeps prompt and small data-url preview", () => {
  const raw = JSON.stringify({
    promptText: "neon alley",
    previewUrl: "data:image/jpeg;base64,abc",
  });
  assert.deepEqual(parseFotoVPromtResultSnapshot(raw), {
    promptText: "neon alley",
    previewUrl: "data:image/jpeg;base64,abc",
  });
});

test("parseFotoVPromtResultSnapshot drops blob previews and empty prompts", () => {
  assert.equal(parseFotoVPromtResultSnapshot(null), null);
  assert.equal(parseFotoVPromtResultSnapshot(JSON.stringify({ promptText: "   " })), null);
  assert.deepEqual(
    parseFotoVPromtResultSnapshot(
      JSON.stringify({ promptText: "scene", previewUrl: "blob:https://promptshot.ru/x" }),
    ),
    { promptText: "scene" },
  );
});
