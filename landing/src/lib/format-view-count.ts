/** Compact display for card metrics (RU locale uses comma as decimal sep for k). */
export function formatCompactCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 1000) return String(Math.floor(n));
  if (n < 1_000_000) {
    const k = n / 1000;
    const s = k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(".", ",");
    return `${s}k`;
  }
  const m = n / 1_000_000;
  return `${m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(".", ",")}M`;
}

/** Split long / multiline titles: one line in header, remainder after prompt. */
export function splitCardTitle(title: string, maxFirstChars = 48): { first: string; rest: string } {
  const t = title.trim();
  const nl = t.indexOf("\n");
  if (nl >= 0) {
    return {
      first: t.slice(0, nl).trim() || t,
      rest: t.slice(nl + 1).trim(),
    };
  }
  if (t.length <= maxFirstChars) return { first: t, rest: "" };
  let cut = maxFirstChars;
  const sp = t.lastIndexOf(" ", maxFirstChars);
  if (sp > maxFirstChars * 0.5) cut = sp;
  return {
    first: `${t.slice(0, cut).trimEnd()}…`,
    rest: t.slice(cut).trim(),
  };
}
