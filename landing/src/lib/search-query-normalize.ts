export const MAX_PERSISTED_QUERY_LENGTH = 80;
export const MAX_NORMALIZED_QUERY_LENGTH = 160;

/**
 * Canonical normalized string for query hashing, L1/L2 cache keys, and FTS matching.
 * Folds `ё -> е`, collapses whitespace, lowercases, and trims.
 */
export function normalizeSearchQueryForCache(raw: string): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NORMALIZED_QUERY_LENGTH);
}

/**
 * Queries eligible for persistent L2 storage in `search_query_embeddings`.
 */
export function isPersistableSearchQuery(raw: string): boolean {
  const norm = normalizeSearchQueryForCache(raw);
  return norm.length >= 2 && norm.length <= MAX_PERSISTED_QUERY_LENGTH;
}

type PhraseRule = {
  from: readonly string[];
  to: readonly string[];
};

/**
 * Bidirectional phrase/token rules for FTS query expansion (`p_synonym_query`).
 * Produces a single clean alternate phrase so `plainto_tsquery` preserves AND-semantics
 * without requiring both synonyms to co-occur in the same card.
 *
 * Never used to mutate the natural-language string sent to Gemini Embedding 2.
 */
const PHRASE_RULES: readonly PhraseRule[] = [
  { from: ["ч/б"], to: ["черно-белое"] },
  { from: ["чб"], to: ["черно-белое"] },
  { from: ["черно-белый"], to: ["чб"] },
  { from: ["черно-белое"], to: ["чб"] },
  { from: ["черно-белая"], to: ["чб"] },
  { from: ["черно", "белый"], to: ["чб"] },
  { from: ["черно", "белое"], to: ["чб"] },
  { from: ["черно", "белая"], to: ["чб"] },
  { from: ["олд", "мани"], to: ["old", "money"] },
  { from: ["old", "money"], to: ["олд", "мани"] },
  { from: ["полароид"], to: ["polaroid"] },
  { from: ["polaroid"], to: ["полароид"] },
  { from: ["киберпанк"], to: ["cyberpunk"] },
  { from: ["cyberpunk"], to: ["киберпанк"] },
  { from: ["аниме"], to: ["anime"] },
  { from: ["anime"], to: ["аниме"] },
  { from: ["авто"], to: ["машина"] },
  { from: ["автомобиль"], to: ["машина"] },
  { from: ["автомобиля"], to: ["машина"] },
  { from: ["автомобиле"], to: ["машина"] },
  { from: ["автомобилем"], to: ["машина"] },
  { from: ["др"], to: ["день", "рождения"] },
];

function stripEdgePunctuation(token: string): string {
  return token.replace(/^[,.;:!?()"'«»[\]{}]+|[,.;:!?()"'«»[\]{}]+$/g, "");
}

function tokenizeNormalized(norm: string): string[] {
  if (!norm) return [];
  return norm
    .split(" ")
    .map(stripEdgePunctuation)
    .filter((part) => part.length > 0);
}

/**
 * Returns an expanded FTS query string when at least one alias matched,
 * or `null` if no synonym rule applies.
 */
export function expandSearchSynonymQuery(raw: string): string | null {
  const norm = normalizeSearchQueryForCache(raw);
  const tokens = tokenizeNormalized(norm);
  if (tokens.length === 0) return null;

  const out: string[] = [];
  let changed = false;
  let index = 0;

  while (index < tokens.length) {
    let matchedRule: PhraseRule | null = null;

    for (const rule of PHRASE_RULES) {
      const len = rule.from.length;
      if (index + len > tokens.length) continue;
      let allMatch = true;
      for (let offset = 0; offset < len; offset += 1) {
        if (tokens[index + offset] !== rule.from[offset]) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        matchedRule = rule;
        break;
      }
    }

    if (matchedRule) {
      out.push(...matchedRule.to);
      index += matchedRule.from.length;
      changed = true;
    } else {
      out.push(tokens[index]!);
      index += 1;
    }
  }

  if (!changed) return null;
  const expanded = out.join(" ").trim().slice(0, 200);
  return expanded && expanded !== norm ? expanded : null;
}
