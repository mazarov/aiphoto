/**
 * Keyword-rich alt text builders for prompt card images.
 * Used across listings, carousels, and card pages.
 */

export function buildCardImageAlt(
  title: string,
  tagLabels: string[] = [],
  index = 0
): string {
  const base = `${title} — промпт для фото в нейросети`;
  const tagPart = tagLabels.length > 0 ? `, ${tagLabels.slice(0, 2).join(", ")}` : "";
  const framePart = index > 0 ? `, кадр ${index + 1}` : "";
  return `${base}${tagPart}${framePart}`;
}

export function buildBeforeAlt(title: string): string {
  return `До обработки: ${title}`;
}

export function buildAfterAlt(title: string): string {
  return `После — ${title}, промпт для ИИ-фото`;
}

export function buildThumbAlt(title: string, index: number): string {
  return `${title} — кадр ${index + 1}`;
}
