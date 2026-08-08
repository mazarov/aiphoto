import assert from "node:assert/strict";
import test from "node:test";
import {
  generationEditFingerprintFields,
  normalizeEditInstruction,
  validateGenerationEditContract,
} from "../../landing/src/lib/generation-edit-contract";

test("local edit requires a non-empty bounded instruction", () => {
  assert.match(
    validateGenerationEditContract({
      hasParentGeneration: true,
      editInstruction: "",
    }) || "",
    /Опишите изменение/,
  );
  assert.equal(
    validateGenerationEditContract({
      hasParentGeneration: true,
      editInstruction: "Добавь солнечные очки",
    }),
    null,
  );
  assert.ok(
    validateGenerationEditContract({
      hasParentGeneration: true,
      editInstruction: "x".repeat(1_001),
    }),
  );
});

test("initial generation rejects edit instruction", () => {
  const normalized = normalizeEditInstruction("  Измени цвет платья  ");
  assert.equal(normalized, "Измени цвет платья");
  assert.match(
    validateGenerationEditContract({
      hasParentGeneration: false,
      editInstruction: normalized,
    }) || "",
    /только для готового результата/,
  );
});

test("idempotency fingerprint fields include normalized edit delta", () => {
  const first = generationEditFingerprintFields("parent-id", "Добавь очки");
  const second = generationEditFingerprintFields("parent-id", "Убери шарф");
  assert.notDeepEqual(first, second);
  assert.deepEqual(generationEditFingerprintFields("", ""), {
    parentGenerationId: null,
    editInstruction: null,
  });
});
