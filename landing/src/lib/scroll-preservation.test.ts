import assert from "node:assert/strict";
import test from "node:test";
import {
  LISTING_SHELL_LINK_SCROLL,
  normalizeNavPath,
  pinInstantDocumentScroll,
  shouldScrollTopOnNav,
} from "./scroll-preservation";

test("listing shell links disable Next default scroll", () => {
  assert.equal(LISTING_SHELL_LINK_SCROLL, false);
});

test("pinInstantDocumentScroll forces inline auto and restores empty inline", () => {
  const props = new Map<string, string>();
  const style = {
    get scrollBehavior() {
      return props.get("scroll-behavior") ?? "";
    },
    set scrollBehavior(value: string) {
      props.set("scroll-behavior", value);
    },
    setProperty(name: string, value: string) {
      props.set(name, value);
    },
    removeProperty(name: string) {
      props.delete(name);
    },
  };

  const restore = pinInstantDocumentScroll(style);
  assert.equal(props.get("scroll-behavior"), "auto");
  restore();
  assert.equal(props.has("scroll-behavior"), false);
});

test("pinInstantDocumentScroll restores a previous inline value", () => {
  const props = new Map<string, string>([["scroll-behavior", "smooth"]]);
  const style = {
    get scrollBehavior() {
      return props.get("scroll-behavior") ?? "";
    },
    set scrollBehavior(value: string) {
      props.set("scroll-behavior", value);
    },
    setProperty(name: string, value: string) {
      props.set(name, value);
    },
    removeProperty(name: string) {
      props.delete(name);
    },
  };

  const restore = pinInstantDocumentScroll(style);
  assert.equal(props.get("scroll-behavior"), "auto");
  restore();
  assert.equal(props.get("scroll-behavior"), "smooth");
});

test("normalizeNavPath strips a trailing slash except on root", () => {
  assert.equal(normalizeNavPath("/"), "/");
  assert.equal(normalizeNavPath("/generaciya-foto/malysh/"), "/generaciya-foto/malysh");
  assert.equal(normalizeNavPath("/generaciya-foto/malysh"), "/generaciya-foto/malysh");
});

test("shouldScrollTopOnNav only forces home and foto-v-promt on first enter", () => {
  assert.equal(shouldScrollTopOnNav("/"), true);
  assert.equal(shouldScrollTopOnNav("/foto-v-promt/"), true);
  assert.equal(shouldScrollTopOnNav("/generaciya-foto/malysh"), false);
});
