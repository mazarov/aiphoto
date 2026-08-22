const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeMailEmail(email: string | null | undefined): string | null {
  const value = String(email || "").trim().toLowerCase();
  return value || null;
}

export function isInternalMailEmail(email: string | null | undefined): boolean {
  const value = normalizeMailEmail(email);
  return Boolean(value && value.endsWith("@promptshot.internal"));
}

export function isValidMailEmail(email: string | null | undefined): boolean {
  const value = normalizeMailEmail(email);
  return Boolean(value && EMAIL_RE.test(value) && !isInternalMailEmail(value));
}

export function hashMailEmail(email: string): string {
  let hash = 2166136261;
  const value = normalizeMailEmail(email) || "";
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function mailEmailDomain(email: string): string {
  const value = normalizeMailEmail(email) || "";
  const at = value.lastIndexOf("@");
  return at >= 0 ? value.slice(at + 1) : "";
}

export function parseMailAllowlist(raw: string | null | undefined): string[] {
  return String(raw || "")
    .split(/[,;\n]/)
    .map((item) => normalizeMailEmail(item))
    .filter((item): item is string => Boolean(item));
}
