export function parseAnalyticsAdminEmails(raw: string | null | undefined): string[] {
  return (raw || "")
    .split(/[,;\n]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAnalyticsAdminEmail(
  email: string | null | undefined,
  allowlist: readonly string[],
): boolean {
  if (allowlist.length === 0) return false;
  const normalized = (email || "").trim().toLowerCase();
  return Boolean(normalized && allowlist.includes(normalized));
}
