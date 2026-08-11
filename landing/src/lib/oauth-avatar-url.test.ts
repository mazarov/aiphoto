import assert from "node:assert/strict";
import test from "node:test";
import { isHotlinkSensitiveAvatarUrl } from "./oauth-avatar-url";

test("flags Google and Yandex avatar CDNs", () => {
  assert.equal(
    isHotlinkSensitiveAvatarUrl(
      "https://lh3.googleusercontent.com/a/ACg8ocKexample=s96-c"
    ),
    true
  );
  assert.equal(
    isHotlinkSensitiveAvatarUrl(
      "https://lh5.googleusercontent.com/a/ACg8ocKexample=s96-c"
    ),
    true
  );
  assert.equal(
    isHotlinkSensitiveAvatarUrl(
      "https://avatars.yandex.net/get-yapic/12345/islands-200"
    ),
    true
  );
});

test("allows first-party and unrelated hosts", () => {
  assert.equal(
    isHotlinkSensitiveAvatarUrl(
      "https://xyz.supabase.co/storage/v1/object/public/avatars/u.png"
    ),
    false
  );
  assert.equal(isHotlinkSensitiveAvatarUrl("not-a-url"), false);
});
