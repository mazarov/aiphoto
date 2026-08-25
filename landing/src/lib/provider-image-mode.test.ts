import assert from "node:assert/strict";
import test from "node:test";
import {
  inferProviderImageMode,
  providerImageModeBadgeClass,
  providerImageModeLabel,
} from "./provider-image-mode";

test("mode is null for video and unknown vendors", () => {
  assert.equal(inferProviderImageMode({
    executedModel: "grok-imagine-video-1.5",
    inputPhotoCount: 1,
  }), null);
  assert.equal(inferProviderImageMode({
    fallbackUsed: true,
    modality: "video",
    inputPhotoCount: 1,
  }), null);
  assert.equal(inferProviderImageMode({
    model: "veo-3.1-lite-generate-preview",
    inputPhotoCount: 1,
  }), null);
});

test("Gemini without source images is generate", () => {
  const value = inferProviderImageMode({
    requestedModel: "gemini-2.5-flash-image",
    executedModel: "gemini-2.5-flash-image",
    modality: "image",
  });
  assert.deepEqual(value, { vendor: "gemini", mode: "generate" });
  assert.equal(providerImageModeLabel(value), "Gemini generate");
});

test("Gemini with photos, parent, vibe, or local edit is edit", () => {
  assert.deepEqual(inferProviderImageMode({
    model: "gemini-3.1-flash-image-preview",
    inputPhotoCount: 1,
  }), { vendor: "gemini", mode: "edit" });
  assert.deepEqual(inferProviderImageMode({
    requestedModel: "gemini-2.5-flash-image",
    hasParent: true,
  }), { vendor: "gemini", mode: "edit" });
  assert.deepEqual(inferProviderImageMode({
    requestedModel: "gemini-2.5-flash-image",
    hasVibe: true,
  }), { vendor: "gemini", mode: "edit" });
  assert.deepEqual(inferProviderImageMode({
    requestedModel: "gemini-2.5-flash-image",
    hasEditInstruction: true,
  }), { vendor: "gemini", mode: "edit" });
  assert.equal(providerImageModeLabel({ vendor: "gemini", mode: "edit" }), "Gemini edit");
});

test("Grok and Gemini→Grok fallback stay xAI", () => {
  assert.deepEqual(inferProviderImageMode({
    requestedModel: "grok-imagine-image-2.0",
    executedModel: "grok-imagine-image-2.0",
  }), { vendor: "xai", mode: "generate" });
  assert.deepEqual(inferProviderImageMode({
    model: "gemini-2.5-flash-image",
    executedModel: "grok-imagine-image-2.0",
    fallbackUsed: true,
    inputPhotoCount: 1,
  }), { vendor: "xai", mode: "edit" });
  assert.equal(providerImageModeLabel({ vendor: "xai", mode: "edit" }), "xAI edit");
  assert.equal(
    providerImageModeBadgeClass({ vendor: "gemini", mode: "edit" }),
    "bg-indigo-100 text-indigo-800"
  );
});

test("Seedream jobs are openrouter vendor", () => {
  assert.deepEqual(inferProviderImageMode({
    requestedModel: "seedream-4.5",
    executedModel: "seedream-4.5",
    inputPhotoCount: 1,
  }), { vendor: "openrouter", mode: "edit" });
  assert.deepEqual(inferProviderImageMode({
    requestedModel: "gemini-2.5-flash-image",
    executedModel: "seedream-4.5",
    fallbackUsed: true,
    inputPhotoCount: 1,
  }), { vendor: "openrouter", mode: "edit" });
  assert.equal(providerImageModeLabel({ vendor: "openrouter", mode: "edit" }), "Seedream edit");
});
