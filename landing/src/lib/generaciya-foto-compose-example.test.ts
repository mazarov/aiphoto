import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composeNeedsExamplePick,
  composeShouldAutoOpenExampleSheet,
  composeShowsExampleTool,
  SEO_COMPOSE_EXAMPLE_CONFIRM_CTA,
  SEO_COMPOSE_EXAMPLE_TOOL_LABEL,
  SEO_COMPOSE_PICK_EXAMPLE_CTA,
  composeExamplePickerEndpoint,
  composeExamplePickerHasMore,
  composeExamplePickerLimit,
  filterComposeExampleCards,
  COMPOSE_EXAMPLE_SVO_FILTER,
  COMPOSE_EXAMPLE_AUTUMN_FILTER,
  composeExampleQuickFilters,
} from "./generaciya-foto-compose-example";

test("composeNeedsExamplePick when photo without example on any image compose", () => {
  assert.equal(
    composeNeedsExamplePick({
      composeMode: "image",
      selectedPhotoCount: 1,
      cardId: null,
      promptLength: 0,
    }),
    true,
  );
});

test("composeNeedsExamplePick false when card already picked", () => {
  assert.equal(
    composeNeedsExamplePick({
      composeMode: "image",
      selectedPhotoCount: 1,
      cardId: "card-1",
      promptLength: 0,
    }),
    false,
  );
});

test("composeNeedsExamplePick false when prompt long enough without card", () => {
  assert.equal(
    composeNeedsExamplePick({
      composeMode: "image",
      selectedPhotoCount: 1,
      cardId: null,
      promptLength: 40,
    }),
    false,
  );
});

test("composeNeedsExamplePick false off image compose", () => {
  assert.equal(
    composeNeedsExamplePick({
      composeMode: "photo_prompt",
      selectedPhotoCount: 1,
      cardId: null,
      promptLength: 0,
    }),
    false,
  );
  assert.equal(
    composeNeedsExamplePick({
      composeMode: "video",
      selectedPhotoCount: 1,
      cardId: null,
      promptLength: 0,
    }),
    false,
  );
  assert.equal(
    composeNeedsExamplePick({
      composeMode: "photoshoot",
      selectedPhotoCount: 1,
      cardId: null,
      promptLength: 0,
    }),
    false,
  );
});

test("composeShowsExampleTool is image compose, not a URL funnel", () => {
  assert.equal(composeShowsExampleTool({ composeMode: "image" }), true);
  assert.equal(
    composeShowsExampleTool({ composeMode: "image", showResultChrome: true }),
    false,
  );
  assert.equal(composeShowsExampleTool({ composeMode: "photo_prompt" }), false);
  assert.equal(composeShowsExampleTool({ composeMode: "video" }), false);
  assert.equal(composeShowsExampleTool({ composeMode: "photoshoot" }), false);
});

test("composeShouldAutoOpenExampleSheet after photo without listing card", () => {
  assert.equal(
    composeShouldAutoOpenExampleSheet({
      composeMode: "image",
      cardId: null,
    }),
    true,
  );
});

test("composeShouldAutoOpenExampleSheet false when listing card already seeded", () => {
  assert.equal(
    composeShouldAutoOpenExampleSheet({
      composeMode: "image",
      cardId: "card-from-listing",
    }),
    false,
  );
});

test("composeShouldAutoOpenExampleSheet false off image compose", () => {
  assert.equal(
    composeShouldAutoOpenExampleSheet({
      composeMode: "photo_prompt",
      cardId: null,
    }),
    false,
  );
  assert.equal(
    composeShouldAutoOpenExampleSheet({
      composeMode: "video",
      cardId: null,
    }),
    false,
  );
});

