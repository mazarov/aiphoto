import assert from "node:assert/strict";
import test from "node:test";
import {
  PHOTOSHOOT_EDIT_KIND,
  extractJsonObject,
  looksLikePhotoshootInstruction,
  parsePhotoshootPlan,
  photoshootFingerprintFields,
  serializePhotoshootEnqueueInstruction,
  serializePhotoshootSheetInstruction,
} from "./photoshoot";

const validPlan = {
  theme: "golden hour rooftop editorial",
  shots: [
    { i: 1, pose: "weight on left leg", motion: "chin down", lens: "85mm, waist-up" },
    { i: 2, pose: "step toward camera", motion: "hair catch", lens: "50mm, three-quarter" },
    { i: 3, pose: "torso three-quarter", motion: "hand in pocket", lens: "85mm, portrait" },
    { i: 4, pose: "sit on ledge", motion: "look off frame", lens: "35mm, full" },
  ],
};

test("looksLikePhotoshootInstruction matches enqueue marker only", () => {
  assert.equal(looksLikePhotoshootInstruction(serializePhotoshootEnqueueInstruction()), true);
  assert.equal(looksLikePhotoshootInstruction("PHOTOSHOOT (HIGHEST PRIORITY)"), true);
  assert.equal(looksLikePhotoshootInstruction("Remove the scarf"), false);
  assert.equal(looksLikePhotoshootInstruction("CAMERA ORBIT"), false);
});

test("parsePhotoshootPlan requires four unique shots", () => {
  assert.ok(parsePhotoshootPlan(validPlan));
  assert.equal(parsePhotoshootPlan({ theme: "x", shots: validPlan.shots.slice(0, 3) }), null);
  assert.equal(
    parsePhotoshootPlan({
      theme: "x",
      shots: [...validPlan.shots.slice(0, 3), { ...validPlan.shots[0] }],
    }),
    null,
  );
  assert.equal(
    parsePhotoshootPlan({
      theme: "x",
      shots: validPlan.shots.map((shot) => ({ ...shot, pose: "" })),
    }),
    null,
  );
});

test("extractJsonObject reads fenced or raw JSON", () => {
  const parsed = extractJsonObject("```json\n" + JSON.stringify(validPlan) + "\n```");
  assert.deepEqual(parsePhotoshootPlan(parsed), parsePhotoshootPlan(validPlan));
  assert.equal(extractJsonObject("not json"), null);
});

test("serializePhotoshootSheetInstruction lists four panels and locks identity", () => {
  const plan = parsePhotoshootPlan(validPlan);
  assert.ok(plan);
  const text = serializePhotoshootSheetInstruction(plan);
  assert.match(text, /^PHOTOSHOOT/);
  assert.match(text, /Panel 1:/);
  assert.match(text, /Panel 4:/);
  assert.match(text, /LOCK: identity/);
  assert.doesNotMatch(text, /keep the source pose/i);
  assert.doesNotMatch(text, /CAMERA ORBIT/);
});

test("photoshoot fingerprint is parent + kind", () => {
  assert.deepEqual(photoshootFingerprintFields("root-1"), {
    editKind: PHOTOSHOOT_EDIT_KIND,
    parentGenerationId: "root-1",
  });
});
