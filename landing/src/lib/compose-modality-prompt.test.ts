import assert from "node:assert/strict";
import test from "node:test";
import {
  composeVideoScenarioKey,
  emptyComposePromptStash,
  resolveVideoAnimateScenarioSource,
  seededAnimateMotionPrompt,
  shouldRequestVideoAnimateScenario,
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

test("video scenario source waits for a single frame", () => {
  assert.equal(
    resolveVideoAnimateScenarioSource({
      composeMode: "image",
      selectedPhotos: [{ id: "p1", storagePath: "user/a.jpg" }],
    }),
    null
  );
  assert.equal(
    resolveVideoAnimateScenarioSource({
      composeMode: "video",
      selectedPhotos: [],
    }),
    null
  );
  assert.equal(
    resolveVideoAnimateScenarioSource({
      composeMode: "video",
      selectedPhotos: [
        { id: "p1", storagePath: "user/a.jpg" },
        { id: "p2", storagePath: "user/b.jpg" },
      ],
    }),
    null
  );
});

test("video scenario source prefers parent over the selected photo", () => {
  assert.deepEqual(
    resolveVideoAnimateScenarioSource({
      composeMode: "video",
      animateParentId: "gen-1",
      selectedPhotos: [{ id: "p1", storagePath: "user/a.jpg" }],
    }),
    { parentGenerationId: "gen-1", scenarioKey: "parent:gen-1" }
  );
  assert.deepEqual(
    resolveVideoAnimateScenarioSource({
      composeMode: "video",
      selectedPhotos: [{ id: "p1", storagePath: "user/a.jpg" }],
    }),
    { photoStoragePath: "user/a.jpg", scenarioKey: "photo:p1" }
  );
  assert.deepEqual(
    resolveVideoAnimateScenarioSource({
      composeMode: "video",
      selectedPhotos: [
        {
          id: "p1",
          storagePath: "user/a.jpg",
          originalFilename: "generation-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg",
        },
      ],
    }),
    {
      parentGenerationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      scenarioKey: "parent:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }
  );
});

test("catalog Repeat motion must not trigger a new Flash scenario", () => {
  const source = {
    photoStoragePath: "user/a.jpg",
    scenarioKey: "photo:p1",
  };
  assert.equal(
    shouldRequestVideoAnimateScenario({
      source,
      stash: emptyComposePromptStash(),
      seededMotion: "Ветер шевелит волосы",
    }),
    false
  );
  assert.equal(
    shouldRequestVideoAnimateScenario({
      source: { parentGenerationId: "gen-new", scenarioKey: "parent:gen-new" },
      stash: emptyComposePromptStash(),
      seededMotion: "Ветер шевелит волосы",
      seedParentGenerationId: null,
    }),
    true
  );
  assert.equal(
    shouldRequestVideoAnimateScenario({
      source,
      stash: emptyComposePromptStash(),
      seededMotion: "",
    }),
    true
  );
  assert.equal(
    shouldRequestVideoAnimateScenario({
      source,
      stash: emptyComposePromptStash({
        videoPrompt: "Ветер шевелит волосы",
        lastScenarioKey: "photo:p1",
      }),
    }),
    false
  );
  assert.equal(
    shouldRequestVideoAnimateScenario({
      source: { ...source, scenarioKey: "photo:p2" },
      stash: emptyComposePromptStash({
        videoPrompt: "Ветер шевелит волосы",
        lastScenarioKey: "photo:p1",
      }),
    }),
    true
  );
});

test("seeded animate motion keeps Repeat beat and ignores photo extracts", () => {
  assert.equal(
    seededAnimateMotionPrompt({
      intent: "resume",
      promptText: "Ветер шевелит волосы",
    }),
    ""
  );
  assert.equal(
    seededAnimateMotionPrompt({
      intent: "animate",
      promptText: "Visual Hook:\nGold\n\nMotion:\nКрылья медленно раскрываются",
    }),
    "Крылья медленно раскрываются"
  );
  assert.equal(
    seededAnimateMotionPrompt({
      intent: "animate",
      promptText: "Visual Hook:\nGold\n\nScene:\nStudio\n\nGenre:\nPortrait\n\nPose:\nStand",
    }),
    ""
  );
  assert.equal(
    seededAnimateMotionPrompt({
      intent: "animate",
      promptText: "Ветер шевелит волосы",
    }),
    "Ветер шевелит волосы"
  );
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
