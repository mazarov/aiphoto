/**
 * Temporary open generate for card inline UI debugging.
 * When enabled: upload/generate/poll work without session and without charging credits.
 * Default on in development; production only with STV_OPEN_GENERATE_DEBUG=1.
 */
export function isStvOpenGenerateDebugEnabled(): boolean {
  const configured = process.env.STV_OPEN_GENERATE_DEBUG?.trim();
  if (configured === "1" || configured === "true") return true;
  if (configured === "0" || configured === "false") return false;
  return process.env.NODE_ENV === "development";
}
