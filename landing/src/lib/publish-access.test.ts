import assert from "node:assert/strict";
import test from "node:test";
import { anyPublishHidden, showUserPublishControl } from "./publish-access";

test("anyPublishHidden is true when one profile row is hidden", () => {
  assert.equal(anyPublishHidden([{ publish_hidden: false }, { publish_hidden: true }]), true);
  assert.equal(anyPublishHidden([{ publish_hidden: false }]), false);
  assert.equal(anyPublishHidden([]), false);
  assert.equal(anyPublishHidden(null), false);
});

test("hidden user keeps a catalog link and loses publish", () => {
  assert.equal(
    showUserPublishControl({
      publishHidden: false,
      isPublished: false,
      catalogSlug: null,
      republish: false,
    }),
    true,
  );
  assert.equal(
    showUserPublishControl({
      publishHidden: true,
      isPublished: false,
      catalogSlug: null,
      republish: false,
    }),
    false,
  );
  assert.equal(
    showUserPublishControl({
      publishHidden: true,
      isPublished: true,
      catalogSlug: "card",
      republish: false,
    }),
    true,
  );
  assert.equal(
    showUserPublishControl({
      publishHidden: true,
      isPublished: true,
      catalogSlug: "card",
      republish: true,
    }),
    false,
  );
});
