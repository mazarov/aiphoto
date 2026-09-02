import assert from "node:assert/strict";
import test from "node:test";
import {
  PHOTOSHOOT_CREDIT_COST,
  PHOTOSHOOT_CTA_LABEL,
  PHOTOSHOOT_FALLBACK_DEFAULT_MODEL,
  PHOTOSHOOT_FLUX_SAFETY_TOLERANCE,
  PHOTOSHOOT_EDIT_KIND,
  PHOTOSHOOT_FRAME_COUNT,
  PHOTOSHOOT_IMAGE_SIZE,
  photoshootCtaDetail,
  photoshootOverlayChromeState,
  extractJsonObject,
  looksLikePhotoshootInstruction,
  usableCatalogPrompt,
  parsePhotoshootPlan,
  parsePhotoshootPlannerTemperature,
  photoshootFingerprintFields,
  photoshootSourceErrorMessage,
  validatePhotoshootGenerationSource,
  photoshootTileStoragePath,
  parsePhotoshootTileIndex,
  parsePhotoshootTilePaths,
  derivePhotoshootTilePaths,
  photoshootTileIndexForUrl,
  isPhotoshootUgcListing,
  looksLikePhotoshootTilePaths,
  photoshootUserFacingMediaPaths,
  resolvePhotoshootParentSourcePath,
  resolvePhotoshootSheetAspect,
  resolvePhotoshootUserFacingResult,
  serializePhotoshootEnqueueInstruction,
  serializePhotoshootSheetInstruction,
  shouldReplacePhotoshootVariants,
  resolvePhotoshootOpenIndex,
  selectedPromptText,
  visiblePromptTextsForPhoto,
} from "./photoshoot";
import {
  PHOTOSHOOT_PLANNER_GENERATION_CONFIG,
  PHOTOSHOOT_PLANNER_TEMPERATURE_DEFAULT,
  buildPhotoshootPlannerUserText,
  clampPhotoshootPlannerTemperature,
  photoshootCreativityFromTemperature,
  photoshootCreativityHint,
  photoshootPlannerGenerationConfig,
  photoshootTemperatureFromCreativity,
} from "./photoshoot-planner";

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

test("usableCatalogPrompt hides enqueue junk from Repeat", () => {
  assert.equal(usableCatalogPrompt(serializePhotoshootEnqueueInstruction()), null);
  assert.equal(usableCatalogPrompt("  "), null);
  assert.equal(usableCatalogPrompt("Woman in a pink dress, field, balloons"), "Woman in a pink dress, field, balloons");
});

test("resolvePhotoshootOpenIndex prefers index, then URL", () => {
  const urls = ["a.jpg", "b.jpg", "c.jpg", "d.jpg"];
  assert.equal(resolvePhotoshootOpenIndex({ urls, photoIndex: 2 }), 2);
  assert.equal(resolvePhotoshootOpenIndex({ urls, photoUrl: "d.jpg" }), 3);
  assert.equal(resolvePhotoshootOpenIndex({ urls, photoIndex: 9, photoUrl: "b.jpg" }), 1);
  assert.equal(resolvePhotoshootOpenIndex({ urls }), 0);
});

test("visiblePromptTextsForPhoto keeps only the selected frame prompt", () => {
  const promptTexts = ["hook one", "hook two", "hook three", "hook four"];
  assert.deepEqual(
    visiblePromptTextsForPhoto({ promptTexts, photoCount: 4, photoIndex: 2 }),
    ["hook three"]
  );
  assert.equal(
    selectedPromptText({ promptTexts, photoCount: 4, photoIndex: 1 }),
    "hook two"
  );
  assert.deepEqual(
    visiblePromptTextsForPhoto({
      promptTexts: ["only one"],
      photoCount: 4,
      photoIndex: 2,
    }),
    ["only one"]
  );
});

