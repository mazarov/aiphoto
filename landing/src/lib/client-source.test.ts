import assert from "node:assert/strict";
import test from "node:test";
import {
  chromeExtensionIds,
  chromeExtensionOrigins,
  mapPromptshotPathToSource,
  normalizePromptshotPath,
  resolveClientSource,
} from "./client-source";

function req(init: {
  origin?: string;
  host?: string;
  referer?: string;
  xClient?: string;
}) {
  const headers = new Map<string, string>();
  if (init.origin) headers.set("origin", init.origin);
  if (init.host) headers.set("host", init.host);
  if (init.referer) headers.set("referer", init.referer);
  if (init.xClient) headers.set("x-client", init.xClient);
  return {
    headers: {
      get(name: string) {
        return headers.get(name.toLowerCase()) ?? null;
      },
    },
  };
}

test("normalizePromptshotPath strips query, hash, and trailing slash", () => {
  assert.equal(normalizePromptshotPath(""), "/");
  assert.equal(normalizePromptshotPath("/"), "/");
  assert.equal(normalizePromptshotPath("/foto-v-promt/"), "/foto-v-promt");
  assert.equal(normalizePromptshotPath("/foto-v-promt?x=1#y"), "/foto-v-promt");
  assert.equal(normalizePromptshotPath("  /admin/analytics/  "), "/admin/analytics");
});

test("mapPromptshotPathToSource uses calling page prefixes", () => {
  assert.equal(mapPromptshotPathToSource("/foto-v-promt"), "foto_v_promt");
  assert.equal(mapPromptshotPathToSource("/foto-v-promt/"), "foto_v_promt");
  assert.equal(mapPromptshotPathToSource("/generaciya/foto-po-opisaniyu?tab=photo"), "generaciya_foto");
  assert.equal(mapPromptshotPathToSource("/nano-banana"), "generaciya_foto");
  assert.equal(mapPromptshotPathToSource("/nano-banana/pro"), "generaciya_foto");
  assert.equal(
    mapPromptshotPathToSource("/generaciya/po-foto/devushki"),
    "generaciya_foto"
  );
  assert.equal(
    mapPromptshotPathToSource("/sobytiya/1-sentyabrya"),
    "promptshot"
  );
  assert.equal(
    mapPromptshotPathToSource("/sobytiya/den-rozhdeniya"),
    "promptshot"
  );
  assert.equal(mapPromptshotPathToSource("/admin/analytics"), "admin");
  assert.equal(mapPromptshotPathToSource("/admin/search"), "admin");
  assert.equal(mapPromptshotPathToSource("/admin/nps"), "admin");
  assert.equal(mapPromptshotPathToSource("/admin"), "admin");
  assert.equal(mapPromptshotPathToSource("/p/some-card"), "promptshot");
  assert.equal(mapPromptshotPathToSource("/"), "promptshot");
});

test("resolveClientSource maps promptshot Referer when x-client is absent", () => {
  assert.equal(
    resolveClientSource(req({
      origin: "https://promptshot.ru",
      referer: "https://promptshot.ru/foto-v-promt",
    })),
    "foto_v_promt",
  );
  assert.equal(
    resolveClientSource(req({
      origin: "https://www.promptshot.ru",
      referer: "https://promptshot.ru/generaciya/foto-po-opisaniyu",
    })),
    "generaciya_foto",
  );
  assert.equal(
    resolveClientSource(req({
      host: "promptshot.ru",
      referer: "https://promptshot.ru/admin/analytics",
    })),
    "admin",
  );
  assert.equal(
    resolveClientSource(req({
      origin: "https://promptshot.ru",
      referer: "https://promptshot.ru/search",
    })),
    "promptshot",
  );
});

test("resolveClientSource accepts only page x-client from the web", () => {
  assert.equal(
    resolveClientSource(req({
      origin: "https://promptshot.ru",
      referer: "https://promptshot.ru/search",
      xClient: "foto_v_promt",
    })),
    "foto_v_promt",
  );
  assert.equal(
    resolveClientSource(req({
      origin: "https://promptshot.ru",
      referer: "https://promptshot.ru/foto-v-promt",
      xClient: "extension_lite",
    })),
    "foto_v_promt",
  );
  assert.equal(
    resolveClientSource(req({
      origin: "https://promptshot.ru",
      xClient: "site",
    })),
    "promptshot",
  );
  assert.equal(
    resolveClientSource(req({
      origin: "https://promptshot.ru",
      referer: "https://promptshot.ru/foto-v-promt",
      xClient: "scout",
    })),
    "foto_v_promt",
  );
});

test("chrome extension id lists accept comma-separated env values", () => {
  assert.deepEqual(chromeExtensionIds(" AbCd , efgh "), ["abcd", "efgh"]);
  assert.deepEqual(chromeExtensionIds(""), []);
  assert.deepEqual(chromeExtensionIds(null), []);
  assert.deepEqual(chromeExtensionOrigins("AbCd,efgh"), [
    "chrome-extension://abcd",
    "chrome-extension://efgh",
  ]);
});

test("resolveClientSource maps Lite extension ids and leaves other extensions as STV", () => {
  const prev = process.env.CHROME_EXTENSION_ID_LITE;
  process.env.CHROME_EXTENSION_ID_LITE = "LiteId, unpackedid";
  try {
    assert.equal(
      resolveClientSource(req({ origin: "chrome-extension://liteid" })),
      "extension_lite",
    );
    assert.equal(
      resolveClientSource(req({ origin: "chrome-extension://unpackedid" })),
      "extension_lite",
    );
    assert.equal(
      resolveClientSource(req({ origin: "chrome-extension://abcd" })),
      "extension_stv",
    );
  } finally {
    if (prev === undefined) delete process.env.CHROME_EXTENSION_ID_LITE;
    else process.env.CHROME_EXTENSION_ID_LITE = prev;
  }
});

test("resolveClientSource keeps extension and site hosts", () => {
  assert.equal(
    resolveClientSource(req({ origin: "chrome-extension://abcd" })),
    "extension_stv",
  );
  assert.equal(
    resolveClientSource(req({ origin: "https://imageprompt.tools" })),
    "site",
  );
  assert.equal(
    resolveClientSource(req({
      origin: "http://localhost:3000",
      xClient: "generaciya_foto",
    })),
    "generaciya_foto",
  );
  assert.equal(
    resolveClientSource(req({
      origin: "https://imageprompt.tools",
      xClient: "extension_stv",
    })),
    "site",
  );
});
