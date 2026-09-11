import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPOSE_PHOTO_PROMPT_GUIDE,
  COMPOSE_PHOTOSHOOT_GUIDE,
  composeToolGuideCopy,
  composeToolGuideHidesPromptStrip,
  composeToolGuideVisible,
} from "./compose-tool-guide";
import { widgetCopy } from "./foto-v-promt-copy";

test("photoshoot and photo_prompt have a three-beat explainer like the photo picker", () => {
  const shoot = composeToolGuideCopy("photoshoot");
  const prompt = composeToolGuideCopy("photo_prompt");
  assert.equal(shoot?.title, COMPOSE_PHOTOSHOOT_GUIDE.title);
  assert.equal(shoot?.visual, "source-to-tiles");
  assert.match(shoot?.lead ?? "", /одно фото/i);
  assert.match(shoot?.lead ?? "", /четыре кадра/i);
  assert.match(shoot?.hint ?? "", /одно фото/i);
  assert.equal(prompt?.title, widgetCopy("emptyTitle"));
  assert.equal(prompt?.lead, widgetCopy("emptyLead"));
  assert.equal(prompt?.hint, widgetCopy("emptyHint"));
  assert.equal(prompt?.visual, "prompt-from-photo");
  assert.equal(prompt?.title, COMPOSE_PHOTO_PROMPT_GUIDE.title);
  assert.equal(composeToolGuideCopy("image"), null);
  assert.equal(composeToolGuideCopy("video"), null);
});

test("empty-plate guide shows only for idle photoshoot / photo_prompt", () => {
  assert.equal(
    composeToolGuideVisible({
      composeMode: "photoshoot",
      showResultChrome: false,
      dockExpanded: false,
    }),
    true,
  );
  assert.equal(
    composeToolGuideVisible({
      composeMode: "photo_prompt",
      showResultChrome: false,
      dockExpanded: false,
    }),
    true,
  );
  assert.equal(
    composeToolGuideVisible({
      composeMode: "image",
      showResultChrome: false,
      dockExpanded: false,
    }),
    false,
  );
  assert.equal(
    composeToolGuideVisible({
      composeMode: "photoshoot",
      showResultChrome: true,
      dockExpanded: false,
    }),
    false,
  );
  assert.equal(
    composeToolGuideVisible({
      composeMode: "photo_prompt",
      showResultChrome: false,
      dockExpanded: true,
    }),
    false,
  );
  assert.equal(
    composeToolGuideVisible({
      composeMode: "photoshoot",
      showResultChrome: false,
      dockExpanded: false,
      busy: true,
    }),
    false,
  );
});

test("tool guide hides the unused prompt strip", () => {
  assert.equal(
    composeToolGuideHidesPromptStrip({
      composeMode: "photoshoot",
      promptExpanded: false,
    }),
    true,
  );
  assert.equal(
    composeToolGuideHidesPromptStrip({
      composeMode: "photo_prompt",
      promptExpanded: true,
    }),
    false,
  );
  assert.equal(
    composeToolGuideHidesPromptStrip({
      composeMode: "image",
      promptExpanded: false,
    }),
    false,
  );
});
