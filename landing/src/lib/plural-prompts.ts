/** Склонение «N промт / промта / промптов» для листингов и категорий. */
export function pluralPrompts(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} промт`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} промта`;
  return `${n} промптов`;
}
