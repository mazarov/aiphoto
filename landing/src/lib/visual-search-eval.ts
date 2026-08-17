export type VisualSearchEvalQuery = {
  id: string;
  query: string;
  kind: "visual" | "exact_title" | "typo" | "lexical";
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
];

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
