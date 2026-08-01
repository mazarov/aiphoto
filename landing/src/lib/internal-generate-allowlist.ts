/**
 * Email allowlist for internal card generate (inline compose + open-debug API).
 * Default: azarov.maxim@gmail.com. Extend via INTERNAL_GENERATE_ALLOWLIST (comma-separated).
 */

const DEFAULT_ALLOWLIST = ["azarov.maxim@gmail.com"] as const;

function parseEnvAllowlist(): string[] {
  const raw = process.env.INTERNAL_GENERATE_ALLOWLIST?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function getInternalGenerateAllowlist(): Set<string> {
  const emails = new Set<string>(DEFAULT_ALLOWLIST.map((e) => e.toLowerCase()));
  for (const e of parseEnvAllowlist()) emails.add(e);
  return emails;
}

export function isInternalGenerateAllowlistedEmail(
  email?: string | null
): boolean {
  if (!email || typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return getInternalGenerateAllowlist().has(normalized);
}
