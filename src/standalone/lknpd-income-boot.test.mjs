import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createCabinetSession,
  installCabinetHooks,
  loadCabinetIncomes,
  loadCabinetProfile,
  registerIncome,
} from "./lknpd-income-boot.mjs";
import * as core from "./lknpd-income-core.mjs";

const dir = dirname(fileURLToPath(import.meta.url));

test("installCabinetHooks captures Bearer from page fetch", async () => {
  const session = createCabinetSession();
  const target = {
    fetch: async () => ({ ok: true }),
    localStorage: { length: 0, key() { return null; }, getItem() { return null; } },
    sessionStorage: { length: 0, key() { return null; }, getItem() { return null; } },
  };
  installCabinetHooks(session, target);
  await target.fetch("https://lknpd.nalog.ru/api/v1/user", {
    headers: { Authorization: "Bearer fixture-access-token-1234567890" },
  });
  assert.equal(session.bearer, "fixture-access-token-1234567890");
});

test("scanStorageForToken reads nested accessToken JSON", async () => {
  const session = createCabinetSession();
  const store = {
    0: "auth",
    length: 1,
    key: () => "auth",
    getItem: () => JSON.stringify({ token: { accessToken: "nested-token-123456789012345" } }),
  };
  const target = {
    localStorage: store,
    sessionStorage: { length: 0, key() { return null; }, getItem() { return null; } },
  };
  installCabinetHooks(session, target);
  assert.equal(session.bearer, "nested-token-123456789012345");
});

test("cabinet client uses injected request and income payload contract", async () => {
  const calls = [];
  const session = createCabinetSession();
  session.request = async (path, options = {}) => {
    calls.push({ path, options });
    if (path === "/user") return { inn: "770000000000", displayName: "Test" };
    if (path.startsWith("/incomes")) return { content: [] };
    if (path === "/income") return { approvedReceiptUuid: "abc" };
    throw new Error(path);
  };
  await loadCabinetProfile(session);
  assert.equal(session.inn, "770000000000");
  const records = [{ created_at: "2026-09-18T10:00:00.000Z", credited_at: "2026-09-18T10:05:00.000Z" }];
  const incomes = await loadCabinetIncomes(session, core, records, new Date("2026-09-19T12:00:00.000Z"));
  assert.equal(incomes.length, 0);
  const created = await registerIncome(session, { totalAmount: "299" });
  assert.equal(created.approvedReceiptUuid, "abc");
  assert.equal(calls[2].options.method, "POST");
});

test("generated userscript embeds the current core and boot modules", () => {
  const user = readFileSync(join(dir, "lknpd-income.user.js"), "utf8");
  const coreSrc = readFileSync(join(dir, "lknpd-income-core.mjs"), "utf8");
  const bootSrc = readFileSync(join(dir, "lknpd-income-boot.mjs"), "utf8");
  const coreMatch = user.match(/const CORE_SRC = ("(?:\\.|[^"\\])*")/);
  const bootMatch = user.match(/const BOOT_SRC = ("(?:\\.|[^"\\])*")/);
  assert.ok(coreMatch, "CORE_SRC");
  assert.ok(bootMatch, "BOOT_SRC");
  assert.equal(JSON.parse(coreMatch[1]), coreSrc);
  assert.equal(JSON.parse(bootMatch[1]), bootSrc);
  assert.match(user, /@match\s+https:\/\/lknpd\.nalog\.ru\/\*/);
});
