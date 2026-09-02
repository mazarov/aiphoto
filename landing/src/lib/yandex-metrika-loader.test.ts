import assert from "node:assert/strict";
import test from "node:test";
import {
  YANDEX_METRIKA_IDLE_TIMEOUT_MS,
  YANDEX_METRIKA_LOAD_EVENTS,
  YANDEX_METRIKA_TAG_SRC,
} from "./yandex-metrika-loader";
import { YANDEX_METRIKA_COUNTER_ID } from "./yandex-metrika";

test("Metrika tag URL stays on the official host with the live counter id", () => {
  assert.equal(
    YANDEX_METRIKA_TAG_SRC,
    `https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_COUNTER_ID}`
  );
  assert.match(YANDEX_METRIKA_TAG_SRC, /^https:\/\/mc\.yandex\.ru\/metrika\/tag\.js\?id=\d+$/);
});

test("idle timeout is past a typical Lighthouse quiet window", () => {
  assert.ok(YANDEX_METRIKA_IDLE_TIMEOUT_MS >= 5000);
  assert.deepEqual(
    [...YANDEX_METRIKA_LOAD_EVENTS],
    ["pointerdown", "keydown", "scroll", "touchstart"]
  );
});
