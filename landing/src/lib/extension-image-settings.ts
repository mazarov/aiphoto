export const EXTENSION_ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "1:1" },
  { value: "3:4", label: "3:4" },
  { value: "4:5", label: "4:5" },
  { value: "4:7", label: "4:7" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
] as const;

export type ExtensionAspectRatio =
  (typeof EXTENSION_ASPECT_RATIO_OPTIONS)[number]["value"];

export type ExtensionImageSettings = {
  aspectRatio: ExtensionAspectRatio;
  width: number;
  height: number;
};

const RATIOS: Array<{ value: ExtensionAspectRatio; ratio: number }> = [
  { value: "1:1", ratio: 1 },
  { value: "3:4", ratio: 3 / 4 },
  { value: "4:5", ratio: 4 / 5 },
  { value: "4:7", ratio: 4 / 7 },
  { value: "9:16", ratio: 9 / 16 },
  { value: "16:9", ratio: 16 / 9 },
];

export function inferAspectRatioFromDimensions(
  width: number,
  height: number,
): ExtensionAspectRatio | null {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  const measured = width / height;
  return RATIOS.reduce((best, candidate) =>
    Math.abs(Math.log(measured / candidate.ratio)) <
    Math.abs(Math.log(measured / best.ratio))
      ? candidate
      : best,
  ).value;
}
