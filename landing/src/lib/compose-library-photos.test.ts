import assert from "node:assert/strict";
import test from "node:test";
import { PHOTO_PROMPT_EPHEMERAL_ID } from "./generate-photo-prompt";
import {
  isPersistableIdentityDataUrl,
  libraryStoragePaths,
  mergeLibraryHydratePhotos,
  mergeLibraryHydrateSelection,
  shouldPersistEphemeralIdentityPhoto,
} from "./compose-library-photos";

test("ephemeral identity persists only for authed generation compose", () => {
  assert.equal(
    shouldPersistEphemeralIdentityPhoto({
      isAuthed: true,
      intent: "text",
      composeMode: "image",
    }),
    true,
  );
  assert.equal(
    shouldPersistEphemeralIdentityPhoto({
      isAuthed: true,
      intent: "resume",
      composeMode: "photoshoot",
    }),
    true,
  );
  assert.equal(
    shouldPersistEphemeralIdentityPhoto({
      isAuthed: false,
      intent: "text",
      composeMode: "image",
    }),
    false,
  );
  assert.equal(
    shouldPersistEphemeralIdentityPhoto({
      isAuthed: true,
      intent: "photo_prompt",
      composeMode: "photo_prompt",
    }),
    false,
  );
  assert.equal(
    shouldPersistEphemeralIdentityPhoto({
      isAuthed: true,
      intent: "text",
      composeMode: "photo_prompt",
    }),
    false,
  );
});

test("only data-image URLs are persistable identity bytes", () => {
  assert.equal(isPersistableIdentityDataUrl("data:image/jpeg;base64,xx"), true);
  assert.equal(isPersistableIdentityDataUrl("https://cdn.example/a.jpg"), false);
  assert.equal(isPersistableIdentityDataUrl(""), false);
});

test("hydrate merge keeps in-session library rows the GET has not seen yet", () => {
  const incoming = [{ id: "old" }];
  const current = [{ id: "fresh" }, { id: "old" }];
  assert.deepEqual(
    mergeLibraryHydratePhotos({
      incomingLibrary: incoming,
      current,
      pendingEphemeral: null,
    }),
    [{ id: "fresh" }, { id: "old" }],
  );
});

test("hydrate merge keeps identity ephemeral in front of library", () => {
  const ephemeral = { id: PHOTO_PROMPT_EPHEMERAL_ID };
  assert.deepEqual(
    mergeLibraryHydratePhotos({
      incomingLibrary: [{ id: "lib-1" }],
      current: [ephemeral],
      pendingEphemeral: ephemeral,
    }),
    [ephemeral, { id: "lib-1" }],
  );
});

test("hydrate merge does not drop guest ephemeral when GET is empty", () => {
  const ephemeral = { id: PHOTO_PROMPT_EPHEMERAL_ID };
  assert.deepEqual(
    mergeLibraryHydratePhotos({
      incomingLibrary: [],
      current: [ephemeral],
      pendingEphemeral: null,
    }),
    [ephemeral],
  );
});

test("hydrate selection prefers identity ephemeral then in-session ids", () => {
  assert.deepEqual(
    mergeLibraryHydrateSelection({
      pendingEphemeralId: PHOTO_PROMPT_EPHEMERAL_ID,
      currentSelectedIds: ["lib-old"],
      mergedPhotoIds: [PHOTO_PROMPT_EPHEMERAL_ID, "lib-old"],
      preferencePhotoIds: ["lib-old"],
    }),
    [PHOTO_PROMPT_EPHEMERAL_ID],
  );
  assert.deepEqual(
    mergeLibraryHydrateSelection({
      pendingEphemeralId: null,
      currentSelectedIds: ["fresh"],
      mergedPhotoIds: ["fresh", "lib-old"],
      preferencePhotoIds: ["lib-old"],
    }),
    ["fresh"],
  );
});

test("libraryStoragePaths drops empty ephemeral paths", () => {
  assert.deepEqual(
    libraryStoragePaths([
      { storagePath: "" },
      { storagePath: "user/a.jpg" },
      { storagePath: "  " },
    ]),
    ["user/a.jpg"],
  );
});
