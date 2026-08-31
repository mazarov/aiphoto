import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleGrokVideoMotionPrompt,
  extractVideoMotionSection,
  looksLikeStructuredPhotoPrompt,
  videoI2vUserPrompt,
} from "./video-motion-prompt";

const CATALOG_PHOTO = `Visual Hook:
Золотые крылья и блестящее платье.

Scene:
Человек стоит в ночном лесу.

Genre:
Фэнтези-портрет.

Pose:
Торс направлен к объективу.

CRITICAL RULES
- Сохранить лицо.`;

test("catalog photo extract is not an I2V user prompt", () => {
  assert.equal(looksLikeStructuredPhotoPrompt(CATALOG_PHOTO), true);
  assert.equal(videoI2vUserPrompt(CATALOG_PHOTO), "");
  const assembled = assembleGrokVideoMotionPrompt(CATALOG_PHOTO);
  assert.doesNotMatch(assembled, /Visual Hook/);
  assert.doesNotMatch(assembled, /CRITICAL RULES/);
  assert.doesNotMatch(assembled, /User motion request/);
});

test("Motion section is the only I2V user beat", () => {
  const catalog = `${CATALOG_PHOTO}\n\nMotion:\nШары медленно поднимаются вверх\n`;
  assert.equal(extractVideoMotionSection(catalog), "Шары медленно поднимаются вверх");
  assert.equal(videoI2vUserPrompt(catalog), "Шары медленно поднимаются вверх");
  assert.match(
    assembleGrokVideoMotionPrompt(catalog),
    /User motion request: Шары медленно поднимаются вверх/,
  );
});

test("plain motion stays a short I2V request", () => {
  assert.equal(videoI2vUserPrompt("Ветер шевелит волосы"), "Ветер шевелит волосы");
  assert.match(
    assembleGrokVideoMotionPrompt("Ветер шевелит волосы"),
    /User motion request: Ветер шевелит волосы/,
  );
});
