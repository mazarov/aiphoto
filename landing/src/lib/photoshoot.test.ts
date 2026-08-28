import assert from "node:assert/strict";
import test from "node:test";
import {
  PHOTOSHOOT_EDIT_KIND,
  extractJsonObject,
  looksLikePhotoshootInstruction,
  parsePhotoshootPlan,
  photoshootFingerprintFields,
  photoshootTileStoragePath,
  parsePhotoshootTilePaths,
  resolvePhotoshootSheetAspect,
  resolvePhotoshootUserFacingResult,
  serializePhotoshootEnqueueInstruction,
  serializePhotoshootSheetInstruction,
} from "./photoshoot";
import { PHOTOSHOOT_PLANNER_GENERATION_CONFIG } from "./photoshoot-planner";

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

test("parsePhotoshootPlan accepts frames alias, missing lens, and extra shots", () => {
  const parsed = parsePhotoshootPlan({
    frames: [
      ...validPlan.shots,
      { i: 5, pose: "extra", motion: "skip", lens: "24mm" },
    ],
  });
  assert.ok(parsed);
  assert.equal(parsed.theme, "editorial portraits");
  assert.equal(parsed.shots[0].lens, "85mm, waist-up");
  assert.equal(
    parsePhotoshootPlan({
      theme: "x",
      shots: validPlan.shots.map(({ i, pose, motion }) => ({ i, pose, motion })),
    })?.shots[0].lens,
    "85mm",
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
  const text = serializePhotoshootSheetInstruction(plan, "9:16");
  assert.match(text, /^PHOTOSHOOT/);
  assert.match(text, /Canvas 9:16/);
  assert.match(text, /Each panel is also 9:16/);
  assert.match(text, /Panel 1:/);
  assert.match(text, /Panel 4:/);
  assert.match(text, /LOCK: identity/);
  assert.doesNotMatch(text, /keep the source pose/i);
  assert.doesNotMatch(text, /CAMERA ORBIT/);
});

test("resolvePhotoshootSheetAspect snaps source format to 1:1, 16:9, or 9:16", () => {
  assert.equal(resolvePhotoshootSheetAspect({ aspectRatio: "1:1" }), "1:1");
  assert.equal(resolvePhotoshootSheetAspect({ aspectRatio: "16:9" }), "16:9");
  assert.equal(resolvePhotoshootSheetAspect({ aspectRatio: "9:16" }), "9:16");
  assert.equal(resolvePhotoshootSheetAspect({ aspectRatio: "4:3" }), "16:9");
  assert.equal(resolvePhotoshootSheetAspect({ aspectRatio: "3:2" }), "16:9");
  assert.equal(resolvePhotoshootSheetAspect({ aspectRatio: "3:4" }), "9:16");
  assert.equal(resolvePhotoshootSheetAspect({ aspectRatio: "2:3" }), "9:16");
  assert.equal(resolvePhotoshootSheetAspect({ width: 720, height: 1280 }), "9:16");
  assert.equal(resolvePhotoshootSheetAspect({ width: 1920, height: 1080 }), "16:9");
  assert.equal(resolvePhotoshootSheetAspect({ width: 1024, height: 1024 }), "1:1");
});

test("planner generation config disables Flash thinking", () => {
  assert.equal(PHOTOSHOOT_PLANNER_GENERATION_CONFIG.thinkingConfig.thinkingBudget, 0);
  assert.equal(PHOTOSHOOT_PLANNER_GENERATION_CONFIG.responseMimeType, "application/json");
  assert.ok(PHOTOSHOOT_PLANNER_GENERATION_CONFIG.maxOutputTokens >= 2048);
});

test("photoshoot tile paths sit next to the sheet object", () => {
  assert.equal(
    photoshootTileStoragePath("user/job/lease.jpg", 3),
    "user/job/lease-3.jpg",
  );
  assert.deepEqual(parsePhotoshootTilePaths(["a", "b", "c", "d"]), ["a", "b", "c", "d"]);
  assert.equal(parsePhotoshootTilePaths(["a", "b", "c"]), null);
});

test("photoshoot user-facing result never exposes the sheet", () => {
  const tiles = [
    "user/job/lease-1.jpg",
    "user/job/lease-2.jpg",
    "user/job/lease-3.jpg",
    "user/job/lease-4.jpg",
  ];
  assert.deepEqual(
    resolvePhotoshootUserFacingResult({
      editKind: PHOTOSHOOT_EDIT_KIND,
      sheetPath: "user/job/lease.jpg",
      tilePaths: tiles,
    }),
    { resultPath: tiles[0], tilePaths: tiles },
  );
  assert.deepEqual(
    resolvePhotoshootUserFacingResult({
      editKind: PHOTOSHOOT_EDIT_KIND,
      sheetPath: "user/job/lease.jpg",
      tilePaths: null,
    }),
    { resultPath: null, tilePaths: null },
  );
  assert.deepEqual(
    resolvePhotoshootUserFacingResult({
      editKind: "local_edit",
      sheetPath: "user/job/lease.jpg",
      tilePaths: null,
    }),
    { resultPath: "user/job/lease.jpg", tilePaths: null },
  );
});

test("photoshoot fingerprint is parent + kind", () => {
  assert.deepEqual(photoshootFingerprintFields("root-1"), {
    editKind: PHOTOSHOOT_EDIT_KIND,
    parentGenerationId: "root-1",
  });
});
