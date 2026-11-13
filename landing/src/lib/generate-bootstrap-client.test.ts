import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GENERATE_DOCK_SEED } from "./generate-dock-seed";
import {
  fetchGenerateBootstrap,
  mergeBootstrapLibraryPhotos,
  peekOptimisticAuthUserId,
  persistGenerateBootstrapPayload,
  readFrameZeroGenerateState,
  rememberLastKnownAuthUser,
  resetGenerateBootstrapClientForTests,
} from "./generate-bootstrap-client";
import {
  buildImageGenerationConfigPayload,
  buildVideoGenerationConfigPayload,
} from "./generation-config-cache";
import type { GenerateBootstrapPayload } from "./generate-bootstrap-server";
import { resetUserGenerationPhotosCacheForTests } from "./user-generation-photos-cache";

function withBrowserStorage<T>(run: () => T): T {
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  const makeStorage = (map: Map<string, string>) => ({
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
  });

  const prevWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const prevDoc = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: makeStorage(local),
      sessionStorage: makeStorage(session),
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: {
      cookie: "sb-proj-auth-token=eyJhbGciOiJIUzI1NiJ9",
    },
  });
  resetGenerateBootstrapClientForTests();
  resetUserGenerationPhotosCacheForTests();

  try {
    return run();
  } finally {
    resetGenerateBootstrapClientForTests();
    resetUserGenerationPhotosCacheForTests();
    if (prevWindow) Object.defineProperty(globalThis, "window", prevWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (prevDoc) Object.defineProperty(globalThis, "document", prevDoc);
    else Reflect.deleteProperty(globalThis, "document");
  }
}

function sampleBootstrapPayload(
  overrides: Partial<GenerateBootstrapPayload> = {},
): GenerateBootstrapPayload {
  const rawConfig = {
    models: JSON.stringify([
      { id: "gemini-2.5-flash-image", label: "Nano Banana", cost: 5 },
      { id: "gemini-3-pro-image-preview", label: "Nano Banana PRO", cost: 10 },
    ]),
    default_model: "gemini-2.5-flash-image",
    photoshoot_enabled: "true",
    video_animate_enabled: "true",
    sticker_generation_enabled: "true",
    preserve_outfit_enabled: "true",
  };
  return {
    user: { id: "user-1", email: "u@example.com", isAnonymous: false },
    credits: 45,
    guestMode: false,
    publishHidden: false,
    preferences: {
      model: "gemini-3-pro-image-preview",
      aspectRatio: "3:4",
      imageSize: "2K",
      selectedPhotoIds: ["p1"],
      videoModel: "grok-imagine-video-1.5",
      videoAspectRatio: "9:16",
      videoDurationSeconds: 6,
      preserveOutfit: true,
      updatedAt: "2026-11-13T10:00:00.000Z",
    },
    photos: [
      {
        id: "p1",
        storagePath: "user-1/selfie.jpg",
        previewUrl: "https://cdn.example/selfie.jpg",
        originalFilename: "selfie.jpg",
        width: 900,
        height: 1200,
        createdAt: "2026-11-13T09:00:00.000Z",
        audienceTag: "devushka",
      },
    ],
    hasMorePhotos: false,
    hasCompletedImageGeneration: true,
    lastCompletedGeneration: null,
    imageConfig: buildImageGenerationConfigPayload(rawConfig, "u@example.com"),
    videoConfig: buildVideoGenerationConfigPayload(rawConfig, "u@example.com"),
    ...overrides,
  };
}

test("readFrameZeroGenerateState hydrates model, photos, credits, and flags synchronously from cache", () => {
  withBrowserStorage(() => {
    persistGenerateBootstrapPayload(sampleBootstrapPayload(), 1_700_000_000_000);

    const frame0 = readFrameZeroGenerateState({
      userId: "user-1",
      pathname: "/",
      seed: DEFAULT_GENERATE_DOCK_SEED,
    });

    assert.equal(frame0.hasCachedConfig, true);
    assert.equal(frame0.model, "gemini-3-pro-image-preview");
    assert.equal(frame0.aspectRatio, "3:4");
    assert.equal(frame0.imageSize, "2K");
    assert.deepEqual(frame0.selectedPhotoIds, ["p1"]);
    assert.equal(frame0.photos.length, 1);
    assert.equal(frame0.credits, 45);
    assert.equal(frame0.preserveOutfit, true);
    assert.equal(frame0.preserveOutfitEnabled, true);
    assert.equal(frame0.photoshootEnabled, true);
    assert.equal(frame0.videoEnabled, true);
    assert.equal(frame0.stickerEnabled, true);
  });
});

test("peekOptimisticAuthUserId resolves cached user while authLoading is true and session cookie exists", () => {
  withBrowserStorage(() => {
    rememberLastKnownAuthUser({ id: "user-42", isAnonymous: false });
    assert.equal(
      peekOptimisticAuthUserId({ user: null, authLoading: true }),
      "user-42",
    );
    assert.equal(
      peekOptimisticAuthUserId({ user: null, authLoading: false }),
      null,
    );
    assert.equal(
      peekOptimisticAuthUserId({
        user: null,
        authLoading: true,
        cookieHeader: "other_cookie=1",
      }),
      null,
    );
  });
});

test("fetchGenerateBootstrap deduplicates concurrent requests and reuses includeLastResult superset", async () => {
  await withBrowserStorage(async () => {
    let networkCalls = 0;
    const mockFetch: typeof fetch = async () => {
      networkCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return new Response(JSON.stringify(sampleBootstrapPayload()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const [superset, subset] = await Promise.all([
      fetchGenerateBootstrap({
        userIdHint: "user-1",
        includeLastResult: true,
        fetchImpl: mockFetch,
      }),
      fetchGenerateBootstrap({
        userIdHint: "user-1",
        includeLastResult: false,
        fetchImpl: mockFetch,
      }),
    ]);

    assert.equal(networkCalls, 1);
    assert.equal(superset?.credits, 45);
    assert.equal(subset?.credits, 45);
  });
});

test("mergeBootstrapLibraryPhotos preserves expanded (>12) session photos across top-12 refresh", () => {
  const makePhoto = (id: string) => ({
    id,
    storagePath: `u/${id}.jpg`,
    previewUrl: `https://cdn.example/${id}.jpg`,
    originalFilename: `${id}.jpg`,
    width: 800,
    height: 1000,
    createdAt: "2026-11-13T00:00:00.000Z",
  });
  const full20 = Array.from({ length: 20 }, (_, i) => makePhoto(`p-${i + 1}`));
  const top12 = full20.slice(0, 12);

  const merged = mergeBootstrapLibraryPhotos({
    incoming: top12,
    existing: full20,
    incomingHasMore: true,
    existingHasMore: false,
  });
  assert.equal(merged.photos.length, 20);
  assert.equal(merged.hasMorePhotos, false);
});
