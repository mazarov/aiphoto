import assert from "node:assert/strict";
import test from "node:test";
import {
  composeVideoScenarioKey,
  emptyComposePromptStash,
  switchComposeModalityPrompt,
} from "./compose-modality-prompt";

test("composeVideoScenarioKey prefers parent generation over photo", () => {
  assert.equal(
    composeVideoScenarioKey({ parentGenerationId: "gen-1", photoId: "photo-2" }),
    "parent:gen-1"
  );
  assert.equal(composeVideoScenarioKey({ photoId: "photo-2" }), "photo:photo-2");
  assert.equal(composeVideoScenarioKey({}), null);
});

test("switching to video stashes the photo prompt and asks for a scenario", () => {
  const result = switchComposeModalityPrompt({
    from: "image",
    to: "video",
    currentDraft: "Девушка в красном пальто",
    stash: emptyComposePromptStash(),
    scenarioKey: "photo:1",
  });

  assert.equal(result.stash.imagePrompt, "Девушка в красном пальто");
  assert.equal(result.draft, "");
  assert.equal(result.shouldLoadScenario, true);
  assert.equal(result.stash.lastScenarioKey, "photo:1");
});

test("switching back to photo restores the stashed photo prompt", () => {
  const toVideo = switchComposeModalityPrompt({
    from: "image",
    to: "video",
    currentDraft: "Девушка в красном пальто",
    stash: emptyComposePromptStash(),
    scenarioKey: "photo:1",
  });
  const toImage = switchComposeModalityPrompt({
    from: "video",
    to: "image",
    currentDraft: "Ветер шевелит волосы",
    stash: toVideo.stash,
    scenarioKey: "photo:1",
  });

  assert.equal(toImage.draft, "Девушка в красном пальто");
  assert.equal(toImage.stash.videoPrompt, "Ветер шевелит волосы");
  assert.equal(toImage.shouldLoadScenario, false);
});

test("returning to the same video frame reuses the saved scenario", () => {
  const stash = emptyComposePromptStash({
    imagePrompt: "Старый фото-промпт",
    videoPrompt: "Ветер шевелит волосы",
    lastScenarioKey: "photo:1",
  });
  const result = switchComposeModalityPrompt({
    from: "image",
    to: "video",
    currentDraft: "Новый фото-промпт",
    stash,
    scenarioKey: "photo:1",
  });

  assert.equal(result.draft, "Ветер шевелит волосы");
  assert.equal(result.shouldLoadScenario, false);
  assert.equal(result.stash.imagePrompt, "Новый фото-промпт");
});

test("a different video frame regenerates the scenario", () => {
  const result = switchComposeModalityPrompt({
    from: "image",
    to: "video",
    currentDraft: "Фото-промпт",
    stash: emptyComposePromptStash({
      videoPrompt: "Старый сценарий",
      lastScenarioKey: "photo:1",
    }),
    scenarioKey: "photo:2",
  });

  assert.equal(result.draft, "");
  assert.equal(result.shouldLoadScenario, true);
  assert.equal(result.stash.lastScenarioKey, "photo:2");
  assert.equal(result.stash.imagePrompt, "Фото-промпт");
});

test("same modality is a no-op", () => {
  const stash = emptyComposePromptStash({ imagePrompt: "keep" });
  const result = switchComposeModalityPrompt({
    from: "image",
    to: "image",
    currentDraft: "current",
    stash,
  });
  assert.equal(result.draft, "current");
  assert.equal(result.shouldLoadScenario, false);
  assert.equal(result.stash, stash);
});
