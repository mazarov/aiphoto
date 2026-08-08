export const MAX_EDIT_INSTRUCTION_CHARS = 1_000;

export function normalizeEditInstruction(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateGenerationEditContract(input: {
  hasParentGeneration: boolean;
  editInstruction: string;
}): string | null {
  const { hasParentGeneration, editInstruction } = input;
  if (
    hasParentGeneration &&
    (!editInstruction || editInstruction.length > MAX_EDIT_INSTRUCTION_CHARS)
  ) {
    return "Опишите изменение (не больше 1000 символов)";
  }
  if (!hasParentGeneration && editInstruction) {
    return "Локальное изменение доступно только для готового результата";
  }
  return null;
}

export function generationEditFingerprintFields(
  parentGenerationId: string,
  editInstruction: string,
): { parentGenerationId: string | null; editInstruction: string | null } {
  return {
    parentGenerationId: parentGenerationId || null,
    editInstruction: editInstruction || null,
  };
}