test("shouldReplacePhotoshootVariants keeps four real prompts", () => {
  assert.equal(shouldReplacePhotoshootVariants([]), true);
  assert.equal(
    shouldReplacePhotoshootVariants([serializePhotoshootEnqueueInstruction()]),
    true,
  );
  assert.equal(
    shouldReplacePhotoshootVariants(["a", "b", "c", serializePhotoshootEnqueueInstruction()]),
    true,
  );
  assert.equal(shouldReplacePhotoshootVariants(["a", "b", "c"]), true);
  assert.equal(shouldReplacePhotoshootVariants(["a", "b", "c", "d"]), false);
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
  assert.match(text, /shares edges/);
  assert.match(text, /no gutter/);
  assert.doesNotMatch(text, /1:1, 16:9, or 9:16/);
  const square = serializePhotoshootSheetInstruction(plan, "1:1");
  assert.match(square, /Canvas 1:1/);
  assert.doesNotMatch(square, /16:9/);
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

test("photoshoot sheet is always 2K", () => {
  assert.equal(PHOTOSHOOT_IMAGE_SIZE, "2K");
});

test("photoshoot CTA is 4 frames for 15 credits", () => {
  assert.equal(PHOTOSHOOT_FRAME_COUNT, 4);
  assert.equal(PHOTOSHOOT_CREDIT_COST, 15);
  assert.equal(PHOTOSHOOT_FALLBACK_DEFAULT_MODEL, "flux-2-flex");
  assert.equal(PHOTOSHOOT_FLUX_SAFETY_TOLERANCE, 5);
  assert.equal(PHOTOSHOOT_CTA_LABEL, "ИИ фотосессия");
  assert.equal(photoshootCtaDetail(), "4 фото");
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
    derivePhotoshootTilePaths("user/job/lease.jpg"),
    tiles,
  );
  assert.deepEqual(
    resolvePhotoshootUserFacingResult({
      editKind: PHOTOSHOOT_EDIT_KIND,
      sheetPath: "user/job/lease.jpg",
      tilePaths: null,
    }),
    { resultPath: tiles[0], tilePaths: tiles },
  );
  assert.deepEqual(
    resolvePhotoshootUserFacingResult({
      editKind: PHOTOSHOOT_EDIT_KIND,
      sheetPath: "",
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
  assert.deepEqual(
    photoshootUserFacingMediaPaths({ resultPath: tiles[0], tilePaths: tiles }),
    tiles,
  );
  assert.deepEqual(
    photoshootUserFacingMediaPaths({ resultPath: "user/job/lease.jpg", tilePaths: null }),
    ["user/job/lease.jpg"],
  );
});

test("photoshoot UGC listing is a four-tile web album, not a random 4-photo card", () => {
  const tiles = [
    "user/job/lease-1.jpg",
    "user/job/lease-2.jpg",
    "user/job/lease-3.jpg",
    "user/job/lease-4.jpg",
  ];
  assert.equal(looksLikePhotoshootTilePaths(tiles), true);
  assert.equal(looksLikePhotoshootTilePaths(tiles.slice(0, 3)), false);
  assert.equal(
    isPhotoshootUgcListing({ storagePaths: tiles }),
    true,
  );
  assert.equal(
    isPhotoshootUgcListing({
      datasetSlug: "web_generation_ugc",
      photoCount: 4,
    }),
    true,
  );
  assert.equal(
    isPhotoshootUgcListing({
      datasetSlug: "telegram_export",
      photoCount: 4,
    }),
    false,
  );
});

test("photoshoot parent source is a tile, never the sheet", () => {
  const tiles = [
    "user/job/lease-1.jpg",
    "user/job/lease-2.jpg",
    "user/job/lease-3.jpg",
    "user/job/lease-4.jpg",
  ];
  assert.equal(
    resolvePhotoshootParentSourcePath({
      editKind: PHOTOSHOOT_EDIT_KIND,
      sheetPath: "user/job/lease.jpg",
      tilePaths: tiles,
      tileIndex: 3,
    }),
    tiles[2],
  );
  assert.equal(
    resolvePhotoshootParentSourcePath({
      editKind: PHOTOSHOOT_EDIT_KIND,
      sheetPath: "user/job/lease.jpg",
      tilePaths: tiles,
      requestedPath: tiles[1],
    }),
    tiles[1],
  );
  assert.equal(
    resolvePhotoshootParentSourcePath({
      editKind: PHOTOSHOOT_EDIT_KIND,
      sheetPath: "user/job/lease.jpg",
      tilePaths: null,
    }),
    tiles[0],
  );
  assert.equal(
    resolvePhotoshootParentSourcePath({
      editKind: PHOTOSHOOT_EDIT_KIND,
      sheetPath: "",
      tilePaths: null,
    }),
    null,
  );
  assert.equal(parsePhotoshootTileIndex(4), 4);
  assert.equal(parsePhotoshootTileIndex(5), null);
  assert.equal(photoshootTileIndexForUrl(tiles, tiles[2]), 3);
});

test("photoshoot fingerprint is parent or library path + kind + planner temperature", () => {
  assert.deepEqual(photoshootFingerprintFields("root-1"), {
    editKind: PHOTOSHOOT_EDIT_KIND,
    parentGenerationId: "root-1",
    photoStoragePath: "",
    plannerTemperature: PHOTOSHOOT_PLANNER_TEMPERATURE_DEFAULT,
  });
  assert.deepEqual(photoshootFingerprintFields("", 0.85, "user/a.jpg"), {
    editKind: PHOTOSHOOT_EDIT_KIND,
    parentGenerationId: "",
    photoStoragePath: "user/a.jpg",
    plannerTemperature: 0.85,
  });
});

test("photoshoot source is parent XOR exactly one library photo", () => {
  assert.equal(
    validatePhotoshootGenerationSource({ hasParentGeneration: true, photoCount: 0 }),
    null,
  );
  assert.equal(
    validatePhotoshootGenerationSource({ hasParentGeneration: false, photoCount: 1 }),
    null,
  );
  assert.equal(
    validatePhotoshootGenerationSource({ hasParentGeneration: false, photoCount: 0 }),
    "photoshoot_source_required",
  );
  assert.equal(
    validatePhotoshootGenerationSource({ hasParentGeneration: false, photoCount: 2 }),
    "photoshoot_one_photo",
  );
  assert.equal(
    validatePhotoshootGenerationSource({ hasParentGeneration: true, photoCount: 1 }),
    "photoshoot_source_conflict",
  );
  assert.equal(
    photoshootSourceErrorMessage("photoshoot_source_required"),
    "Для фотосессии выберите одно фото",
  );
});

test("planner temperature clamps and round-trips through enqueue instruction", () => {
  assert.equal(clampPhotoshootPlannerTemperature(undefined), 0.5);
  assert.equal(clampPhotoshootPlannerTemperature(-1), 0);
  assert.equal(clampPhotoshootPlannerTemperature(3), 2);
  assert.equal(photoshootCreativityFromTemperature(0.5), 50);
  assert.equal(photoshootTemperatureFromCreativity(50), 0.5);
  assert.equal(photoshootTemperatureFromCreativity(100), 2);
  assert.equal(photoshootTemperatureFromCreativity(80), 1.4);
  assert.equal(photoshootCreativityFromTemperature(1.4), 80);
  assert.equal(
    parsePhotoshootPlannerTemperature(serializePhotoshootEnqueueInstruction(1.4)),
    1.4,
  );
  assert.equal(parsePhotoshootPlannerTemperature("PHOTOSHOOT"), 0.5);
  assert.equal(photoshootPlannerGenerationConfig(1.8).temperature, 1.8);
  assert.equal(photoshootPlannerGenerationConfig(1.8).thinkingConfig.thinkingBudget, 0);
  assert.match(buildPhotoshootPlannerUserText(0.1), /Stay close to the source pose/);
  assert.match(buildPhotoshootPlannerUserText(2), /bold, unexpected editorial poses/);
  assert.equal(photoshootCreativityHint(20), "нейтральнее");
  assert.equal(photoshootCreativityHint(50), "нейтрально");
  assert.equal(photoshootCreativityHint(70), "смелее");
  assert.equal(photoshootCreativityHint(100), "невероятные сюжеты");
});

test("photoshoot overlay keeps exit and creativity usable during capture", () => {
  const idle = photoshootOverlayChromeState({
    capturing: false,
    starting: false,
  });
  assert.equal(idle.exitDisabled, false);
  assert.equal(idle.creativityDisabled, false);
  assert.equal(idle.createDisabled, false);
  assert.equal(idle.createIsProgress, false);

  const starting = photoshootOverlayChromeState({
    capturing: false,
    starting: true,
  });
  assert.equal(starting.exitDisabled, false);
  assert.equal(starting.creativityDisabled, false);
  assert.equal(starting.createDisabled, true);
  assert.equal(starting.createIsProgress, true);

  const capturing = photoshootOverlayChromeState({
    capturing: true,
    starting: true,
  });
  assert.equal(capturing.exitDisabled, false);
  assert.equal(capturing.creativityDisabled, false);
  assert.equal(capturing.createDisabled, true);
  assert.equal(capturing.createIsProgress, true);
});
