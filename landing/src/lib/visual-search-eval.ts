export type VisualSearchEvalQuery = {
  id: string;
  query: string;
  kind: "visual" | "exact_title" | "typo" | "lexical" | "noise";
  expectedCardIds?: string[];
  expectedTitleIncludes?: string[];
};

export const VISUAL_SEARCH_EVAL_QUERIES: VisualSearchEvalQuery[] = [
  { id: "v1", query: "девушка в красном платье на море", kind: "visual" },
  { id: "v2", query: "ночной неоновый портрет", kind: "visual" },
  { id: "v3", query: "деловое фото мужчины в костюме", kind: "visual" },
  { id: "v4", query: "киберпанк город дождь", kind: "visual" },
  { id: "v5", query: "уютная кухня утренний свет", kind: "visual" },
  { id: "v6", query: "собака на снегу", kind: "visual" },
  { id: "v7", query: "свадебная фотосессия в поле", kind: "visual" },
  { id: "v8", query: "черно-белый портрет крупным планом", kind: "visual" },
  { id: "v9", query: "автомобиль на закате", kind: "visual" },
  { id: "v10", query: "фэнтези эльф в лесу", kind: "visual" },
  { id: "v11", query: "еда сверху на деревянном столе", kind: "visual" },
  { id: "v12", query: "спортсменка в зале", kind: "visual" },
  { id: "v13", query: "ребенок с воздушным шаром", kind: "visual" },
  { id: "v14", query: "космический пейзаж", kind: "visual" },
  { id: "v15", query: "винтажная квартира с плёнкой", kind: "visual" },
  { id: "e1", query: "кинематографический портрет", kind: "exact_title" },
  { id: "e2", query: "студийный снимок", kind: "exact_title" },
  { id: "t1", query: "партерт девушки", kind: "typo" },
  { id: "t2", query: "киберпанкк", kind: "typo" },
  { id: "l1", query: "промт для фотосессии", kind: "lexical" },
  { id: "n1", query: "бухгалтерский баланс ндс декларация 3-ндфл", kind: "noise" },
  { id: "n2", query: "zxqvbnm12345 несуществующий артикул", kind: "noise" },
];

export type VisualDistanceDistribution = {
  count: number;
  min: number | null;
  p50: number | null;
  p90: number | null;
  p95: number | null;
  max: number | null;
};

export function recallAtK(
  retrievedIds: string[],
  expectedIds: string[],
  k = 20,
): number {
  if (expectedIds.length === 0) return 1;
  const top = new Set(retrievedIds.slice(0, k));
  const hits = expectedIds.filter((id) => top.has(id)).length;
  return hits / expectedIds.length;
}

export function zeroResultRate(resultSets: string[][]): number {
  if (resultSets.length === 0) return 0;
  return resultSets.filter((set) => set.length === 0).length / resultSets.length;
}

export function exactTitlePreserved(options: {
  query: string;
  baselineFirstId: string | null;
  hybridFirstId: string | null;
}): boolean {
  if (!options.baselineFirstId) return true;
  return options.hybridFirstId === options.baselineFirstId;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const clamped = Math.min(1, Math.max(0, p));
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(clamped * sorted.length) - 1),
  );
  return sorted[index] ?? null;
}

export function summarizeVisualDistances(
  distances: readonly number[],
): VisualDistanceDistribution {
  const finite = distances
    .filter((d) => Number.isFinite(d) && d >= 0)
    .sort((a, b) => a - b);
  if (finite.length === 0) {
    return {
      count: 0,
      min: null,
      p50: null,
      p90: null,
      p95: null,
      max: null,
    };
  }
  return {
    count: finite.length,
    min: finite[0]!,
    p50: percentile(finite, 0.5),
    p90: percentile(finite, 0.9),
    p95: percentile(finite, 0.95),
    max: finite[finite.length - 1]!,
  };
}

export function filterByVisualDistanceThreshold<
  T extends { visual_distance?: number | null },
>(items: readonly T[], maxDistance: number | null | undefined): T[] {
  if (maxDistance === null || maxDistance === undefined || maxDistance <= 0) {
    return [...items];
  }
  return items.filter((item) => {
    if (typeof item.visual_distance !== "number" || !Number.isFinite(item.visual_distance)) {
      return false;
    }
    return item.visual_distance <= maxDistance;
  });
}
