import sharp from "sharp";

export type VideoFrameAspect = "9:16" | "16:9";
export type VideoSourceFrame = {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  cropped: boolean;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
};

const RATIO_EPSILON = 0.01;

export function resolveVideoFrameAspect(aspectRatio: string): VideoFrameAspect {
  return aspectRatio === "16:9" ? "16:9" : "9:16";
}

export function videoFrameAspectParts(aspectRatio: string): { width: number; height: number } {
  return resolveVideoFrameAspect(aspectRatio) === "16:9"
    ? { width: 16, height: 9 }
    : { width: 9, height: 16 };
}

export function isAlreadyCoverAspect(
  sourceWidth: number,
  sourceHeight: number,
  aspectRatio: string,
): boolean {
  if (sourceWidth <= 0 || sourceHeight <= 0) return false;
  const { width, height } = videoFrameAspectParts(aspectRatio);
  return Math.abs(sourceWidth / sourceHeight - width / height) <= RATIO_EPSILON;
}

export function coverCropOutputSize(
  sourceWidth: number,
  sourceHeight: number,
  aspectRatio: string,
): { width: number; height: number } {
  const { width: aw, height: ah } = videoFrameAspectParts(aspectRatio);
  const target = aw / ah;
  let width: number;
  let height: number;
  if (sourceWidth / sourceHeight > target) {
    height = sourceHeight;
    width = Math.round(sourceHeight * target);
  } else {
    width = sourceWidth;
    height = Math.round(sourceWidth / target);
  }
  return {
    width: Math.max(2, width - (width % 2)),
    height: Math.max(2, height - (height % 2)),
  };
}

function mimeFromFormat(format?: string): VideoSourceFrame["mimeType"] {
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return "image/jpeg";
}

export function videoSourceFrameLogFields(frame: VideoSourceFrame): Record<string, unknown> {
  return {
    frameCropped: frame.cropped,
    frameSourceWidth: frame.sourceWidth,
    frameSourceHeight: frame.sourceHeight,
    frameOutputWidth: frame.outputWidth,
    frameOutputHeight: frame.outputHeight,
  };
}

export async function coverCropVideoFrame(
  input: Buffer,
  aspectRatio: string,
): Promise<VideoSourceFrame> {
  const oriented = sharp(input, { failOn: "none" }).rotate();
  const meta = await oriented.metadata();
  const sourceWidth = meta.width || 0;
  const sourceHeight = meta.height || 0;
  if (!sourceWidth || !sourceHeight) {
    throw new Error("Video source image has no dimensions");
  }
  if (isAlreadyCoverAspect(sourceWidth, sourceHeight, aspectRatio)) {
    return {
      buffer: input,
      mimeType: mimeFromFormat(meta.format),
      cropped: false,
      sourceWidth,
      sourceHeight,
      outputWidth: sourceWidth,
      outputHeight: sourceHeight,
    };
  }
  const size = coverCropOutputSize(sourceWidth, sourceHeight, aspectRatio);
  const buffer = await oriented
    .clone()
    .resize(size.width, size.height, { fit: "cover", position: "centre" })
    .jpeg({ quality: 90 })
    .toBuffer();
  return {
    buffer,
    mimeType: "image/jpeg",
    cropped: true,
    sourceWidth,
    sourceHeight,
    outputWidth: size.width,
    outputHeight: size.height,
  };
}