test("compose example quick filters lead with СВО then Осень", () => {
  const chips = composeExampleQuickFilters([
    { label: "Пары", dimension: "audience_tag", value: "para" },
    { label: "В форме", dimension: "object_tag", value: "v_forme" },
    { label: "Осень", dimension: "object_tag", value: "osen" },
    { label: "Семья", dimension: "audience_tag", value: "semya" },
  ]);
  assert.equal(chips[0]?.label, COMPOSE_EXAMPLE_SVO_FILTER.label);
  assert.equal(chips[0]?.value, "v_forme");
  assert.equal(chips[1]?.label, COMPOSE_EXAMPLE_AUTUMN_FILTER.label);
  assert.equal(chips[1]?.value, "osen");
  assert.equal(chips[1]?.dimension, "object_tag");
  assert.equal(
    chips.filter((chip) => chip.value === "v_forme").length,
    1,
  );
  assert.equal(
    chips.filter((chip) => chip.value === "osen").length,
    1,
  );
  assert.deepEqual(
    chips.map((chip) => chip.label),
    ["СВО", "Осень", "Пары", "Семья"],
  );
  assert.equal(
    composeExamplePickerEndpoint({
      query: "",
      filter: {
        dimension: COMPOSE_EXAMPLE_AUTUMN_FILTER.dimension,
        value: COMPOSE_EXAMPLE_AUTUMN_FILTER.value,
      },
    }),
    "/api/listing?limit=24&sort=new&object_tag=osen&strict=1",
  );
});

test("SEO compose pick CTA copy", () => {
  assert.equal(SEO_COMPOSE_EXAMPLE_TOOL_LABEL, "Выбрать пример");
  assert.equal(SEO_COMPOSE_PICK_EXAMPLE_CTA, "Выбрать пример");
  assert.equal(SEO_COMPOSE_EXAMPLE_CONFIRM_CTA, "Выбрать");
});

test("composeExamplePickerEndpoint defaults to newest stills listing", () => {
  assert.equal(
    composeExamplePickerEndpoint({ query: "", filter: null }),
    "/api/listing?limit=24&sort=new",
  );
});

test("composeExamplePickerEndpoint photoshoot/video fetch a fuller newest page", () => {
  assert.equal(composeExamplePickerLimit("photo"), 24);
  assert.equal(composeExamplePickerLimit("photoshoot"), 60);
  assert.equal(
    composeExamplePickerEndpoint({
      query: "",
      filter: null,
      kind: "photoshoot",
    }),
    "/api/listing?limit=60&sort=new",
  );
  assert.equal(
    composeExamplePickerEndpoint({
      query: "",
      filter: null,
      kind: "video",
      offset: 60,
    }),
    "/api/listing?limit=60&sort=new&offset=60",
  );
});

test("composeExamplePickerEndpoint uses listing search not /api/search", () => {
  const url = composeExamplePickerEndpoint({ query: "аниме", filter: null });
  assert.ok(url?.startsWith("/api/listing?"));
  assert.ok(url?.includes("q=%D0%B0%D0%BD%D0%B8%D0%BC%D0%B5"));
  assert.equal(url?.includes("/api/search"), false);
});

test("composeExamplePickerEndpoint waits for 2 chars without filter", () => {
  assert.equal(
    composeExamplePickerEndpoint({ query: "а", filter: null }),
    null,
  );
});

test("composeExamplePickerEndpoint filter is strict listing", () => {
  assert.equal(
    composeExamplePickerEndpoint({
      query: "",
      filter: { dimension: "audience_tag", value: "para" },
    }),
    "/api/listing?limit=24&sort=new&audience_tag=para&strict=1",
  );
});

test("filterComposeExampleCards splits stills / photoshoot / video", () => {
  const cards = [
    { id: "still", isPhotoshoot: false, hasPrompt: true, videoUrl: null },
    { id: "shoot", isPhotoshoot: true, hasPrompt: true, videoUrl: null },
    { id: "clip", isPhotoshoot: false, hasPrompt: true, videoUrl: "https://cdn/v.mp4" },
    { id: "empty", isPhotoshoot: false, hasPrompt: false, videoUrl: null },
  ];
  assert.deepEqual(
    filterComposeExampleCards(cards, "photo").map((card) => card.id),
    ["still", "clip"],
  );
  assert.deepEqual(
    filterComposeExampleCards(cards, "photoshoot").map((card) => card.id),
    ["shoot"],
  );
  assert.deepEqual(
    filterComposeExampleCards(cards, "video").map((card) => card.id),
    ["clip"],
  );
});

test("composeExamplePickerHasMore uses ranked offset for newest listing", () => {
  assert.equal(
    composeExamplePickerHasMore({
      isSearch: false,
      offset: 0,
      rankedBatchSize: 24,
      receivedCount: 24,
      requestedLimit: 24,
      totalCount: 80,
    }),
    true,
  );
  assert.equal(
    composeExamplePickerHasMore({
      isSearch: false,
      offset: 72,
      rankedBatchSize: 24,
      receivedCount: 8,
      requestedLimit: 24,
      totalCount: 80,
    }),
    false,
  );
});
