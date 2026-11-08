import assert from "node:assert/strict";
import test from "node:test";
import {
  isDevushkiCopyNudgeEligibleCard,
  markDevushkiGenerateClicked,
  recordDevushkiPromptCopyAndShouldNudge,
} from "./devushki-copy-nudge";

function memorySession(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

function withSession(run: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: memorySession(),
  });
  try {
    run();
  } finally {
    if (previous) Object.defineProperty(globalThis, "sessionStorage", previous);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
}

const devushkaCard = {
  seoTags: { audience_tag: ["devushka"] },
  lastListingPath: "/promty-dlya-foto-devushki",
};

test("devushki copy nudge starts on the second copy and stops after generate", () => {
  withSession(() => {
    assert.equal(isDevushkiCopyNudgeEligibleCard(devushkaCard), true);
    assert.equal(
      recordDevushkiPromptCopyAndShouldNudge(isDevushkiCopyNudgeEligibleCard(devushkaCard)),
      false,
    );
    assert.equal(
      recordDevushkiPromptCopyAndShouldNudge(isDevushkiCopyNudgeEligibleCard(devushkaCard)),
      true,
    );

    markDevushkiGenerateClicked();
    assert.equal(
      recordDevushkiPromptCopyAndShouldNudge(isDevushkiCopyNudgeEligibleCard(devushkaCard)),
      false,
    );
    assert.equal(
      recordDevushkiPromptCopyAndShouldNudge(isDevushkiCopyNudgeEligibleCard(devushkaCard)),
      false,
    );
  });
});

test("copies outside the girls cluster never nudge", () => {
  withSession(() => {
    const other = {
      seoTags: { audience_tag: ["para"] },
      lastListingPath: "/v-forme",
    };
    assert.equal(isDevushkiCopyNudgeEligibleCard(other), false);
    assert.equal(recordDevushkiPromptCopyAndShouldNudge(false), false);
    assert.equal(recordDevushkiPromptCopyAndShouldNudge(false), false);
    assert.equal(recordDevushkiPromptCopyAndShouldNudge(false), false);
  });
});

test("girls hub path is enough even without the audience tag", () => {
  withSession(() => {
    const fromHub = {
      seoTags: null,
      lastListingPath: "/promty-dlya-foto-devushki?object=v_forme",
    };
    assert.equal(isDevushkiCopyNudgeEligibleCard(fromHub), true);
    assert.equal(recordDevushkiPromptCopyAndShouldNudge(true), false);
    assert.equal(recordDevushkiPromptCopyAndShouldNudge(true), true);
  });
});
