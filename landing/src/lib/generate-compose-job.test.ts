import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isGenerateComposeJobBusy,
  isPrimaryOverlayDismissPointer,
} from "./generate-compose-job";

describe("isGenerateComposeJobBusy", () => {
  it("is true only while a generate job uploads or runs", () => {
    assert.equal(isGenerateComposeJobBusy("uploading"), true);
    assert.equal(isGenerateComposeJobBusy("generating"), true);
    assert.equal(isGenerateComposeJobBusy("idle"), false);
    assert.equal(isGenerateComposeJobBusy("done"), false);
    assert.equal(isGenerateComposeJobBusy("error"), false);
  });
});

describe("isPrimaryOverlayDismissPointer", () => {
  it("accepts only the primary button", () => {
    assert.equal(isPrimaryOverlayDismissPointer({ button: 0 }), true);
    assert.equal(isPrimaryOverlayDismissPointer({ button: 2 }), false);
  });
});
