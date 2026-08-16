const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function analyzeHistoryOwnerOrFilter(
  authUserId: string,
  dbUserId: string,
): string | null {
  if (!UUID_RE.test(authUserId) || !UUID_RE.test(dbUserId)) return null;
  if (authUserId === dbUserId) return `user_id.eq.${authUserId}`;
  return `user_id.eq.${authUserId},user_id.eq.${dbUserId}`;
}
